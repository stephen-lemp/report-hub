/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Stephen Lemp <sl@stephenlemp.com>
 * @description Main entry point for the Report Runner Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/config', 'N/file', 'N/query', 'N/task', 'N/runtime'], function (serverWidget, search, config, file, query, task, runtime) {

  const ActionRouter = {
    DELETE_FILE: (context) => {
      file.delete(getFileIdFromName(`${context.request.parameters.requestGuid}.csv`));
      log.debug('deleted file', { requestGuid: context.request.parameters.requestGuid });
    },
    GET_REPORT_DATA: (context) => {
      const reportId = context.request.parameters.reportId;
      log.debug({ title: 'Generating Report Data', details: `Report ID: ${reportId}` });
      context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
      context.response.write(JSON.stringify(getReportData(context.request.parameters)));
    },
    GET_REPORT_COLUMNS: (context) => {
      const reportId = context.request.parameters.reportId;
      context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
      context.response.write(JSON.stringify(getReportColumnDefinitionsById(reportId)) || '[]');
    }
  };

  function onRequest(context) {
    try {
      if (context.request.method === 'POST') {
        log.debug({ title: 'POST Request', details: context.request.parameters });
        const action = context.request.parameters.action;
        if (action) {
          ActionRouter[action] ?
            ActionRouter[action](context) :
            context.response.write(JSON.stringify({ success: false, message: 'Unknown action' }));
          return;
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
    return query.runSuiteQL({
      query: `SELECT  custrecord_slrrc_id field,  custrecord_slrrc_title title, custrecord_slrrc_type editor_select, custrecord_slrrc_allowfiltering filtering_options
              FROM customrecord_slrr_columns 
              WHERE custrecord_slrrc_configlink = ?`,
      params: [reportId]
    }).asMappedResults() || [];
  }


  function authorizeRequest(reportId) {
    const userRoleId = runtime.getCurrentUser().role;
    return query.runSuiteQL({
      query: `
      select id, CASE 
        WHEN BUILTIN.MNFILTER(custrecord_slrrc_availableto, 'MN_INCLUDE', '', 'TRUE', ?) = 'TRUE' THEN 'T' 
        WHEN NVL(custrecord_slrrc_availabletoall,'F') = 'T' THEN 'T'
        ELSE 'F' END authorized
        from customrecord_sl_reportrunnerconfig
      where id = ?`,
      params: [userRoleId, reportId]
    }).asMappedResults()[0]?.authorized === 'T';

  }


  function getReportData(options) {
    const { reportId, requestGuid, taskId } = options;
    log.debug('getReportData() called with', options);
    const requestAuthorization = authorizeRequest(reportId);
    if (!requestAuthorization) {
      return { status: 'FAILED', message: 'User Role not Authorized to View this Report', requestGuid };
    }

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
        columns: ['custrecord_slrr_suiteqlquery', 'custrecord_slrr_savedsearch', 'custrecord_slrrc_savedsearchid', 'custrecord_slrr_usequickrun']
      });
      log.debug('getReportData() reportOptions', reportOptions);
      const isQuickRunReport = reportOptions.custrecord_slrr_usequickrun;
      const queryText = reportOptions.custrecord_slrr_suiteqlquery;
      const savedSearchId = reportOptions.custrecord_slrr_savedsearch[0]?.value || reportOptions.custrecord_slrrc_savedsearchid;
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

    const style = `<style>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.css' }).getContents()}</style>`;
    const script = `<script>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.js' }).getContents()}</script>`;
    const body = `<body>${file.load({ id: '/SuiteScripts/sl/reportRunner/listReports/index.html' }).getContents()}</body>`;

    form.addField({
      id: 'custpage_reportslisting',
      type: serverWidget.FieldType.INLINEHTML,
      label: 'Report Listing'
    }).defaultValue = `${style}${script}${body}`;

    context.response.writePage(form);
  }


  function generateReportDisplay(context, reportId) {

    const reportOptions = search.lookupFields({
      type: 'customrecord_sl_reportrunnerconfig',
      id: reportId,
      columns: ['name']
    });


    const form = serverWidget.createForm({ title: reportOptions.name, hideNavBar: false });
    // add html with reference script/css links
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
      id: 'cuatpage_columndefinitions',
      type: serverWidget.FieldType.LONGTEXT,
      label: 'Columns'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = JSON.stringify(getReportColumnDefinitionsById(reportId));
    context.response.writePage(form);
  }


  return { onRequest };
});
