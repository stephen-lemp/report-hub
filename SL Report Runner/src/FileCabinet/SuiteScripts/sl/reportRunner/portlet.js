/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @description Displays Report Runner output inside a dashboard portlet.
 */

define(['N/runtime', 'N/file', 'N/ui/serverWidget', 'N/search'], function (runtime, file, serverWidget, search) {


  function renderContent(params) {
    const reportId = runtime.getCurrentScript().getParameter({ name: 'custscript_slrr_portlet_reportid' });
    if (!reportId) { renderReportList(params.portlet); }
    else { renderReportOutput(portlet, reportId); }
  }


  function renderReportOutput(portlet, reportId) {
    portlet.title = search.lookupFields({
      type: 'customrecord_sl_reportrunnerconfig',
      id: reportId,
      columns: ['name']
    }).name;

    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.html' }).getContents()}</body>`;

    portlet.addField({
      id: 'custpage_reportoutput',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Report Output'
    }).defaultValue = `${style}${script}${body}`;

    portlet.addField({
      id: 'custpage_reportid',
      type: serverWidget.FieldType.TEXT,
      label: 'Report ID'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = reportId;
  }

  function renderReportList(portlet) {
    portlet.title = 'Reports List';

    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.html' }).getContents()}</body>`;

    portlet.addField({
      id: 'custpage_reportslisting',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Report Listing'
    }).defaultValue = `${style}${script}${body}`;
  }


  return {
    render: renderContent
  };
});
