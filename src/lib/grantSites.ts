export interface GrantSite {
  id: string;
  name: string;
  url: string;
  region: string;
  description: string;
}

export const KNOWN_GRANT_SITES: GrantSite[] = [
  {
    id: "grants_gov",
    name: "Grants.gov (US Federal)",
    url: "https://www.grants.gov/search-grants",
    region: "United States",
    description: "All US federal grant opportunities",
  },
  {
    id: "instrumentl",
    name: "Instrumentl Grant Database",
    url: "https://www.instrumentl.com/grants",
    region: "United States",
    description: "Curated grants for nonprofits",
  },
  {
    id: "grantconnect",
    name: "GrantConnect (Australia)",
    url: "https://www.grants.gov.au/Go/List",
    region: "Australia",
    description: "Australian Government grants portal",
  },
  {
    id: "business_gov_au",
    name: "Business.gov.au Grants",
    url: "https://business.gov.au/grants-and-programs",
    region: "Australia",
    description: "Australian business grants and programs",
  },
  {
    id: "ukri",
    name: "UKRI Funding Finder",
    url: "https://www.ukri.org/opportunity/",
    region: "UK",
    description: "UK Research and Innovation funding",
  },
  {
    id: "innovate_uk",
    name: "Innovate UK Smart Grants",
    url: "https://www.ukri.org/councils/innovate-uk/",
    region: "UK",
    description: "UK innovation and R&D grants",
  },
  {
    id: "eu_funding",
    name: "EU Funding & Tenders Portal",
    url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/grant-offers",
    region: "Europe",
    description: "European Commission grant opportunities",
  },
  {
    id: "candid",
    name: "Candid Foundation Directory",
    url: "https://candid.org/find-funding",
    region: "Global",
    description: "Foundation grants and philanthropy",
  },
  {
    id: "devex",
    name: "Devex Funding",
    url: "https://www.devex.com/funding",
    region: "Global",
    description: "International development funding",
  },
  {
    id: "ungm",
    name: "UN Global Marketplace",
    url: "https://www.ungm.org/Public/Notice",
    region: "Global",
    description: "UN grants and procurement",
  },
];
