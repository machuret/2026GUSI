import type { Grant as FullGrant } from "@/hooks/GrantsContext";

export type Grant = Pick<FullGrant, "id" | "name" | "founder" | "amount" | "deadlineDate" | "matchScore" | "aiVerdict" | "url" | "decision" | "crmStatus" | "aiBrief" | "geographicScope" | "complexityLabel" | "fitScore">;

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
  "Contact Details",
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
  "Contact Details":                    { icon: "📞",  hint: "Your name, position, organisation, contact information" },
};

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export async function downloadPdf(
  grantName: string,
  sections: Record<string, string>,
  enabled: readonly SectionName[],
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const marginTop = 25;
  const marginBot = 20;
  const usableW = pageW - marginL - marginR;
  let y = marginTop;

  const addPage = () => { doc.addPage(); y = marginTop; };
  const checkSpace = (needed: number) => { if (y + needed > pageH - marginBot) addPage(); };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`Grant Application`, marginL, y);
  y += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(grantName, marginL, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`, marginL, y);
  doc.setTextColor(0);
  y += 10;

  // Divider
  doc.setDrawColor(200);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  for (const s of enabled) {
    const text = sections[s];
    if (!text?.trim()) continue;

    // Section heading
    checkSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(40, 80, 160);
    doc.text(s, marginL, y);
    y += 2;
    doc.setDrawColor(40, 80, 160);
    doc.line(marginL, y, marginL + doc.getTextWidth(s), y);
    y += 6;

    // Section body — wrap paragraphs
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30);
    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para.replace(/\n/g, " "), usableW) as string[];
      for (const line of lines) {
        checkSpace(5);
        doc.text(line, marginL, y);
        y += 4.5;
      }
      y += 3; // paragraph gap
    }
    y += 5; // section gap
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 10, { align: "center" });
  }

  doc.save(`grant-${grantName.toLowerCase().replace(/\s+/g, "-")}.pdf`);
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
