
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

  const table = new Tabulator("#results-table", JSON.parse(cr.getValue('custpage_tabulatoroptions') || '{}')
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