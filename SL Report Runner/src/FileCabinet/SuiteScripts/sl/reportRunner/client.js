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
      return html;
    },
    addFavorite: () => { },
    removeFavorite: () => { },
    syncFavorites: () => { },
    loadFavorites: () => {
      const favoriteReportIds = runtime.getCurrentScript().getParameter('custscript_slrr_favoritereports');
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
    cr.setValue({ fieldId: 'custpage_favoriatereports', value: FavoritesManager.renderHTML() });
  }

  function runReport() {
    console.log('running report', currentRecord.get().getValue({ fieldId: 'custpage_reportselect' }));
  }

  function addFavorite() {
    console.log('adding favorite', currentRecord.get().getValue({ fieldId: 'custpage_reportselect' }));
  }

  return { runReport, addFavorite, pageInit };
});
