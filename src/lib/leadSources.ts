export interface SourceField {
  key: string;
  label: string;
  type: "text" | "number" | "tags";
  placeholder?: string;
  default?: number;
  min?: number;
  max?: number;
}

export interface ScrapeSrc {
  id: string;
  label: string;
  actorId: string;
  description: string;
  inputFields: SourceField[];
  buildInput: (fields: Record<string, unknown>) => Record<string, unknown>;
}

export const SCRAPE_SOURCES: ScrapeSrc[] = [
  {
    id: "linkedin",
    label: "LinkedIn Profiles",
    actorId: "od6RadQV98FOARtrp",
    description: "Search LinkedIn for people by keyword, job title, or company",
    inputFields: [
      { key: "keywords", label: "Keywords (comma-separated)", type: "tags", placeholder: "nurse, cardiologist, CEO" },
      { key: "limit", label: "Max results", type: "number", default: 10, min: 1, max: 100 },
    ],
    buildInput: (fields) => ({
      action: "get-profiles",
      keywords: fields.keywords ?? [],
      isUrl: false,
      isName: false,
      limit: fields.limit ?? 10,
    }),
  },
  {
    id: "doctolib",
    label: "Doctolib Doctors",
    actorId: "giovannibiancia/doctolib-scraper",
    description: "Scrape doctor profiles from Doctolib (France)",
    inputFields: [
      { key: "searchUrl", label: "Doctolib search URL", type: "text", placeholder: "https://www.doctolib.fr/medecin-generaliste/paris" },
      { key: "maxItems", label: "Max results", type: "number", default: 20, min: 1, max: 200 },
    ],
    buildInput: (fields) => ({
      startUrls: [{ url: fields.searchUrl }],
      maxItems: fields.maxItems ?? 20,
    }),
  },
  {
    id: "webmd",
    label: "WebMD Doctors",
    actorId: "easyapi/webmd-doctor-scraper",
    description: "Extract doctor profiles from WebMD search results",
    inputFields: [
      { key: "searchUrl", label: "WebMD search URL", type: "text", placeholder: "https://doctor.webmd.com/results?q=cardiologist&city=New+York&state=NY" },
      { key: "maxItems", label: "Max results", type: "number", default: 30, min: 1, max: 200 },
    ],
    buildInput: (fields) => ({
      searchUrls: [fields.searchUrl],
      maxItems: fields.maxItems ?? 30,
    }),
  },
];
