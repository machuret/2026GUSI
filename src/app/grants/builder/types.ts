export interface Grant {
  id: string;
  name: string;
  founder?: string | null;
  amount?: string | null;
  deadlineDate?: string | null;
  matchScore?: number | null;
  aiVerdict?: string | null;
  url?: string | null;
  decision?: string | null;
}

export interface WritingBrief {
  funderPriorities: string[];
  keyThemes: string[];
  eligibilityStrengths: string[];
  eligibilityRisks: string[];
  suggestedAsk: string;
  toneGuidance: string;
  winningAngle: string;
  keywordsToUse: string[];
}

export interface SavedDraft {
  id: string;
  grantId: string;
  grantName: string;
  tone: string;
  length: string;
  updatedAt: string;
}

export const ALL_SECTIONS = [
  "Cover Letter",
  "Executive Summary",
  "Organisational Background",
  "Needs Statement",
  "Goals & Objectives",
  "Project Description & Narrative",
  "Evaluation Plan",
  "Budget & Budget Narrative",
  "Sustainability Plan",
  "Appendices & Supporting Documents",
] as const;

export type SectionName = typeof ALL_SECTIONS[number];

export type Tone = "first_person" | "third_person";
export type Length = "concise" | "standard" | "detailed";

export const SECTION_META: Record<SectionName, { icon: string; hint: string }> = {
  "Cover Letter":                      { icon: "✉️",  hint: "1–3 paragraphs: who, ask, fit, close" },
  "Executive Summary":                 { icon: "📋",  hint: "Concise overview — need, solution, ask, impact" },
  "Organisational Background":         { icon: "🏢",  hint: "Mission, history, achievements, track record" },
  "Needs Statement":                   { icon: "🎯",  hint: "Evidence-based problem — data, urgency, human impact" },
  "Goals & Objectives":                { icon: "✅",  hint: "2–3 goals + 4–6 SMART objectives with KPIs" },
  "Project Description & Narrative":   { icon: "📐",  hint: "Who, what, when, where, why, how — full methodology" },
  "Evaluation Plan":                   { icon: "📊",  hint: "Quantitative + qualitative metrics, reporting cadence" },
  "Budget & Budget Narrative":         { icon: "💰",  hint: "Line-item costs + justification for every dollar" },
  "Sustainability Plan":               { icon: "🌱",  hint: "Revenue model, partnerships, post-grant continuation" },
  "Appendices & Supporting Documents": { icon: "📎",  hint: "Biosketches, letters of support, legal docs, financials" },
};

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function downloadTxt(
  grantName: string,
  sections: Record<string, string>,
  enabled: readonly SectionName[],
) {
  const lines = [
    `GRANT APPLICATION — ${grantName.toUpperCase()}`,
    `Generated: ${new Date().toLocaleString()}`,
    "=".repeat(70),
    "",
  ];
  for (const s of enabled) {
    if (sections[s]) {
      lines.push("=".repeat(70), s.toUpperCase(), "=".repeat(70), "", sections[s], "", "");
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  a.download = `grant-${grantName.toLowerCase().replace(/\s+/g, "-")}.txt`;
  a.click();
}
