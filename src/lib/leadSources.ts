export interface SourceField {
  key: string;
  label: string;
  type: "text" | "number" | "tags" | "select";
  placeholder?: string;
  default?: number | string;
  min?: number;
  max?: number;
  options?: string[];
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
    description: "Scrape French doctor profiles from Doctolib by specialty and city",
    inputFields: [
      {
        key: "specialty", label: "Specialty", type: "select",
        options: [
          "medecin-generaliste", "cardiologue", "dermatologue", "gynecologue",
          "ophtalmologue", "pediatre", "psychiatre", "radiologue",
          "rhumatologue", "chirurgien", "neurologue", "gastro-enterologue",
          "endocrinologue", "pneumologue", "urologue", "orthopediste",
        ],
        placeholder: "Select specialty",
      },
      { key: "city", label: "City", type: "text", placeholder: "paris, lyon, marseille, bordeaux…" },
      { key: "maxItems", label: "Max results", type: "number", default: 20, min: 1, max: 200 },
    ],
    buildInput: (fields) => {
      const specialty = (fields.specialty as string) || "medecin-generaliste";
      const city = ((fields.city as string) || "paris").toLowerCase().replace(/\s+/g, "-");
      const url = `https://www.doctolib.fr/${specialty}/${city}`;
      return { startUrls: [{ url }], maxItems: fields.maxItems ?? 20, nation: "fr" };
    },
  },
  {
    id: "webmd",
    label: "WebMD Doctors",
    actorId: "easyapi/webmd-doctor-scraper",
    description: "Scrape US doctor profiles from WebMD by specialty, city and state",
    inputFields: [
      { key: "specialty", label: "Specialty", type: "text", placeholder: "cardiologist, dermatologist, pediatrician…" },
      { key: "city", label: "City", type: "text", placeholder: "New York, Los Angeles, Chicago…" },
      {
        key: "state", label: "State", type: "select",
        options: [
          "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
          "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
          "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
          "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
          "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
        ],
        placeholder: "Select state",
      },
      { key: "maxItems", label: "Max results", type: "number", default: 30, min: 1, max: 200 },
    ],
    buildInput: (fields) => {
      const specialty = encodeURIComponent((fields.specialty as string) || "doctor");
      const city = encodeURIComponent((fields.city as string) || "");
      const state = encodeURIComponent((fields.state as string) || "");
      // Actor requires a WebMD search URL — build it from the user's inputs
      const locationPart = city ? `&city=${city}&state=${state}` : (state ? `&state=${state}` : "");
      const searchUrl = `https://doctor.webmd.com/results?q=${specialty}&d=40&newpatient=false&isvirtualvisit=false&entity=all&gender=all${locationPart}`;
      return {
        searchUrls: [searchUrl],
        maxItems: fields.maxItems ?? 30,
        proxyConfiguration: { useApifyProxy: true },
      };
    },
  },
];
