/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Stephen Lemp <sl@stephenlemp.com>
 * @description Main entry point for the Report Runner Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/config', 'N/file', 'N/runtime'], function (serverWidget, search, config, file, runtime) {

  function onRequest(context) {
    try {
      if (context.request.method === 'POST') {
        log.debug({ title: 'POST Request', details: context.request });
        const action = context.request.parameters.action;
        if (action === 'updateFavorites') {
          context.response.write(JSON.stringify({ success: handleUpdateFavorites(context) }));
        } else {
          context.response.write(JSON.stringify({ success: false, message: 'Unknown action' }));
        }
      } else {
        const reportId = context.request.parameters.reportId;
        if (reportId) { generateReportDisplay(context, reportId); }
        else { generateMainPage(context); }
      }
    } catch (e) {
      log.error({ title: 'Error in Report Runner Suitelet', details: e });
      context.response.write('An error occurred: ' + e.message);
    }
  }

  function generateMainPage(context) {
    const form = serverWidget.createForm({ title: 'Report Runner' });

    // Add a field for favorites
    form.addField({
      id: 'custpage_favoriatereports',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Favorites'
    });

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
      label: 'Add Favorite',
      functionName: 'addFavorite'
    });
    form.clientScriptModulePath = 'SuiteScripts/sl/reportRunner/client.js';
    context.response.writePage(form);
  }


  function generateReportDisplay(context, reportId) {
    const form = serverWidget.createForm({ title: 'Report Output', hideNavBar: true });
    // add html with reference script/css links
    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/display/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/display/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/display/index.html' }).getContents()}</body>`;

    form.addField({
      id: 'custpage_reportoutput',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Report Output'
    }).defaultValue = `${style}${script}${body}`;

    form.addField({
      id: 'custpage_reportid',
      type: serverWidget.FieldType.TEXT,
      label: 'Report ID'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = reportId;

    const tabulatorOptions = search.lookupFields({
      type: 'customrecord_sl_reportrunnerconfig',
      id: reportId,
      columns: ['custrecord_slrr_tabulatoroptions']
    }).custrecord_slrr_tabulatoroptions || '{}';
    form.addField({
      id: 'custpage_tabulatoroptions',
      type: serverWidget.FieldType.LONGTEXT,
      label: 'Tabulator Options'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = tabulatorOptions;

    context.response.writePage(form);
  }

  function handleUpdateFavorites(context) {
    const body = JSON.parse(context.request.body);
    const favoriteReportIds = body.favoriteReportIds || '';
    // Here you would typically save the favoriteReportIds to a user preference or custom record
    // For this example, we'll just log them
    log.debug({ title: 'Updated Favorite Reports', details: favoriteReportIds });
    const userPreferences = config.load({ type: config.Type.USER_PREFERENCES });
    userPreferences.setValue({
      fieldId: 'custscript_slrr_favoritereports',
      value: favoriteReportIds
    });
    userPreferences.save();
    return true;
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
