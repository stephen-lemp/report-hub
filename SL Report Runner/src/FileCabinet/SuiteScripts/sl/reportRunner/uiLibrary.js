/**
 * @description Library for generating fields and populating
 */

define(['N/search', 'N/file', 'N/ui/serverWidget', 'N/config', 'N/query'], function (search, file, serverWidget, config, query) {

  function setupReportListingPage(form) {
    form.title = 'Report List';
    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.html' }).getContents()}</body>`;

    form.addField({
      id: 'custpage_reportslisting',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Report Listing'
    }).defaultValue = `${style}${script}${body}`;
  }

  function setupReportDisplayPage(form, reportId) {
    form.title = search.lookupFields({
      type: 'customrecord_sl_reportrunnerconfig',
      id: reportId,
      columns: ['name']
    }).name;

    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.html' }).getContents()}</body>`;

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

    form.addField({
      id: 'custpage_columndefinitions',
      type: serverWidget.FieldType.LONGTEXT,
      label: 'Columns'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = JSON.stringify(getReportColumnDefinitionsById(reportId));

    form.addField({
      id: 'custpage_userformattingoptions',
      type: serverWidget.FieldType.LONGTEXT,
      label: 'User Formatting Options'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = JSON.stringify({
        dateFormat: config.load({ type: config.Type.USER_PREFERENCES }).getValue('DATEFORMAT')
      });
  }


  function getReportColumnDefinitionsById(reportId) {
    log.debug({ title: 'getReportColumnDefinitionsById', details: `Report ID: ${reportId}` });
    return query.runSuiteQL({
      query: `SELECT  custrecord_slrrc_id field,  custrecord_slrrc_title title, custrecord_slrrc_type type, custrecord_slrrc_allowfiltering allowfiltering
              FROM customrecord_slrr_columns 
              WHERE custrecord_slrrc_configlink = ?`,
      params: [reportId]
    }).asMappedResults() || [];
  }


  return { setupReportListingPage, setupReportDisplayPage };
});
