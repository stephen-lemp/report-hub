/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @author Stephen Lemp <sl@stephenlemp.com>
 */
define(['N/currentRecord', 'N/runtime', 'N/search'], (currentRecord, runtime, search) => {
  const cr = currentRecord.get();

  const FavoritesManager = {
    state: 'NEW', // NEW, LOADED, MODIFIED, ERROR
    favorites: [],
    renderHTML: () => {
      if (FavoritesManager.state === 'ERROR') {
        return '<p>Error loading favorite reports.</p>';
      } else if (FavoritesManager.state === 'NEW') {
        FavoritesManager.loadFavorites();
      }

      let html = '<ul>';
      FavoritesManager.favorites.forEach(report => {
        html += `<li>${report.name}</li>`;
      });
      html += '</ul>';
      cr.setValue({ fieldId: 'custpage_favoriatereports', value: html });
      return html;
    },
    addFavorite: () => {
      const reportId = cr.getValue({ fieldId: 'custpage_reportselect' });
      const reportName = cr.getText({ fieldId: 'custpage_reportselect' });
      if (!reportId) {
        alert('Please select a report to add to favorites.');
        return;
      }
      if (FavoritesManager.favorites.find(r => r.id === reportId)) {
        alert('This report is already in your favorites.');
        return;
      }
      FavoritesManager.favorites.push({ id: reportId, name: reportName });
      FavoritesManager.state = 'MODIFIED';
      FavoritesManager.renderHTML();
      FavoritesManager.syncFavorites();
    },
    removeFavorite: () => { },
    syncFavorites: () => {
      if (FavoritesManager.state !== 'MODIFIED') {
        return;
      }
      const favoriteIds = FavoritesManager.favorites.map(r => r.id).join(',');
      const url = `${location.href}&action=updateFavorites`;
      const body = JSON.stringify({ favoriteReportIds: favoriteIds });
      makeRequest('POST', url, body)
        .then(response => {
          console.log('Favorites updated successfully:', response);
          FavoritesManager.state = 'LOADED';
        })
        .catch(error => {
          console.error('Error updating favorites:', error);
          FavoritesManager.state = 'ERROR';
          alert('There was an error saving your favorite reports. Please try again later.');
        });
    },
    loadFavorites: () => {
      const favoriteReportIds = runtime.getCurrentScript().getParameter('custscript_slrr_favoritereports');
      if (!favoriteReportIds) {
        FavoritesManager.state = 'LOADED';
        return [];
      }
      search.create({
        type: 'customrecord_sl_reportrunnerconfig',
        filters: [
          ['internalid', 'anyof', favoriteReportIds ? favoriteReportIds.split(',') : []],
          'AND',
          ['isinactive', 'is', 'F']
        ],
        columns: [
          search.createColumn({ name: 'name' }),
          search.createColumn({ name: 'internalid' })
        ]
      }).run().each(result => {
        FavoritesManager.favorites.push({
          id: result.getValue({ name: 'internalid' }),
          name: result.getValue({ name: 'name' })
        });
        return true; // Continue iteration
      });
      FavoritesManager.state = 'LOADED';
      return FavoritesManager.favorites;
    }
  };


  function pageInit() {
    FavoritesManager.renderHTML();
  }

  function runReport() {
    console.log('running report', currentRecord.get().getValue({ fieldId: 'custpage_reportselect' }));
  }

  function addFavorite() {
    FavoritesManager.addFavorite();
  }

  return { runReport, addFavorite, pageInit };
});



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
