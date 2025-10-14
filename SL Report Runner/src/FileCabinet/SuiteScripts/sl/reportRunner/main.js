/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Stephen Lemp <sl@stephenlemp.com>
 * @description Main entry point for the Report Runner Suitelet
 */
define(['N/ui/serverWidget', 'N/search'], (serverWidget, search) => {

  function onRequest(context) {
    try {
      generateMainPage(context);
    } catch (e) {
      log.error({ title: 'Error in Report Runner Suitelet', details: e });
      context.response.write('An error occurred: ' + e.message);
    }
  }

  function generateMainPage(context) {
    const form = serverWidget.createForm({ title: 'Report Runner' });

    // Add a field for favorites
    const favoritesField = form.addField({
      id: 'custpage_favoriatereports',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Favorites'
    });
    const favoriteReports = getFavoriteReports();
    favoritesField.defaultValue = renderFavoritesHtml(favoriteReports);

    // Add a select field to display available reports
    const reportsListField = form.addField({
      id: 'custpage_reportselect',
      type: serverWidget.FieldType.SELECT,
      label: 'Report Name',
    });
    reportsListField.addSelectOption({ value: '', text: '' });
    findAndSetAvailableReports(reportsListField);

    form.addButton({
      id: 'custpage_slrr_runreport',
      label: 'Run Report',
      functionName: 'runReport'
    });
    form.addButton({
      id: 'custpage_slrr_addfavorite',
      label: 'Run Report',
      functionName: 'addFavorite'
    });
    form.clientScriptModulePath = 'SuiteScripts/sl/reportRunner/client.js';
    context.response.writePage(form);
  }


  function findAndSetAvailableReports(reportsListField) {
    const reportSearch = search.create({
      type: 'customrecord_sl_reportrunnerconfig',
      filters: [
        ['isinactive', 'is', 'F']
      ],
      columns: [
        search.createColumn({ name: 'name' }),
        search.createColumn({ name: 'internalid' })
      ]
    });

    reportSearch.run().each(result => {
      const reportName = result.getValue({ name: 'name' });
      const reportId = result.getValue({ name: 'internalid' });
      reportsListField.addSelectOption({ value: reportId, text: reportName });
      return true; // continue iteration
    });
  }

  return { onRequest };
});
