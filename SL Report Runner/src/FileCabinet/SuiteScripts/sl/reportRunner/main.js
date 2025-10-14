/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Stephen Lemp <sl@stephenlemp.com>
 * @description Main entry point for the Report Runner Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/file', 'N/log', 'N/redirect', 'N/runtime', 'N/url', 'N/https'],
  (serverWidget, record, search, file, log, redirect, runtime, url, https) => {

    function onRequest(context) {
      try {
        if (context.request.method === 'GET') { handleGetRequest(context); }
        else { handlePostRequest(context); }
      } catch (e) {
        log.error({ title: 'Error in Report Runner Suitelet', details: e });
        context.response.write('An error occurred: ' + e.message);
      }
    }

    function handleGetRequest(context) {
      context.response.writePage(generateMainPage());
    }

    function generateMainPage() {
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
      return form;
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


    function getFavoriteReports() {
      try {
        const favoriteSearch = search.create({
          type: 'customrecord_sl_reportrunnerconfig',
          filters: [
            ['isinactive', 'is', 'F'],
            'and',
            ['custrecord_sl_rr_isfavorite', 'is', 'T']
          ],
          columns: [
            search.createColumn({ name: 'name', sort: search.Sort.ASC })
          ]
        });

        const results = favoriteSearch.run().getRange({ start: 0, end: 50 });
        return results.map(result => ({
          id: result.id,
          name: result.getValue({ name: 'name' }) || ''
        }));
      } catch (error) {
        log.debug({
          title: 'Favorite reports search failed',
          details: error
        });
        return [];
      }
    }


    function renderFavoritesHtml(reports) {
      if (!reports.length) {
        return '<div class="sl-rr-no-favorites">No favorite reports found.</div>';
      }

      const items = reports.map(report => `<li data-report-id="${report.id}">${escapeHtml(report.name)}</li>`).join('');
      return `<ul class="sl-rr-favorites">${items}</ul>`;
    }


    function escapeHtml(value) {
      const text = value || '';
      return text.replace(/[&<>"']/g, (char) => {
        switch (char) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case '\'': return '&#39;';
          default: return char;
        }
      });
    }


    function handlePostRequest(context) {
      context.response.writePage(generateMainPage());
    }

    return { onRequest };
  });
