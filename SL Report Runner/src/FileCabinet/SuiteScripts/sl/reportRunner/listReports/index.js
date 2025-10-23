/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @author Stephen Lemp <sl@stephenlemp.com>
 */
define(['N/query', 'N/runtime', 'N/search'], (query, runtime, search) => {

  function pageInit() {
    renderReportsListing(getReportDefinitions());
  }

  function renderReportsListing(reportDefinitions) {
    formatReportDefinitions(reportDefinitions);
  }

  function getReportDefinitions() {
    return query.runSuiteQL({
      query: `select id, name, custrecord_slrrc_category from 	customrecord_sl_reportrunnerconfig, custrecord_slrrc_externalreportlink external_report_link where isinactive = 'F' AND  CASE 
        WHEN BUILTIN.MNFILTER(custrecord_slrrc_availableto, 'MN_INCLUDE', '', 'TRUE', ?) = 'TRUE' THEN 'T' 
        WHEN NVL(custrecord_slrrc_availabletoall,'F') = 'T' THEN 'T'
        ELSE 'F' END = 'T'`,
      params: [runtime.getCurrentUser().role]
    }).asMappedResults();
  }

  function formatReportDefinitions(reports) {

    const container = document.getElementById("reports-container");
    const sectionMap = new Map();

    function ensureSection(path, title, level) {
      if (!sectionMap.has(path)) {
        // Create heading
        const heading = document.createElement("h" + level);
        heading.textContent = title;
        container.appendChild(heading);

        // Create ul for reports under this heading
        const ul = document.createElement("ul");
        container.appendChild(ul);

        sectionMap.set(path, { ul, heading });
      }
      return sectionMap.get(path).ul;
    }

    reports.forEach(report => {
      let parentUl = container; // container is just placeholder for top-level
      let level = 2;

      if (report.custrecord_slrrc_category) {
        const parts = report.custrecord_slrrc_category.split(":").map(p => p.trim());
        let path = "";
        parts.forEach((part, idx) => {
          path += (idx > 0 ? "__" : "") + part;
          // Ensure section exists
          const ul = ensureSection(path, part, level);
          parentUl = ul; // next report goes into this ul
          level = Math.min(level + 1, 6);
        });
      } else {
        // Reports without category: put them in top-level <ul>
        if (!sectionMap.has("__top")) {
          const ul = document.createElement("ul");
          container.appendChild(ul);
          sectionMap.set("__top", { ul });
        }
        parentUl = sectionMap.get("__top").ul;
      }

      // Add report as <li>
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `${location.href}&action=GET_REPORT_DATA&reportId=${report.id}`;
      a.textContent = report.name;
      li.appendChild(a);
      parentUl.appendChild(li);
    });

  }


  return { pageInit };
});