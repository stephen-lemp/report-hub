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
        if (action === 'updateFavorites') {
          context.response.write(JSON.stringify({ success: handleUpdateFavorites(context) }));
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
        return { status: 'COMPLETE', dataLink: getDataLink(requestGuid) };
      } else if (taskStatus.status === task.TaskStatus.FAILED) {
        return { status: 'FAILED', message: 'The report generation task failed.' };
      } else {
        return { status: taskStatus.status, taskId };
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
        return { status: 'COMPLETE', data: results };
      } else {
        const taskId = queryText ? initiateQueryTask(queryText, requestGuid) :
          initiateSearchTask(savedSearchId, requestGuid);
        return { status: 'QUERY_INITIATED', taskId };
      }

    }
  }

  function getDataLink(requestGuid) {
    return query.runSuiteQL({
      query: `SELECT url FROM file WHERE name = ?`,
      params: [`${requestGuid}.csv`]
    }).asMappedResults()[0]?.url || '';
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
      searchId: savedSearchId,
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

    const reportOptions = search.lookupFields({
      type: 'customrecord_sl_reportrunnerconfig',
      id: reportId,
      columns: ['custrecord_slrr_tabulatoroptions', 'name']
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

    form.addField({
      id: 'custpage_tabulatoroptions',
      type: serverWidget.FieldType.LONGTEXT,
      label: 'Tabulator Options'
    })
      .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN })
      .defaultValue = reportOptions.custrecord_slrr_tabulatoroptions || '{}';

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
