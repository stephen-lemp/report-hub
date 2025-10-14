
jQuery(document).ready(function () {
  require(['N/runtime', 'N/ui/message', 'N/currentRecord'], (runtime, message, currentRecord) => {
    window.cr = currentRecord.get();
    window.runtime = runtime;
    window.message = message;
    setupDocumentReady();
  });
});


function setupDocumentReady() {
  const reportId = cr.getValue('custpage_reportid');
  console.log('reportId', reportId);

  new Tabulator(
    "#results-table",
    {
      //...JSON.parse(cr.getValue('custpage_tabulatoroptions') || '{}'),
      autoColumns: "full",
      paginationCounter: 'rows', //add pagination row counter
      dataLoader: true, // Show loader while fetching data
      ajaxURL: `${location.href}&action=GET_REPORT_DATA&reportId=${reportId}`,
      ajaxConfig: 'POST',

    }
  );
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