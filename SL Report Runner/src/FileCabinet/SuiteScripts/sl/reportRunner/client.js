/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @author Stephen Lemp <sl@stephenlemp.com>
 */
define(['N/currentRecord'], (currentRecord) => {
  function runReport() {
    console.log('running report', currentRecord.get().getValue({ fieldId: 'custpage_reportselect' }));
  }

  function addFavorite() {
    console.log('adding favorite', currentRecord.get().getValue({ fieldId: 'custpage_reportselect' }));
  }

  return { runReport, addFavorite, pageInit: () => { } };
});