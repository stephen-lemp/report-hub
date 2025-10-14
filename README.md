# Report Runner

Report Runner is a SuiteCloud Development Framework (SDF) project that delivers a configurable Suitelet for running and visualising NetSuite reports. Each report is defined by a custom record that allows you to wire up Saved Searches or SuiteQL, configure filters, render charts, and export results.

## Features

- **Configurable Suitelet** – Deploy the included Suitelet and pass a report configuration id to render interactive reports.
- **Flexible Data Sources** – Run reports backed by either Saved Searches or SuiteQL statements.
- **Dynamic Filters** – Describe the filters you want to expose using JSON, and they will render on the Suitelet automatically with server-side filtering.
- **Charting Support** – Built-in Chart.js integration to display bar, line, pie, or doughnut visualisations.
- **Downloadable Data** – One-click CSV export that respects your current filters.
- **In-app Documentation** – Record-level help text documents how to configure the solution from inside NetSuite.

## Project Structure

```
FileCabinet/
  SuiteScripts/
    ReportRunner/
      report_suitelet.js           # Suitelet implementation
      report_suitelet_client.js    # Client script for front-end controls
Objects/
  customlist_customlist_rr_charttype.xml   # Chart type list values
  customlist_customlist_rr_datasource.xml  # Data source list values
  customrecordtype_customrecord_rr_report.xml # Report configuration custom record type
  script_custscript_rr_report_suitelet.xml     # Suitelet script definition
  scriptdeployment_customdeploy_rr_report_suitelet.xml # Default deployment
manifest.xml
deploy.xml
```

## Getting Started

1. **Install the project** – Deploy the SDF project to your target NetSuite account using SDF CLI or Web IDE.
2. **Deploy the Suitelet** – The included deployment is enabled by default. Adjust roles and audience as needed in NetSuite.
3. **Create report configurations** – Navigate to *Report Runner Configurations* and create a record for each report.
4. **Open the Suitelet** – Launch the Suitelet without parameters to see all available reports, or pass `report={internalId}` in the URL to jump straight to a configuration.

## Configuring Reports

Each report record supports the following key fields:

| Field | Purpose |
| --- | --- |
| **Data Source** | Choose between Saved Search or SuiteQL. |
| **Saved Search** | Reference the saved search to execute when using the Saved Search data source. |
| **SuiteQL** | Provide the SuiteQL text. Use `?` placeholders for parameters supplied by filters. |
| **Chart Type** | Select a visualisation or "None" to omit charts. |
| **Chart Label Field** | Name of the field in the result set to use for chart labels. |
| **Chart Value Field** | Name of the numeric field used for chart values. |
| **Filter Configuration** | JSON array describing filters rendered on the Suitelet. |

### Filter Configuration JSON

Define each filter as an object in the JSON array. Supported properties:

- `id` (string) – Identifier used to reference the filter value.
- `label` (string) – Display label on the form.
- `type` (string) – `text`, `select`, `date`, `checkbox`, `float`, or `integer`.
- `operator` (string, optional) – NetSuite search operator (e.g. `ONORAFTER`, `ANYOF`). Defaults to `CONTAINS` for text and `ANYOF` for select filters.
- `searchField` (string, optional) – Saved search field id used when applying the filter.
- `source` (array, optional) – For select filters, provide option objects `{ value, text }`.
- `suiteqlParamIndex` (number, optional) – Zero-based index of the parameter position for SuiteQL queries.

**Example**

```json
[
  {
    "id": "trandate_from",
    "label": "Start Date",
    "type": "date",
    "operator": "ONORAFTER",
    "searchField": "trandate",
    "suiteqlParamIndex": 0
  },
  {
    "id": "status",
    "label": "Status",
    "type": "select",
    "operator": "ANYOF",
    "searchField": "status",
    "source": [
      { "value": "SalesOrd:A", "text": "Pending Approval" },
      { "value": "SalesOrd:B", "text": "Pending Fulfillment" }
    ]
  }
]
```

## Chart Rendering

Charts are powered by [Chart.js](https://www.chartjs.org/) via CDN. Ensure the target roles have access to external script loading, or host the library locally if your security policy requires it.

## Downloading Results

The Suitelet renders a **Download CSV** button that submits the form with the current filters and returns a CSV file containing the first 2,000 rows from the data set.

## Extending the Solution

- Add additional custom lists or checkboxes to the record type to capture more metadata.
- Build role-specific deployments of the Suitelet by copying and editing the deployment object.
- Swap the Chart.js CDN for an on-account hosted version by updating `CHART_JS_CDN` in `report_suitelet.js`.

## Support

Create issues or pull requests in this repository if you discover bugs or have enhancement ideas.
