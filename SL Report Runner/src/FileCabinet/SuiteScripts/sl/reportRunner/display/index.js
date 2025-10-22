
let resultsTable = null;
let currentReportId = null;

jQuery(document).ready(function () {
  require(['N/runtime', 'N/ui/message', 'N/currentRecord'], (runtime, message, currentRecord) => {
    window.cr = currentRecord.get();
    window.runtime = runtime;
    window.message = message;
    setupDocumentReady();
    initializeDownloadButton();
  });
});

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

      end = start.cloneNode();
      end.setAttribute("placeholder", "Max");

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


async function setupDocumentReady() {
  currentReportId = cr.getValue('custpage_reportid');
  console.log('reportId', currentReportId);

  resultsTable = new Tabulator(
    '#results-table',
    {
      autoColumns: 'full',
      paginationCounter: 'rows', //add pagination row counter
      dataLoader: true, // Show loader while fetching data
      ajaxURL: `${location.href}&action=GET_REPORT_DATA&reportId=${currentReportId}`,
      ajaxConfig: 'POST'

    }
  );

  resultsTable.on('dataLoaded', function (data) {
    // update columns once data is loaded
    console.log('CustomHeaderFilters:', CustomHeaderFilters);
    getCustomColumnDefinitions(resultsTable.getColumnDefinitions()).then((customDefinitions) => {
      if (customDefinitions && customDefinitions.length > 0) {
        const mergedDefinitions = resultsTable.getColumnDefinitions().map((defaultCol) => {
          const customCol = customDefinitions.find(col => col.field === defaultCol.field);
          if (customCol && customCol.headerFilter && CustomHeaderFilters[customCol.headerFilter]) {
            const headerFilterKey = customCol.headerFilter;
            console.log('Applying Custom Header Filter:' + headerFilterKey, CustomHeaderFilters[headerFilterKey]);
            customCol.headerFilter = CustomHeaderFilters[headerFilterKey].editor;
            customCol.headerFilterFunc = CustomHeaderFilters[headerFilterKey].filterFunction;
          }
          return customCol ? { ...defaultCol, ...customCol } : defaultCol;
        });
        console.log('Merged Definitions:', mergedDefinitions);
        resultsTable.setColumns(mergedDefinitions);
      } else {
        console.log('No custom definitions found, using default.');
      }
    });
  });
}

function getCustomColumnDefinitions(definitions) {
  return makeRequest('POST', `${location.href}&action=GET_REPORT_COLUMNS&reportId=${currentReportId}`)
    .then((response) => {
      const customDefinitions = JSON.parse(response || '[]');
      console.log('Custom Definitions:', customDefinitions);
      return customDefinitions;
    })
    .catch((error) => {
      console.error('Error fetching column definitions:', error);
      resultsTable.setColumns(definitions);
    });
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
    const filename = currentReportId ? `report-${currentReportId}.csv` : 'report.csv';
    resultsTable.download('csv', filename);
  });
}
