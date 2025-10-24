# Report Hub Demonstration

## Highlights

Hello - I'm excited to announce a new tool I've been working on that provide a central repository for all your organization's reports and a way to selectively publish to just the roles that need them

- Why it's special:
  - ✅ It's open source and FREE!
    - Open Source - any developer can improve the source code
    - Free - you won't ever pay a dime for this solution
  - Allows publishing ad-hoc SuiteQL queries for easy wins - tells story
  - ✅ Utilizes full SuiteCloud processing power to run large reports super fast
  - Supports filtering at header level as you would expect
  - ✅ Works on your dashboard or as stand-alone pages

## Basic Pages (using Dashboard)

- List Reports
  - Lists > Search > Report Hub
  - Provides list of all reports
  - Great visualization of all reports in hierarchical structure
  - Limit access to reports so certain roles see only certain reports
  - Search reports and see results instantaneously 
  - Download multiple reports all at once
  - As you can see, a pretty powerful feature right there!
- Run Report
  - Run and display reports - supports 1) your existing saved searches, 2) any ad-hoc suiteQL queries you've been wanting to publish somehow and 3) links to external any other report or page, such as a NetSuite financial report or an external BI report page.
  - This tool provides a central spot right on your dashboard for all the reports you've got.

  - What this tool does is utilize a full SuiteCloud processing power to run large reports super fast when needed
  - You can also use the "Quick Run" feature to run a query or search without using the back-end thread
    - This can be useful when you have smaller reports that do not typically have larger outputs, namely less than 5000 results on a SuiteQL query and less than 4000 results on a Saved Search
  - Now, you can see this tool utilizes header filters to quickly filter your data
    - This power is thanks to an awesome open source tool called Tabulator by a fellow name Oli
  - And finally, I want to show you just how much data this tool can handle

## How can you get it?

You can find contact information on my website at https://stephenlemp.com.
I'm available via DM on LinkedIn, or you can shoot me an email at sl@stephenlemp.com

## Future Plans

Who knows - if this proves popular, we might end up implementing some more features, like charts and graphs or AI help building stuff (if there's a need of course).

## How to Configure Reports

Now, for a bit more techincal information for my admin and developer friends.

### Overall Structure:

To manage report configurations, you go to Setup > Custom > Report Hub Configurations
To publish portlet dashboards, you need to find the portlet in the scripts list and create a deployment
To publish reports as a link in the standard NetSuite centers and tabs navigation, you can create a script deployment with a link.