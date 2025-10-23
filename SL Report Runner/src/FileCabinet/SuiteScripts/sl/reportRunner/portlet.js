/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @description Displays Report Runner output inside a dashboard portlet.
 */

define(['N/runtime', 'N/file', 'N/ui/serverWidget'], function (runtime, file, serverWidget) {


  function renderContent(params) {
    params.portlet.title = 'SL Report Runner';


    //params.portlet.form = serverWidget.createForm({ title: 'TBD', hideNavBar: true });
    // add html with reference script/css links
    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/runReport/index.html' }).getContents()}</body>`;

    params.portlet.addField({
      id: 'custpage_reportoutput',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Report Output'
    }).defaultValue = `${style}${script}${body}`;

    const reportId = runtime.getCurrentScript().getParameter({ name: 'custscript_slrr_portlet_reportid' });
    params.portlet.addField({
      id: 'custpage_reportid',
      type: serverWidget.FieldType.TEXT,
      label: 'Report ID'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = reportId;



    if (!reportId) {
      params.portlet.html = [
        '<div class="slrr-portlet-message" style="font-size:12px;line-height:1.4;">',
        '<p style="margin:0;">No report selected. Edit the portlet preferences to choose a report.</p>',
        '</div>'
      ].join('');
      return;
    }
  }

  return {
    render: renderContent
  };
});
