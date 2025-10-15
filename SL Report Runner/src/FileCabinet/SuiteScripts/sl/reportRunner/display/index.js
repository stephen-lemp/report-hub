
let resultsTable = null
let currentReportId = null

jQuery(document).ready(function () {
  require(['N/runtime', 'N/ui/message', 'N/currentRecord'], (runtime, message, currentRecord) => {
    window.cr = currentRecord.get()
    window.runtime = runtime
    window.message = message
    setupDocumentReady()
    initializeDownloadButton()
  })
})


function setupDocumentReady() {
  currentReportId = cr.getValue('custpage_reportid')
  console.log('reportId', currentReportId)

  resultsTable = new Tabulator(
    '#results-table',
    {
      //...JSON.parse(cr.getValue('custpage_tabulatoroptions') || '{}'),
      autoColumns: 'full',
      paginationCounter: 'rows', //add pagination row counter
      dataLoader: true, // Show loader while fetching data
      ajaxURL: `${location.href}&action=GET_REPORT_DATA&reportId=${currentReportId}`,
      ajaxConfig: 'POST'

    }
  )
}


// https://stackoverflow.com/questions/30008114/how-do-i-promisify-native-xhr
function makeRequest(method, url, body) {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url)
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response)
      } else {
        reject({
          status: xhr.status,
          statusText: xhr.statusText
        })
      }
    }
    xhr.onerror = function () {
      reject({
        status: xhr.status,
        statusText: xhr.statusText
      })
    }
    xhr.send(body)
  })
}

function initializeDownloadButton() {
  const button = document.getElementById('download-csv-button')
  if (!button) {
    window.requestAnimationFrame(initializeDownloadButton)
    return
  }

  button.addEventListener('click', () => {
    if (!resultsTable) {
      return
    }
    const filename = currentReportId ? `report-${currentReportId}.csv` : 'report.csv'
    resultsTable.download('csv', filename)
  })
}
