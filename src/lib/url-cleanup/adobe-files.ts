export const ADOBE_FILES: Array<{
  file: string;
  segment: string;
  kind: "traffic" | "leads";
  slug: string;
  name: string;
}> = [
  { file: "BR-386375_-_AM.xlsx", segment: "AM", kind: "traffic", slug: "adobe_am_traffic", name: "Adobe AM Traffic" },
  { file: "BR-386375_-_AM_-_Leads.xlsx", segment: "AM", kind: "leads", slug: "adobe_am_leads", name: "Adobe AM Leads" },
  { file: "BR-386375_-_WM.xlsx", segment: "WM", kind: "traffic", slug: "adobe_wm_traffic", name: "Adobe WM Traffic" },
  { file: "BR-386375_-_WM_-_Leads.xlsx", segment: "WM", kind: "leads", slug: "adobe_wm_leads", name: "Adobe WM Leads" },
  { file: "BR-386375_-_IB.xlsx", segment: "IB", kind: "traffic", slug: "adobe_ib_traffic", name: "Adobe IB Traffic" },
  { file: "BR-386375_-_IB_-_Leads.xlsx", segment: "IB", kind: "leads", slug: "adobe_ib_leads", name: "Adobe IB Leads" },
  { file: "BR-386375_-_About_us.xlsx", segment: "About_us", kind: "traffic", slug: "adobe_about_us_traffic", name: "Adobe About us Traffic" },
  { file: "BR-386375_-_About_us_-_Leads.xlsx", segment: "About_us", kind: "leads", slug: "adobe_about_us_leads", name: "Adobe About us Leads" },
  { file: "BR-386375_-_Swiss_website.xlsx", segment: "Swiss_website", kind: "traffic", slug: "adobe_swiss_traffic", name: "Adobe Swiss website Traffic" },
  { file: "BR-386375_-_Swiss_website_-_Leads.xlsx", segment: "Swiss_website", kind: "leads", slug: "adobe_swiss_leads", name: "Adobe Swiss website Leads" },
];
