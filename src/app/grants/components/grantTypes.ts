export type Decision = "Apply" | "Maybe" | "No" | "Rejected";
export type Effort = "Low" | "Medium" | "High";

export interface GrantAnalysis {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

export interface SearchResult {
  name: string;
  founder: string;
  url: string;
  deadlineDate?: string | null;
  geographicScope?: string;
  amount?: string;
  eligibility?: string;
  howToApply?: string;
  projectDuration?: string;
  submissionEffort?: Effort;
  fitReason?: string;
  confidence?: "High" | "Medium" | "Low";
}

export const GEO_SCOPES = [
  "Global", "United States", "UK", "Australia", "Europe", "Asia",
  "Africa", "Sub-Saharan Africa", "Latin America", "Middle East", "Canada",
  "New Zealand", "Singapore", "India", "Germany", "France",
];

export const PROJECT_DURATIONS = [
  "Up to 6 months", "6–12 months", "6–18 months", "6–24 months",
  "1–2 years", "1–3 years", "2–3 years", "Up to 3 years",
  "Up to 5 years", "Ongoing",
];

export const ORG_TYPES = ["Startup", "SME / Small Business", "Large Enterprise", "Non-Profit / NGO", "Social Enterprise", "University / Research Institution", "Individual / Sole Trader", "Government / Public Body", "Indigenous Organisation"];
export const FUNDING_SIZES = ["Under $10,000", "$10,000 – $50,000", "$50,000 – $100,000", "$100,000 – $250,000", "$250,000 – $1M", "Over $1M", "Any amount"];
export const DEADLINE_URGENCIES = ["Open now (any deadline)", "Closing within 30 days", "Closing within 90 days", "Ongoing / rolling", "Annual cycle"];
export const ELIGIBILITY_TYPES = ["For-profit only", "Non-profit only", "Both for-profit and non-profit", "Government entities", "Individuals"];
export const GRANT_TYPES = ["Innovation & R&D", "Social Impact", "Sustainability / Environment", "Health & Medical", "Education & Training", "Arts & Culture", "Women-led / Diversity", "Export & Trade", "Digital & Technology", "Agriculture & Food", "Infrastructure", "Community Development", "Indigenous / First Nations"];
export const APPLICANT_COUNTRIES = ["Australia", "United States", "United Kingdom", "Canada", "New Zealand", "Germany", "France", "Netherlands", "Singapore", "India", "South Africa", "Kenya", "Brazil", "Any country"];

export const DECISION_STYLES: Record<Decision, string> = {
  Apply:    "bg-green-100 text-green-800 border-green-300",
  Maybe:    "bg-yellow-100 text-yellow-800 border-yellow-300",
  No:       "bg-red-100 text-red-700 border-red-300",
  Rejected: "bg-gray-200 text-gray-600 border-gray-400",
};

export const EFFORT_STYLES: Record<Effort, string> = {
  Low:    "bg-blue-50 text-blue-700",
  Medium: "bg-orange-50 text-orange-700",
  High:   "bg-red-50 text-red-700",
};

export const CONFIDENCE_STYLES: Record<string, string> = {
  High:   "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Low:    "bg-gray-100 text-gray-500 border-gray-300",
};

export const VERDICT_STYLES: Record<string, string> = {
  "Strong Fit":   "bg-green-100 text-green-800 border-green-300",
  "Good Fit":     "bg-emerald-100 text-emerald-800 border-emerald-300",
  "Possible Fit": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Weak Fit":     "bg-orange-100 text-orange-800 border-orange-300",
  "Not Eligible": "bg-red-100 text-red-700 border-red-300",
};

export const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
export const labelCls = "mb-1 block text-xs font-medium text-gray-600";

export const EMPTY_FORM = (): {
  name: string; founder: string; url: string; deadlineDate: string; howToApply: string;
  geographicScope: string; eligibility: string; amount: string; projectDuration: string;
  fitScore: number | null; submissionEffort: "Low" | "Medium" | "High" | null;
  decision: "Apply" | "Maybe" | "No" | "Rejected"; notes: string;
} => ({
  name: "", founder: "", url: "", deadlineDate: "", howToApply: "",
  geographicScope: "", eligibility: "", amount: "", projectDuration: "",
  fitScore: null, submissionEffort: null, decision: "Maybe", notes: "",
});
