/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @description Displays Report Hub output inside a dashboard portlet.
 */

define(['N/runtime', 'N/file', 'N/ui/serverWidget', 'N/search', './uiLibrary.js'], function (runtime, file, serverWidget, search, ui) {


  function renderContent(params) {
    const reportId = runtime.getCurrentScript().getParameter({ name: 'custscript_slrh_portlet_reportid' });
    if (!reportId) { ui.setupReportListingPage(params.portlet); }
    else { ui.setupReportDisplayPage(params.portlet, reportId); }
  }

  return {
    render: renderContent
  };
});
