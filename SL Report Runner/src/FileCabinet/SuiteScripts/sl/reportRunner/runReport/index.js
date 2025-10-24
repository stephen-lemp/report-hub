
const BASE_URL = `/app/site/hosting/scriptlet.nl?script=customscript_slreportrunner&deploy=customdeploy_slreportrunner`;

let resultsTable = null;
let currentReportId = null;
let portletApi = null;
let portletResizePending = false;
const PORTLET_MIN_HEIGHT = 420;
const PORTLET_PADDING = 24;
let resultsTableResizeHooked = false;
let lastPollElapsed = null;
let pendingTableCompletion = false;

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
  if (resultsTable && !resultsTableResizeHooked) {
    resultsTable.on('tableBuilt', () => {
      schedulePortletResize();
    });
    resultsTableResizeHooked = true;
  }
}

const CustomColumnFilterDefinitions = {
  date: { //do date range: https://stackoverflow.com/questions/64257406/tabulator-filter-by-date-range-from-to-in-header
    filterEditor: function (cell, onRendered, success, cancel, editorParams) {
      var end;
      var container = document.createElement("span");
      //create and style inputs
      var start = document.createElement("input");
      start.setAttribute("type", "date");
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
        //if (e.keyCode == 13) {
        //  buildValues();
        //}

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
  },
  number: {
    filterEditor: function (cell, onRendered, success, cancel, editorParams) {
      var end;
      var container = document.createElement("span");

      //create and style inputs
      var start = document.createElement("input");
      //start.setAttribute("type", "number");
      start.style.padding = "4px";
      start.style.width = "50%";
      start.style.boxSizing = "border-box";
      start.value = cell.getValue();


      function buildValues() {
        console.log('buildValues - number', { start: start.value, end: end.value });
        success({
          start: start.value,
          end: end.value,
        });
      }

      function keypress(e) {
        if (e.keyCode == 13) { buildValues(); }
        if (e.keyCode == 27) { cancel(); }
      }

      end = start.cloneNode();

      start.addEventListener("change", buildValues);
      start.addEventListener("blur", buildValues);
      start.addEventListener("keydown", keypress);
      end.addEventListener("change", buildValues);
      end.addEventListener("blur", buildValues);
      end.addEventListener("keydown", keypress);

      container.appendChild(start);
      container.appendChild(end);

      return container;
    },
    filterFunction: (headerValue, rowValue, rowData, filterParams) => {
      const value = rowValue ? Number(rowValue) : rowValue;
      const startValue = headerValue.start ? Number(headerValue.start) : headerValue.start;
      const endValue = headerValue.end ? Number(headerValue.end) : headerValue.end;
      if (value != "") {
        if (startValue != "") {
          if (endValue != "") {
            return value >= startValue && value <= endValue;
          } else {
            return value >= startValue;
          }
        } else {
          if (endValue != "") {
            return value <= endValue;
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
    let { taskId, requestGuid } = params || {};
    pendingTableCompletion = false;
    lastPollElapsed = null;
    const startTime = Date.now();
    let statusLabel = 'Loading data...';
    let timersStopped = false;
    let finalElapsedValue = null;

    const formatElapsed = () => {
      const seconds = (Date.now() - startTime) / 1000;
      return `${seconds.toFixed(1)}s`;
    };
    const applyTitle = () => {
      setResultsTitle(`⏳ ${statusLabel} (${formatElapsed()})`);
    };
    applyTitle();
    const titleTimer = setInterval(applyTitle, 100);

    const stopTimers = () => {
      if (!timersStopped) {
        timersStopped = true;
        clearInterval(pollTimer);
        clearInterval(titleTimer);
        finalElapsedValue = formatElapsed();
      }
      return finalElapsedValue || formatElapsed();
    };

    const pollTimer = setInterval(() => {
      console.log('pollForData() polling...', { tries, taskId, requestGuid });
      makeRequest('POST', `${statusUrl}&taskId=${taskId ? taskId : ''}&requestGuid=${requestGuid}`)
        .then(response => {
          console.log('pollForData() response', response);
          response = JSON.parse(response);
          const status = (response.status || '').toUpperCase();
          if (status === 'COMPLETE' || status === 'SUCCEEDED') {
            const finalElapsed = stopTimers();
            lastPollElapsed = finalElapsed;
            pendingTableCompletion = true;
            setResultsTitle(`✅ Success - Building Table... (${finalElapsed})`);
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
            pendingTableCompletion = false;
            const finalElapsed = stopTimers();
            setResultsTitle(`❌ Failed (${finalElapsed})`);
            reject(new Error('Task failed'));
          } else if (++tries >= maxTries) {
            pendingTableCompletion = false;
            const finalElapsed = stopTimers();
            setResultsTitle(`❌ ⏱️ Timeout (${finalElapsed})`);
            reject(new Error('Timeout while waiting for data'));
          } else {
            if (status === 'PENDING') {
              statusLabel = 'Waiting for server thread to open up...';
            } else {
              statusLabel = 'Loading data...';
            }
            applyTitle();
            taskId = response.taskId || taskId; //update taskId for next poll
            if (!requestGuid) {
              requestGuid = response.requestGuid || requestGuid;
            }
          }
        })
        .catch(err => {
          pendingTableCompletion = false;
          const finalElapsed = stopTimers();
          setResultsTitle(`❌ Error (${finalElapsed})`);
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
  const columns = JSON.parse(cr.getValue('custpage_columndefinitions'));
  console.log('setupDocumentReady', { currentReportId, columns });
  const requestGuid = `${runtime.getCurrentUser().id}-${new Date().getTime()}-${currentReportId}`;

  resultsTable = new Tabulator(
    `#results-table`,
    {
      layout: "fitDataStretch",
      autoColumns: true,
      autoColumnsDefinitions: parseCustomColumnDefinitions(columns),
      pagination: true,
      paginationSize: 25,
      paginationSizeSelector: [10, 25, 50, 100, true],
      paginationCounter: 'rows', //add pagination row counter
      dataLoader: true, // Show loader while fetching data
      ajaxURL: getUrl({ action: 'GET_REPORT_DATA', reportId: currentReportId, requestGuid }),
      ajaxConfig: 'POST',
      ajaxRequestFunc: function (url, config, params) {
        return pollForData(url, params, 1000, 300); // resolves with []
      }
    }
  );

  resultsTable.on('tableBuilt', () => {
    schedulePortletResize();
  });
  resultsTable.on('renderComplete', () => {
    if (pendingTableCompletion) {
      pendingTableCompletion = false;
      const elapsed = lastPollElapsed || '0.0s';
      setResultsTitle(`✅ Done (${elapsed})`);
    }
  });
  schedulePortletResize();
}

function parseCustomColumnDefinitions(columns) {
  const results = [];
  const userFormattingOptions = JSON.parse(cr.getValue('custpage_userformattingoptions'));

  for (const col of columns) {
    const updatedDefinition = {
      field: col.field,
      title: col.title,
    };

    if (col.type === 'number') {
      updatedDefinition.headerFilter = CustomColumnFilterDefinitions.number.filterEditor;
      updatedDefinition.headerFilterFunc = CustomColumnFilterDefinitions.number.filterFunction;
      updatedDefinition.headerFilterLiveFilter = false;
    } else if (col.type == 'date') {
      updatedDefinition.sorter = 'date';
      updatedDefinition.sorterParams = { format: convertDateFormat(userFormattingOptions.dateFormat, 'LUX') };
      if (col.allowfiltering === 'T') {
        updatedDefinition.headerFilter = CustomColumnFilterDefinitions.date.filterEditor;
        updatedDefinition.headerFilterFunc = CustomColumnFilterDefinitions.date.filterFunction;
        updatedDefinition.headerFilterLiveFilter = false;
        updatedDefinition.width = '20px';
      }
    } else if (col.type === 'select' && col.allowfiltering === 'T') {
      updatedDefinition.headerFilter = 'list';
      updatedDefinition.headerFilterParams = {
        valuesLookup: "active", //get the values from the currently active rows in this column
        autocomplete: true
      };
    } else if (col.type === 'html') {
      updatedDefinition.formatter = 'html';
      if (col.allowfiltering === 'T') updatedDefinition.headerFilter = 'input';
    } else { // default
      if (col.allowfiltering === 'T') updatedDefinition.headerFilter = 'input';
    }

    results.push(updatedDefinition);
  }

  return results;
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

function mergeObjects(obj1, obj2) {
  const merged = structuredClone(obj1);
  Object.assign(merged, obj2);
  return merged;
}


/**
 * Convert date format between NetSuite and Luxon.
 * @param {string} format - The format string to convert.
 * @param {'LUX'|'NS'} target - 'LUX' to convert to Luxon, 'NS' to convert to NetSuite.
 * @returns {string} Converted format string.
 */
function convertDateFormat(format, target) {
  if (!['LUX', 'NS'].includes(target)) {
    throw new Error("target must be 'LUX' or 'NS'");
  }

  // Mapping table: [NetSuite, Luxon]
  const mappings = [
    ['YYYY', 'yyyy'],
    ['YY', 'yy'],
    ['MMMM', 'LLLL'],
    ['MMM', 'LLL'],
    ['DD', 'dd'],
    ['D', 'd'],
    ['A', 'a'],
    ['HH', 'HH'],  // 24-hour
    ['H', 'H'],    // 24-hour no pad
    ['hh', 'hh'],  // 12-hour
    ['h', 'h'],    // 12-hour no pad
    // Note: minutes/seconds are identical, no need to map
  ];

  let result = format;

  for (const [ns, lx] of mappings) {
    const from = target === 'LUX' ? ns : lx;
    const to = target === 'LUX' ? lx : ns;
    // Use word boundaries to prevent accidental partial replacements
    result = result.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }

  return result;
}
