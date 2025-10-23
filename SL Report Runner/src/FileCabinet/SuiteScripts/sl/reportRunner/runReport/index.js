
const BASE_URL = `/app/site/hosting/scriptlet.nl?script=customscript_slreportrunner&deploy=customdeploy_slreportrunner`;

let resultsTable = null;
let currentReportId = null;
let portletApi = null;
let portletResizePending = false;
const PORTLET_MIN_HEIGHT = 420;
const PORTLET_PADDING = 24;

jQuery(document).ready(function () {
  require(['N/runtime', 'N/ui/message', 'N/currentRecord'], (runtime, message, currentRecord) => {
    window.cr = currentRecord.get();
    window.runtime = runtime;
    window.message = message;
    requestPortletModule();
    setupDocumentReady();
    initializeDownloadButton();
  });
});

function requestPortletModule() {
  if (typeof require !== 'function') {
    return;
  }
  require(['N/portlet'], function (portlet) {
    portletApi = portlet;
    schedulePortletResize();
  }, function (error) {
    console.debug('N/portlet module unavailable', error);
  });
}

function schedulePortletResize() {
  if (!portletApi) {
    return;
  }
  if (portletResizePending) {
    return;
  }
  portletResizePending = true;
  window.requestAnimationFrame(() => {
    portletResizePending = false;
    try {
      const height = Math.max(document.body.scrollHeight + PORTLET_PADDING, PORTLET_MIN_HEIGHT);
      if (portletApi) portletApi.resize({ height });
    } catch (error) {
      //console.warn('portlet.resize failed', error);
    }
  });
}

function setResultsTitle(text) {
  const titleElement = document.getElementById('results-title');
  if (titleElement) {
    titleElement.textContent = text;
  }
  schedulePortletResize();
}

const CustomHeaderFilters = {
  DATE_RANGE: { //https://stackoverflow.com/questions/64257406/tabulator-filter-by-date-range-from-to-in-header
    editor: function (cell, onRendered, success, cancel, editorParams) {
      var end;
      var container = document.createElement("span");
      //create and style inputs
      var start = document.createElement("input");
      start.setAttribute("type", "date");
      start.setAttribute("placeholder", "Min");
      start.style.padding = "4px";
      start.style.width = "50%";
      start.style.boxSizing = "border-box";

      start.value = cell.getValue();


      end = start.cloneNode();

      start.addEventListener("change", buildValues);
      start.addEventListener("blur", buildValues);
      start.addEventListener("keydown", keypress);

      end.addEventListener("change", buildValues);
      end.addEventListener("blur", buildValues);
      end.addEventListener("keydown", keypress);


      container.appendChild(start);
      container.appendChild(end);


      function buildValues() {
        console.log('buildValues', start.value, end.value);
        success({
          start: start.value,
          end: end.value,
        });
      }

      function keypress(e) {
        if (e.keyCode == 13) {
          buildValues();
        }

        if (e.keyCode == 27) {
          cancel();
        }
      }

      return container;
    },
    filterFunction: function (headerValue, rowValue, rowData, filterParams) {
      // assume rowValue is a date string
      // assume headerValue is an object with 'start' and 'end' date strings
      if (rowValue) {
        const rowTimeValue = new Date(rowValue).getTime();
        const filterStartTime = headerValue.start ? new Date(headerValue.start).getTime() : null;
        const filterEndTime = headerValue.end ? new Date(headerValue.end).getTime() : null;

        if (filterStartTime) {
          if (filterEndTime) {
            return rowTimeValue >= filterStartTime && rowTimeValue <= filterEndTime;
          } else {
            return rowTimeValue >= filterStartTime;
          }
        } else {
          if (filterEndTime) {
            return rowTimeValue <= filterEndTime;
          }
        }
      }

      return true; //must return a boolean, true if it passes the filter.
    }
  }
};


// poller using setInterval, resolves with the *final data array*
function pollForData(statusUrl, params, intervalMs = 2000, maxTries = 300) {
  console.log('pollForData() called with', { statusUrl, params, intervalMs, maxTries });
  return new Promise((resolve, reject) => {
    let tries = 0;
    let { taskId, requestGuid } = params;

    const timer = setInterval(() => {
      setResultsTitle('Results - ⏳ Loading...');   // Loading

      console.log('pollForData() polling...', { tries, taskId, requestGuid });
      makeRequest('POST', `${statusUrl}&taskId=${taskId ? taskId : ''}&requestGuid=${requestGuid}`)
        .then(response => {
          console.log('pollForData() response', response);
          response = JSON.parse(response);
          const status = (response.status || '').toUpperCase();
          if (status === 'COMPLETE' || status === 'SUCCEEDED') {
            setResultsTitle('Results - ✅ Success!');        // success
            clearInterval(timer);
            if (response.data) {
              console.log('pollForData() completed with data length', response.data?.length);
              resolve(response.data || []);
            } else if (response.dataLink) {
              console.log('pollForData() completed with dataLink', response.dataLink);
              resolve(getDataFromLink(response.dataLink, response.requestGuid) || []);
            } else {
              console.warn('pollForData() completed but no data or dataLink found in response', response);
              resolve([]);
            }
          } else if (status === 'FAILED') {
            setResultsTitle('Results - ❌ Failed');
            clearInterval(timer);
            reject(new Error('Task failed'));
          } else if (++tries >= maxTries) {
            clearInterval(timer);
            setResultsTitle('Results - ❌ ⏱️ Timeout ');
            reject(new Error('Timeout while waiting for data'));
          } else {
            setResultsTitle('Results - ⏳ Loading...');   // Loading
            taskId = response.taskId; //update taskId for next poll
          }
        })
        .catch(err => {
          clearInterval(timer);
          reject(err);
          console.error('pollForData() makeRequest error', err);
        });
    }, intervalMs);
  }).catch(err => {
    console.error('pollForData() error', err);
    throw err;
  });
}


function getDataFromLink(dataLink, requestGuid) {
  return fetch(`${window.location.origin}${dataLink}`)
    .then(response => response.text())
    .then(csvText => {
      const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      makeRequest('POST', getUrl({ action: 'DELETE_FILE', requestGuid }));
      console.log('pp results', results);
      return results.data;
    })
    .catch(console.error);
}


async function setupDocumentReady() {
  currentReportId = cr.getValue('custpage_reportid');
  console.log('reportId', currentReportId);
  const requestGuid = `${runtime.getCurrentUser().id}-${new Date().getTime()}-${currentReportId}`;

  resultsTable = new Tabulator(
    `#results-table`,
    {
      pagination: true,
      paginationSize: 25,
      paginationSizeSelector: [10, 25, 50, 100, true],
      headerFilterLiveFilterDelay: 600, //wait 600ms from last keystroke before triggering filter
      autoColumns: 'full',
      paginationCounter: 'rows', //add pagination row counter
      dataLoader: true, // Show loader while fetching data
      ajaxURL: getUrl({ action: 'GET_REPORT_DATA', reportId: currentReportId, requestGuid }),
      ajaxConfig: 'POST',
      ajaxRequestFunc: function (url, config, params) {
        return pollForData(url, params, 2000, 300); // resolves with []
      }
    }
  );

  resultsTable.on('dataLoaded', function (data) {
    // update columns once data is loaded
    console.log('CustomHeaderFilters:', CustomHeaderFilters);
    getCustomColumnDefinitions(resultsTable.getColumnDefinitions()).then((customDefinitions) => {
      if (customDefinitions && customDefinitions.length > 0) {
        const mergedDefinitions = resultsTable.getColumnDefinitions().map((defaultCol) => {
          const customCol = customDefinitions.find(col => col.field === defaultCol.field);
          if (customCol) {
            // Apply header filter options
            if (customCol.headerFilter && CustomHeaderFilters[customCol.headerFilter]) {
              const headerFilterKey = customCol.headerFilter;
              customCol.headerFilter = CustomHeaderFilters[headerFilterKey].editor;
              customCol.headerFilterFunc = CustomHeaderFilters[headerFilterKey].filterFunction;
              customCol.headerFilterLiveFilter = false;
            }
          }
          return customCol ? { ...defaultCol, ...customCol } : defaultCol;
        });
        console.log('Merged Definitions:', mergedDefinitions);
        resultsTable.setColumns(mergedDefinitions);
      } else {
        console.log('No custom definitions found, using default.');
      }
      schedulePortletResize();
    });
  });

}

function getCustomColumnDefinitions() {
  return makeRequest('POST', getUrl({ action: 'GET_REPORT_COLUMNS', reportId: currentReportId }))
    .then((response) => {
      const customDefinitions = JSON.parse(response || '[]');
      console.log('Custom Definitions:', customDefinitions);
      return customDefinitions;
    })
    .catch((error) => {
      console.error('Error fetching column definitions:', error);
      return [];
    });
}

function getUrl(parameters = {}) {
  const currentUrl = new URL(window.location.href);

  const newUrl = new URL(currentUrl.origin + BASE_URL);

  const params = currentUrl.searchParams;
  ['script', 'deploy'].forEach(key => {
    const value = params.get(key);
    if (value) newUrl.searchParams.set(key, value);
  });
  for (const param in parameters) {
    newUrl.searchParams.set(param, parameters[param]);
  }
  return newUrl.toString();
}

// https://stackoverflow.com/questions/30008114/how-do-i-promisify-native-xhr
function makeRequest(method, url, body) {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: xhr.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: xhr.status,
        statusText: xhr.statusText
      });
    };
    xhr.send(body);
  });
}

function initializeDownloadButton() {
  const button = document.getElementById('download-csv-button');
  if (!button) {
    window.requestAnimationFrame(initializeDownloadButton);
    return;
  }

  button.addEventListener('click', () => {
    if (!resultsTable) {
      return;
    }
    const filename = currentReportId ? `${document.title}-${new Date()
      .toLocaleString()
      .replaceAll(',', '')
      .replaceAll('/', '_')
      .replaceAll(':', '_')}.csv` : 'report.csv';
    resultsTable.download('csv', filename);
  });
}


function getTable() {
  return Tabulator.findTable('#results-table')[0];
}