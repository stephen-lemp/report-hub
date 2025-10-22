/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Stephen Lemp <sl@stephenlemp.com>
 * @description Main entry point for the Report Runner Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/config', 'N/file', 'N/query', 'N/task', 'N/runtime'], function (serverWidget, search, config, file, query, task, runtime) {

  function onRequest(context) {
    try {
      if (context.request.method === 'POST') {
        log.debug({ title: 'POST Request', details: context.request });
        const action = context.request.parameters.action;
        if (action === 'DELETE_FILE') {
          file.delete(getFileIdFromName(`${context.request.parameters.requestGuid}.csv`));
          log.debug('deleted file', { requestGuid: context.request.parameters.requestGuid });
        } else if (action === 'GET_REPORT_DATA') {
          const reportId = context.request.parameters.reportId;
          log.debug({ title: 'Generating Report Data', details: `Report ID: ${reportId}` });
          context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
          context.response.write(JSON.stringify(getReportData(context.request.parameters)));
        } else if (action === 'GET_REPORT_COLUMNS') {
          const reportId = context.request.parameters.reportId;
          context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
          context.response.write(getReportColumnDefinitionsById(reportId) || '[]');
        } else {
          context.response.write(JSON.stringify({ success: false, message: 'Unknown action' }));
        }
      } else {
        const reportId = context.request.parameters.reportId;
        log.debug({ title: 'GET Request', details: context.request });
        if (reportId) { generateReportDisplay(context, reportId); }
        else { generateMainPage(context); }
      }
    } catch (e) {
      log.error({ title: 'Error in Report Runner Suitelet', details: e });
      context.response.write('An error occurred: ' + e.message);
    }
  }


  function getReportColumnDefinitionsById(reportId) {
    log.debug({ title: 'getReportColumnDefinitionsById', details: `Report ID: ${reportId}` });
    const results = [];
    query.runSuiteQL({
      query: `SELECT 	custrecord_slrrc_id field, 	custrecord_srllc_title title, 	custrecord_srllc_headerfilter headerfilter, 	custrecord_srllc_headerfilteroptions headerfilteroptions 
              FROM customrecord_slrr_columns 
              WHERE custrecord_slrrc_configlink = ?`,
      params: [reportId]
    }).asMappedResults().forEach(result => {
      results.push(
        {
          field: result.field,
          title: result.title,
          headerFilter: result.headerfilter,
          headerFilterOptions: result.headerfilteroptions ? JSON.parse(result.headerfilteroptions) : undefined
        });
      return result.custrecord_slrr_column_definitions || '[]';
    });
    log.debug('getReportColumnDefinitionsById() results', results);
    return JSON.stringify(results);
  }


  function getReportData(options) {
    const { reportId, requestGuid, taskId } = options;
    log.debug('getReportData() called with', options);

    //custrecord_slrr_usequickrun
    if (taskId) { // polling for existing task
      const taskStatus = task.checkStatus({ taskId: taskId });
      log.debug('getReportData() taskStatus', taskStatus);
      if (taskStatus.status === task.TaskStatus.COMPLETE) {
        const results = []; //TODO: fetch results from file
        log.debug('getReportData() results', results);
        return { status: 'COMPLETE', dataLink: getDataLink(requestGuid), requestGuid };
      } else if (taskStatus.status === task.TaskStatus.FAILED) {
        return { status: 'FAILED', message: 'The report generation task failed.', requestGuid };
      } else {
        return { status: taskStatus.status, taskId, requestGuid };
      }
    } else { // no task id. initiate new task or quick run
      const reportOptions = search.lookupFields({
        type: 'customrecord_sl_reportrunnerconfig',
        id: reportId,
        columns: ['custrecord_slrr_suiteqlquery', 'custrecord_slrr_savedsearch', 'custrecord_slrr_usequickrun']
      });
      log.debug('getReportData() reportOptions', reportOptions);
      const isQuickRunReport = reportOptions.custrecord_slrr_usequickrun;
      const queryText = reportOptions.custrecord_slrr_suiteqlquery;
      const savedSearchId = reportOptions.custrecord_slrr_savedsearch[0]?.value;
      if (isQuickRunReport) {
        const results = queryText ?
          query.runSuiteQL({ query: queryText }).asMappedResults() :
          getAllSearchResults(savedSearchId);
        log.debug('getReportData() results', results);
        return { status: 'COMPLETE', data: results, requestGuid };
      } else {
        const taskId = queryText ? initiateQueryTask(queryText, requestGuid) :
          initiateSearchTask(savedSearchId, requestGuid);
        return { status: 'QUERY_INITIATED', taskId, requestGuid };
      }
    }
  }


  function getDataLink(requestGuid) {
    return query.runSuiteQL({
      query: `SELECT url FROM file WHERE name = ?`,
      params: [`${requestGuid}.csv`]
    }).asMappedResults()[0]?.url || '';
  }


  function getFileIdFromName(fileName) {
    log.debug('getFileIdFromName', fileName);
    return query.runSuiteQL({
      query: `SELECT id FROM file WHERE name = ?`,
      params: [fileName]
    }).asMappedResults()[0]?.id || 0;
  }


  function getAllSearchResults(savedSearchId) {
    const results = [];
    if (!savedSearchId) {
      return results;
    }
    // Basic Implementation - 4000 result limit
    const savedSearch = search.load({ id: savedSearchId });
    log.debug('getAllSearchResults() savedSearchId', savedSearchId);
    savedSearch.run().each(result => {
      const resultObj = {};
      result.columns.forEach(column => {
        resultObj[column.name] = result.getText(column) || result.getValue(column);
      });
      results.push(resultObj);
      return true; // continue iteration
    });
    log.debug('getAllSearchResults() results', results);
    return results;
  }


  function initiateSearchTask(savedSearchId, requestGuid) {
    const basePath = getBaseFilePath();
    return task.create({
      taskType: task.TaskType.SEARCH,
      savedSearchId: savedSearchId,
      filePath: `${basePath}/${requestGuid}.csv`
    }).submit();
  }


  function initiateQueryTask(suiteQL, requestGuid) {
    const basePath = getBaseFilePath();
    return task.create({
      taskType: task.TaskType.SUITE_QL,
      query: suiteQL,
      filePath: `${basePath}/${requestGuid}.csv`
    }).submit();
  }


  function getBaseFilePath() {
    return runtime.getCurrentScript().getParameter('custscript_slrr_export_basepath') || '/TEMP';
  }


  function getAllSearchResults(savedSearchId) {
    const results = [];
    if (!savedSearchId) {
      return results;
    }
    // Basic Implementation - 4000 result limit
    const savedSearch = search.load({ id: savedSearchId });
    savedSearch.run().each(result => {
      const resultObj = {};
      result.columns.forEach(column => {
        resultObj[column.name] = result.getValue(column);
      });
      results.push(resultObj);
      return true; // continue iteration
    });
    log.debug('getAllSearchResults() results', results);
    return results;

  }


  function generateMainPage(context) {
    const form = serverWidget.createForm({ title: 'SL Report Runner' });

    form.addField({
      id: 'custpage_reportslisting',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Reports Listing'
    }).defaultValue = `<div id="reports-container"></div>`;

    form.clientScriptModulePath = 'SuiteScripts/sl/reportRunner/client.js';
    context.response.writePage(form);
  }


  function generateReportDisplay(context, reportId) {

    const reportOptions = search.lookupFields({
      type: 'customrecord_sl_reportrunnerconfig',
      id: reportId,
      columns: ['name']
    });

    const form = serverWidget.createForm({ title: reportOptions.name, hideNavBar: true });
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

    context.response.writePage(form);
  }


  return { onRequest };
});
