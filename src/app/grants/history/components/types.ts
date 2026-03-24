export type GrantOutcome = "Won" | "Submitted" | "Rejected" | "Shortlisted" | "NotSubmitted" | "Exploratory" | "Active" | "Pending";

export interface GrantHistoryRow {
  id: string;
  companyId: string;
  funderName: string;
  grantName?: string | null;
  partnerOrg?: string | null;
  region?: string | null;
  outcome?: GrantOutcome | null;
  amount?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
  createdAt: string;
}

export const OUTCOME_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Won:          { label: "Won",           bg: "bg-green-100",   text: "text-green-800" },
  Active:       { label: "Active",        bg: "bg-blue-100",    text: "text-blue-800" },
  Submitted:    { label: "Submitted",     bg: "bg-orange-100",  text: "text-orange-700" },
  Pending:      { label: "Pending",       bg: "bg-yellow-100",  text: "text-yellow-700" },
  Shortlisted:  { label: "Shortlisted",   bg: "bg-purple-100",  text: "text-purple-700" },
  Rejected:     { label: "Rejected",      bg: "bg-red-100",     text: "text-red-700" },
  NotSubmitted: { label: "Not Submitted", bg: "bg-gray-100",    text: "text-gray-600" },
  Exploratory:  { label: "Exploratory",   bg: "bg-teal-100",    text: "text-teal-700" },
};

export const ALL_OUTCOMES = Object.keys(OUTCOME_CONFIG);
export const ALL_REGIONS = ["Africa", "Southeast Asia", "Philippines", "Europe", "North America", "Global"];

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}
