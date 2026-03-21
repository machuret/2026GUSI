/**
 * _shared/grantContext.ts
 * Canonical context-builder helpers shared across grant edge functions.
 * Import via: import { buildProfileContext, getVaultBlock, buildCriteriaBlock } from "../_shared/grantContext.ts";
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAULT_BUDGET_CHARS = 12_000;

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * Builds a standardised ## GRANT PROFILE prompt block from a GrantProfile row.
 * Authoritative version — all edge functions must import this instead of
 * maintaining their own copy.
 */
export function buildProfileContext(profile: Record<string, unknown>): string {
  const contacts = profile.contacts as
    | { name: string; role?: string; email?: string; phone?: string }[]
    | null;
  const lines: string[] = [];

  if (contacts?.length) {
    lines.push(`Contacts / Founders:`);
    contacts.forEach((c, i) => {
      const parts = [c.name, c.role, c.email, c.phone].filter(Boolean).join(" | ");
      lines.push(`  ${i + 1}. ${parts}`);
    });
  } else {
    if (profile.contactName)    lines.push(`Contact Name: ${profile.contactName}`);
    if (profile.contactRole)    lines.push(`Contact Role: ${profile.contactRole}`);
    if (profile.contactEmail)   lines.push(`Contact Email: ${profile.contactEmail}`);
    if (profile.contactPhone)   lines.push(`Contact Phone: ${profile.contactPhone}`);
    if (profile.contactAddress) lines.push(`Contact Address: ${profile.contactAddress}`);
  }

  if (profile.orgType)
    lines.push(`Organisation Type: ${profile.orgType}${profile.orgType2 ? ` / ${profile.orgType2}` : ""}`);
  if (profile.sector)
    lines.push(`Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}`);
  if (profile.stage)         lines.push(`Stage: ${profile.stage}`);
  if (profile.teamSize)      lines.push(`Team Size: ${profile.teamSize}`);
  if (profile.annualRevenue) lines.push(`Annual Revenue: ${profile.annualRevenue}`);
  if (profile.location)
    lines.push(`Location: ${profile.location}, ${profile.country ?? "United States"}`);
  if (profile.yearFounded)   lines.push(`Year Founded: ${profile.yearFounded}`);
  if ((profile.focusAreas as string[] | null)?.length)
    lines.push(`Focus Areas: ${(profile.focusAreas as string[]).join(", ")}`);
  if (profile.targetFundingMin != null || profile.targetFundingMax != null)
    lines.push(`Target Funding: $${profile.targetFundingMin ?? 0} – $${profile.targetFundingMax ?? "Any"}`);
  if (profile.preferredDuration)    lines.push(`Preferred Duration: ${profile.preferredDuration}`);
  if (profile.isRegisteredCharity)  lines.push("Registered Charity: Yes");
  if (profile.hasEIN)               lines.push("Has EIN: Yes");
  if (profile.indigenousOwned)      lines.push("Indigenous-owned: Yes");
  if (profile.womanOwned)           lines.push("Woman-owned: Yes");
  if (profile.regionalOrRural)      lines.push("Regional/Rural: Yes");
  if (profile.missionStatement)     lines.push(`\nMission Statement:\n${profile.missionStatement}`);
  if (profile.keyActivities)        lines.push(`\nKey Activities:\n${profile.keyActivities}`);
  if (profile.uniqueStrengths)      lines.push(`\nUnique Strengths:\n${profile.uniqueStrengths}`);
  if (profile.pastGrantsWon)        lines.push(`\nPast Grants Won:\n${profile.pastGrantsWon}`);

  const extraDocs = profile.extraDocs as { title: string; content: string }[] | null;
  if (extraDocs?.length) {
    for (const doc of extraDocs) {
      lines.push(`\n--- ${doc.title} ---\n${doc.content}`);
    }
  }

  return lines.length > 0 ? `## GRANT PROFILE\n${lines.join("\n")}` : "";
}

// ── Vault ─────────────────────────────────────────────────────────────────────

/**
 * Fetches vault documents for a company and returns a budget-capped prompt block.
 */
export async function getVaultBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
): Promise<string> {
  const { data: docs } = await db
    .from("Document")
    .select("filename, content")
    .eq("companyId", companyId)
    .order("createdAt", { ascending: false })
    .limit(10);

  if (!docs || docs.length === 0) return "";

  let budget = VAULT_BUDGET_CHARS;
  const chunks: string[] = [];
  for (const doc of docs) {
    if (budget <= 0) break;
    const chunk = (doc.content as string).slice(0, Math.min(2000, budget));
    budget -= chunk.length;
    chunks.push(`--- ${doc.filename} ---\n${chunk}`);
  }
  return `## KNOWLEDGE VAULT\n${chunks.join("\n\n")}`;
}

// ── Criteria ──────────────────────────────────────────────────────────────────

export interface AiRequirements {
  criteria?: string[];
  evaluationRubric?: string[];
  mandatoryRequirements?: string[];
  wordLimits?: Record<string, number>;
}

/**
 * Converts an aiRequirements object into a prompt block.
 * Returns empty string if no requirements are present.
 */
export function buildCriteriaBlock(req: AiRequirements | null | undefined): string {
  if (!req) return "";
  const parts: string[] = [];
  if (req.criteria?.length)
    parts.push(`Evaluation Criteria (ensure each is addressed):\n${req.criteria.map((c) => `- ${c}`).join("\n")}`);
  if (req.evaluationRubric?.length)
    parts.push(`Scoring Rubric:\n${req.evaluationRubric.map((r) => `- ${r}`).join("\n")}`);
  if (req.mandatoryRequirements?.length)
    parts.push(`Mandatory Requirements (hard gates — must be satisfied):\n${req.mandatoryRequirements.map((r) => `- ${r}`).join("\n")}`);
  return parts.length > 0
    ? `## FUNDER REQUIREMENTS (your writing MUST satisfy these)\n${parts.join("\n\n")}`
    : "";
}

// ── Crawl ─────────────────────────────────────────────────────────────────────

/**
 * Fetches a URL and strips HTML, returning plain text capped at maxChars.
 * Returns empty string on any failure. Protected by AbortSignal timeout.
 */
export async function crawlUrl(url: string, maxChars = 4000): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  } catch {
    return "";
  }
}

// ── Funder template ───────────────────────────────────────────────────────────

/**
 * Loads a matching FunderTemplate and returns a formatted prompt block.
 */
export async function getFunderTemplateBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
  funderName: string | null,
): Promise<string> {
  if (!funderName) return "";
  const { data: templates } = await db
    .from("FunderTemplate")
    .select("funderName, preferences, patterns, avoid, notes")
    .eq("companyId", companyId);
  if (!templates?.length) return "";
  const lower = funderName.toLowerCase();
  const match = templates.find(
    (t: Record<string, unknown>) =>
      typeof t.funderName === "string" &&
      (t.funderName.toLowerCase() === lower ||
        lower.includes(t.funderName.toLowerCase()) ||
        t.funderName.toLowerCase().includes(lower)),
  );
  if (!match) return "";
  const parts = [
    `## FUNDER TEMPLATE — ${match.funderName}\nApply these insights to ensure alignment with this funder's preferences.`,
  ];
  if (match.preferences) parts.push(`What this funder loves:\n${match.preferences}`);
  if (match.patterns)    parts.push(`Winning patterns:\n${match.patterns}`);
  if (match.avoid)       parts.push(`What to AVOID:\n${match.avoid}`);
  if (match.notes)       parts.push(`Notes:\n${match.notes}`);
  return parts.join("\n\n");
}
