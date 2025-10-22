/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
 define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/query', 'N/runtime', 'N/file', 'N/url'],
     (ui, search, record, query, runtime, file, url) => {
 
         const CUSTOM_RECORD_TYPE = 'customrecord_rr_report';
         const FILTER_CONFIG_FIELD = 'custrecord_rr_filter_config';
         const DATASOURCE_FIELD = 'custrecord_rr_datasource';
         const SAVED_SEARCH_FIELD = 'custrecord_rr_savedsearch';
         const SUITEQL_FIELD = 'custrecord_rr_suiteql';
         const CHART_TYPE_FIELD = 'custrecord_rr_chart_type';
         const CHART_LABEL_FIELD = 'custrecord_rr_chart_label';
         const CHART_VALUE_FIELD = 'custrecord_rr_chart_value';
         const DESCRIPTION_FIELD = 'custrecord_rr_description';
 
         const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js';
 
         const MAX_RESULTS = 2000;
 
         const chartTypes = {
             none: 'none',
             bar: 'bar',
             line: 'line',
             pie: 'pie',
             doughnut: 'doughnut'
         };
 
         const dataSourceTypes = {
             savedSearch: 'SAVED_SEARCH',
             suiteql: 'SUITEQL'
         };
 
         const ACTION_DOWNLOAD = 'download';
 
         const renderReportCatalog = (context) => {
             const form = ui.createForm({ title: 'Report Runner - Reports' });
             form.addField({
                 id: 'custpage_rr_intro',
                 type: ui.FieldType.INLINEHTML,
                 label: ' ',
                 defaultValue: '<div><p>Select a report configuration to launch.</p></div>'
             });
 
             const sublist = form.addSublist({
                 id: 'custpage_rr_reports',
                 type: ui.SublistType.LIST,
                 label: 'Available Reports'
             });
 
             sublist.addField({ id: 'custpage_rr_report_name', label: 'Report', type: ui.FieldType.TEXT });
             sublist.addField({ id: 'custpage_rr_report_description', label: 'Description', type: ui.FieldType.TEXT });
             sublist.addField({ id: 'custpage_rr_report_link', label: 'Open', type: ui.FieldType.URL }).linkText = 'Open';
 
             const reportSearch = search.create({
                 type: CUSTOM_RECORD_TYPE,
                 filters: [['isinactive', 'is', 'F']],
                 columns: [
                     search.createColumn({ name: 'name' }),
                     search.createColumn({ name: DESCRIPTION_FIELD })
                 ]
             });
 
             let index = 0;
             reportSearch.run().each(result => {
                 const configId = result.id;
                 const name = result.getValue({ name: 'name' });
                 const description = result.getValue({ name: DESCRIPTION_FIELD }) || '';
                 const resolved = url.resolveScript({
                     scriptId: runtime.getCurrentScript().id,
                     deploymentId: runtime.getCurrentScript().deploymentId,
                     params: { report: configId }
                 });
                 sublist.setSublistValue({ id: 'custpage_rr_report_name', line: index, value: name || '' });
                 if (description) {
                     sublist.setSublistValue({ id: 'custpage_rr_report_description', line: index, value: description });
                 }
                 sublist.setSublistValue({ id: 'custpage_rr_report_link', line: index, value: resolved });
                 index += 1;
                 return true;
             });
 
             context.response.writePage(form);
         };
 
         const parseFilterConfiguration = (configText) => {
             if (!configText) {
                 return [];
             }
             try {
                 const parsed = JSON.parse(configText);
                 return Array.isArray(parsed) ? parsed : [];
             } catch (e) {
                 log.error('Invalid filter configuration JSON', e);
                 return [];
             }
         };
 
         const addFilterFieldsToForm = (form, filters, requestParameters) => {
             const group = form.addFieldGroup({ id: 'custpage_rr_filters', label: 'Filters' });
             filters.forEach(filter => {
                 const fieldId = `custpage_filter_${filter.id}`;
                 const fieldType = (filter.type || 'text').toUpperCase();
                 let nsFieldType = ui.FieldType.TEXT;
                 switch (fieldType) {
                     case 'SELECT':
                         nsFieldType = ui.FieldType.SELECT;
                         break;
                     case 'DATE':
                         nsFieldType = ui.FieldType.DATE;
                         break;
                     case 'CHECKBOX':
                         nsFieldType = ui.FieldType.CHECKBOX;
                         break;
                     case 'FLOAT':
                     case 'INTEGER':
                         nsFieldType = ui.FieldType.FLOAT;
                         break;
                     default:
                         nsFieldType = ui.FieldType.TEXT;
                 }
 
                 const field = form.addField({
                     id: fieldId,
                     label: filter.label || filter.id,
                     type: nsFieldType,
                     container: group.id
                 });
                 if (nsFieldType === ui.FieldType.SELECT && filter.source) {
                     field.addSelectOption({ value: '', text: '' });
                     filter.source.forEach(option => {
                         field.addSelectOption(option);
                     });
                 }
                 const value = requestParameters[fieldId] || requestParameters[filter.id];
                 if (value !== undefined && value !== null) {
                     field.defaultValue = value;
                 }
             });
         };
 
         const extractFilterValues = (filters, requestParameters) => {
             return filters.reduce((memo, filter) => {
                 const fieldId = `custpage_filter_${filter.id}`;
                 let value = requestParameters[fieldId];
                 if (value === undefined) {
                     value = requestParameters[filter.id];
                 }
                 if (value !== undefined && value !== '') {
                     memo[filter.id] = value;
                 }
                 return memo;
             }, {});
         };
 
         const runSavedSearch = (searchId, filters, filterValues) => {
             const loadedSearch = search.load({ id: searchId });
             const originalFilters = (loadedSearch.filters || []).slice();
             const columns = (loadedSearch.columns || []).slice();
             const searchType = loadedSearch.searchType;
 
             const additionalFilters = (filters || []).map(filter => {
                 const value = filterValues[filter.id];
                 if (!value) {
                     return null;
                 }
                 const operator = (filter.operator || (filter.type === 'SELECT' ? 'ANYOF' : 'CONTAINS')).toUpperCase();
                 return search.createFilter({
                     name: filter.searchField || filter.id,
                     operator,
                     values: value
                 });
             }).filter(Boolean);
 
             const combinedFilters = originalFilters.concat(additionalFilters);
 
             const createdSearch = search.create({
                 type: searchType,
                 filters: combinedFilters,
                 columns
             });
 
             const results = [];
             const paged = createdSearch.runPaged({ pageSize: 1000 });
             paged.pageRanges.forEach(range => {
                 const page = paged.fetch({ index: range.index });
                 page.data.forEach(result => results.push(result));
             });
             return results.slice(0, MAX_RESULTS).map(result => {
                 const record = {};
                 columns.forEach((column, columnIndex) => {
                     const key = column.label || column.name || column.join || column.summary || `col_${columnIndex}`;
                     record[key] = result.getText(column) || result.getValue(column);
                 });
                 return record;
             });
         };
 
         const runSuiteQL = (suiteQL, filters, filterValues) => {
             if (!suiteQL) {
                 return [];
             }
             const paramMap = {};
             const orderedFilters = (filters || []).filter(filter => filter.suiteqlParamIndex !== undefined && filterValues[filter.id] !== undefined)
                 .sort((a, b) => a.suiteqlParamIndex - b.suiteqlParamIndex);
             orderedFilters.forEach(filter => {
                 paramMap[filter.suiteqlParamIndex] = filterValues[filter.id];
             });
             const params = [];
             const indices = Object.keys(paramMap).map(Number).sort((a, b) => a - b);
             indices.forEach(index => {
                 params[index] = paramMap[index];
             });

             const resultSet = query.runSuiteQL({ query: suiteQL, params });
             const results = resultSet.asMappedResults();
             return results.slice(0, MAX_RESULTS);
         };
 
         const convertToTable = (form, data) => {
             if (!data || data.length === 0) {
                 return '<p class="rr-empty">No results found for the current selection.</p>';
            }
             const headers = Object.keys(data[0]);
             const rowsHtml = data.map(row => {
                 const cells = headers.map(header => `<td>${(row[header] ?? '').toString().replace(/</g, '&lt;')}</td>`).join('');
                 return `<tr>${cells}</tr>`;
             }).join('');
             const headerHtml = headers.map(header => `<th>${header}</th>`).join('');
             return `<table class="rr-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
         };
 
         const buildDownloadCsv = (data) => {
             if (!data || data.length === 0) {
                 return '';
            }
             const headers = Object.keys(data[0]);
             const escapeValue = (value) => {
                 if (value === null || value === undefined) {
                     return '';
                 }
                 const stringValue = value.toString();
                 if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
                     return `"${stringValue.replace(/"/g, '""')}"`;
                 }
                 return stringValue;
             };
             const lines = [headers.join(',')];
             data.forEach(row => {
                 const line = headers.map(header => escapeValue(row[header])).join(',');
                 lines.push(line);
             });
             return lines.join('\n');
         };
 
         const addDownloadButton = (form) => {
             const actionField = form.addField({ id: 'custpage_rr_action', type: ui.FieldType.TEXT, label: 'Action' });
             actionField.updateDisplayType({ displayType: ui.FieldDisplayType.HIDDEN });
             form.addButton({
                 id: 'custpage_rr_download',
                 label: 'Download CSV',
                 functionName: 'onDownload'
             });
             form.clientScriptModulePath = 'SuiteScripts/ReportRunner/report_suitelet_client.js';
         };
 
         const buildChartHtml = (chartType, chartLabelField, chartValueField, data) => {
             if (!chartType || chartType === chartTypes.none || !data || data.length === 0) {
                 return '';
             }
             const labels = [];
             const values = [];
             data.forEach(row => {
                 labels.push(row[chartLabelField]);
                 values.push(Number(row[chartValueField]) || 0);
             });
             const dataset = {
                 labels,
                 values
             };
             const json = JSON.stringify(dataset);
             return `
                 <div class="rr-chart">
                     <canvas id="rrChart"></canvas>
                     <script type="text/javascript">
                         (function() {
                             var data = ${json};
                             function renderChart() {
                                 if (!window.Chart) {
                                     setTimeout(renderChart, 100);
                                     return;
                                 }
                                 var ctx = document.getElementById('rrChart');
                                 if (!ctx) return;
                                 new Chart(ctx, {
                                     type: '${chartType}',
                                     data: {
                                         labels: data.labels,
                                         datasets: [{
                                             label: '${chartValueField}',
                                             data: data.values,
                                             backgroundColor: 'rgba(54, 162, 235, 0.2)',
                                             borderColor: 'rgba(54, 162, 235, 1)',
                                             borderWidth: 1,
                                             fill: ${chartType === chartTypes.line ? 'false' : 'true'}
                                         }]
                                     },
                                     options: {
                                         responsive: true,
                                         maintainAspectRatio: false
                                     }
                                 });
                             }
                             renderChart();
                         })();
                     </script>
                 </div>`;
         };
 
         const addResultsToForm = (form, data, chartType, chartLabelField, chartValueField) => {
             const htmlField = form.addField({
                 id: 'custpage_rr_results',
                 type: ui.FieldType.INLINEHTML,
                 label: 'Results'
             });
             const chartHtml = buildChartHtml(chartType, chartLabelField, chartValueField, data);
             const tableHtml = convertToTable(form, data);
             const styles = `
                 <style>
                     .rr-table { border-collapse: collapse; width: 100%; }
                     .rr-table th, .rr-table td { border: 1px solid #ccc; padding: 4px 8px; }
                     .rr-table th { background-color: #f1f1f1; }
                     .rr-chart { width: 100%; height: 400px; margin-bottom: 16px; }
                     .rr-empty { font-style: italic; color: #666; margin: 12px 0; }
                </style>
                <script src="${CHART_JS_CDN}"></script>
            `;
             htmlField.defaultValue = `${styles}${chartHtml}${tableHtml}`;
         };
 
         const onRequest = (context) => {
             const request = context.request;
             const response = context.response;
             const params = request.parameters;
             const reportId = params.report;
             if (!reportId) {
                 renderReportCatalog(context);
                 return;
             }
 
             const reportConfig = record.load({ type: CUSTOM_RECORD_TYPE, id: reportId });
             const title = reportConfig.getValue({ fieldId: 'name' });
             const description = reportConfig.getValue({ fieldId: DESCRIPTION_FIELD });
             const dataSource = reportConfig.getValue({ fieldId: DATASOURCE_FIELD });
             const savedSearchId = reportConfig.getValue({ fieldId: SAVED_SEARCH_FIELD });
             const suiteQL = reportConfig.getValue({ fieldId: SUITEQL_FIELD });
             const chartType = reportConfig.getValue({ fieldId: CHART_TYPE_FIELD }) || chartTypes.none;
             const chartLabelField = reportConfig.getValue({ fieldId: CHART_LABEL_FIELD });
             const chartValueField = reportConfig.getValue({ fieldId: CHART_VALUE_FIELD });
             const filterConfigText = reportConfig.getValue({ fieldId: FILTER_CONFIG_FIELD });
 
             const filters = parseFilterConfiguration(filterConfigText);
             const filterValues = extractFilterValues(filters, params);
 
             let data = [];
             if (dataSource === dataSourceTypes.savedSearch && savedSearchId) {
                 data = runSavedSearch(savedSearchId, filters, filterValues);
             } else if (dataSource === dataSourceTypes.suiteql) {
                 data = runSuiteQL(suiteQL, filters, filterValues);
             }
 
             if (params.custpage_rr_action === ACTION_DOWNLOAD || params.action === ACTION_DOWNLOAD) {
                 const csv = buildDownloadCsv(data);
                 response.writeFile({
                     file: file.create({
                         name: `${title || 'report'}.csv`,
                         fileType: file.Type.CSV,
                         contents: csv
                     })
                 });
                 return;
             }
 
             const form = ui.createForm({ title: title || 'Report Runner' });
             if (description) {
                 form.addField({
                     id: 'custpage_rr_description',
                     type: ui.FieldType.INLINEHTML,
                     label: 'Description',
                     defaultValue: `<div class="rr-description">${description}</div>`
                 });
             }
 
             addFilterFieldsToForm(form, filters, params);
             addResultsToForm(form, data, chartType, chartLabelField, chartValueField);
             addDownloadButton(form);
 
             response.writePage(form);
         };
 
         return { onRequest };
     });
