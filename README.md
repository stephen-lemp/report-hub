# Report Runner

Report Runner is a SuiteCloud Development Framework (SDF) project that delivers a configurable Suitelet for running and visualising NetSuite reports. Each report is defined by a custom record that allows you to wire up Saved Searches or SuiteQL, configure filters, and export results.

## Features

- **Fast Big Query Execution** - Suitelet utilizes NetSuites `N/task` module to run suiteQL queries with lightning speed.
- **Report Listing Page** - Display list of all reports published to your role with one-click access.
- **Saved Search AND SuiteQL Reports** – Provides single location for users to run all Saved Search and SuiteQL reports.
- **Downloadable Data** – One-click CSV export.
- **In-app Documentation** – Record-level help text documents how to configure the solution from inside NetSuite.

## Project Structure

- **Report Runner - Main** - Suitelet deployment added under Lists > Search to allow users to find list of reports published to their role.
- **Report Runner Config** - Custom Record to configure and publish reports.
- **Report Runner Column** - Custom Record to specify column information such as formatting and filtering.

## Getting Started

1. **Install the project** – Deploy the SDF project to your target NetSuite account using SDF CLI or Web IDE.
2. **Deploy the Suitelet** – The included deployment is enabled by default. Adjust roles and audience as needed in NetSuite.
3. **Create report configurations** – Navigate to *Report Runner Configurations* and create a record for each report.
4. **Open the Suitelet** – Launch the Suitelet without parameters to see all available reports, or pass `report={internalId}` in the URL to jump straight to a configuration.

## Configuring Reports

Each report record supports the following key fields:

| Field                | Purpose                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Saved Search**     | Reference the saved search to execute when using the Saved Search data source.                                                                                                               |
| **SuiteQL**          | Provide the SuiteQL text.                                                                                                                                                                    |
| **Small Report**     | Indicates this is a small report that can be run without the help of a background thread. This implies maximium 4000 results for saved searches and maximum 5000 results for SuiteQL queries |
| **Category**         | The category this search should appear under in the main reports listing.                                                                                                                    |
| **Available To**     | List of roles that this report is published to.                                                                                                                                              |
| **Available To All** | Checkbox indicating all roles have access to this report                                                                                                                                     |

### Report Runner Columns

*Report Runner Columns* allow you to override certain things about a report column.

| Field                        | Purpose                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Id                           | Identifies column of query or search result this column definition applies to |
| Title                        | Override the title of this column                                             |
| Header Filter                | Apply a header filter so users can filter by this column                      |
| Header Filter Options (JSON) | JSON options to pass the header filter                                        |
| Formatter                    | Provides a hint about how to format this column                               |
| Formatter Params             |                                                                               |
| Sorter                       |                                                                               |
| Sorter Params                |                                                                               |

Params are expected as JSON objects. You might find this tool useful to get valid JSON: https://transform.tools/js-object-to-json

The Luxon date library is pre-loaded, so you can do things like sort by date

- For information on Header Filter options, see Tabulator [Header Filter](https://tabulator.info/docs/6.3/filter#header) documentation.
  - Common options provided by Tabulator are:
    - input
    - date
    - list
  - Custom Options available are:
    - DATE_RANGE
- For information on Formatter options, see Tabulator [Builtin Formatters](https://tabulator.info/docs/6.3/format#format-builtin)
  - Common options provided by Tabulator are:
    - money
    - html
    - link
    - tickCross
    - toggle
    - rownum
- For information on Sorter options see Tabulator [Sorting Data](https://tabulator.info/docs/6.3/sort)

## Downloading Results

The Suitelet renders a **Download CSV** button that submits the form with the current filters and returns a CSV file containing all rows from the dataset

## Extending the Solution

- Add additional custom lists or checkboxes to the record type to capture more metadata.
- Build role-specific deployments of the Suitelet by copying and editing the deployment object.
- Swap the Chart.js CDN for an on-account hosted version by updating `CHART_JS_CDN` in `report_suitelet.js`.

## Upcoming Features

Checkout the list of planned enhancements and bug fixes in the [GitHub Issue Tracker](https://github.com/stephen-lemp/report-runner/issues?q=is%3Aissue%20state%3Aopen%20label%3Aplanned)

## Support

Create issues or pull requests in this repository if you discover bugs or have enhancement ideas.
