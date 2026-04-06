/**
 * _shared/grantData.ts
 * Database query helpers that load supporting context for grant AI generation.
 *
 * Each function fetches one type of supporting data and returns a formatted
 * prompt block (or empty string when no data is found).
 *
 * Exports:
 *  - getCompanyBlock        — Company + CompanyInfo prompt block
 *  - getLessonsBlock        — active Lesson rules prompt block
 *  - getExamplesBlock       — GrantExample reference block
 *  - getFunderTemplateBlock — FunderTemplate preferences block
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Company ───────────────────────────────────────────────────────────────────

/**
 * Loads Company + CompanyInfo rows and returns a formatted prompt block
 * alongside the raw `name` and `website` fields for use in other builders.
 *
 * @param db         Service-role Supabase client.
 * @param companyId  Company to load.
 */
export async function getCompanyBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ name: string; website: string; block: string }> {
  const [{ data: company }, { data: info }] = await Promise.all([
    db.from("Company").select("name, industry, website").eq("id", companyId).maybeSingle(),
    db.from("CompanyInfo").select("*").eq("companyId", companyId).maybeSingle(),
  ]);
  const parts: string[] = [];
  if (company?.name)        parts.push(`Company: ${company.name}`);
  if (company?.industry)    parts.push(`Industry: ${company.industry}`);
  if (company?.website)     parts.push(`Website: ${company.website}`);
  if (info?.products)       parts.push(`Products/Services: ${info.products}`);
  if (info?.values)         parts.push(`Values: ${info.values}`);
  if (info?.corePhilosophy) parts.push(`Philosophy: ${info.corePhilosophy}`);
  if (info?.founders)       parts.push(`Founders/Team: ${info.founders}`);
  if (info?.history)        parts.push(`History: ${info.history}`);
  if (info?.achievements)   parts.push(`Achievements: ${info.achievements}`);
  if (info?.bulkContent)    parts.push(`\nWRITING DNA:\n${info.bulkContent}`);
  return {
    name:    company?.name    ?? "the organisation",
    website: company?.website ?? "",
    block: parts.length > 0 ? `## COMPANY INFORMATION\n${parts.join("\n")}` : "",
  };
}

// ── Lessons ───────────────────────────────────────────────────────────────────

/**
 * Loads active Lesson rules for a company and returns a `## LEARNED RULES` block.
 * Lessons are sorted by severity (high first) and optionally filtered by
 * `contentType` — includes lessons with no contentType (global) plus the matched type.
 *
 * @param db          Service-role Supabase client.
 * @param companyId   Company to load lessons for.
 * @param contentType Optional filter, e.g. `"grant"`.
 */
export async function getLessonsBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
  contentType?: string,
): Promise<string> {
  const { data: lessons } = await db
    .from("Lesson")
    .select("feedback, severity, contentType")
    .eq("companyId", companyId)
    .eq("active", true)
    .order("severity", { ascending: false })
    .limit(50);
  if (!lessons || lessons.length === 0) return "";

  type LessonRow = { feedback: string; severity: string; contentType: string | null };
  const filtered: LessonRow[] = contentType
    ? (lessons as LessonRow[]).filter((l) => !l.contentType || l.contentType === contentType)
    : (lessons as LessonRow[]);
  if (filtered.length === 0) return "";

  const lines = filtered.map((l) => {
    const p = l.severity === "high" ? "MUST" : l.severity === "medium" ? "SHOULD" : "PREFER";
    return `- [${p}] ${l.feedback}`;
  });
  return `## LEARNED RULES (apply these to every response)\n${lines.join("\n")}`;
}

// ── Grant examples ────────────────────────────────────────────────────────────

/**
 * Loads up to 3 GrantExample rows and returns a `## REFERENCE EXAMPLES` block.
 * Prioritises examples matching `sectionFilter` (or "Full Application"), then
 * falls back to all examples if no match is found.
 *
 * @param db            Service-role Supabase client.
 * @param companyId     Company to load examples for.
 * @param sectionFilter Optional section name to prefer (e.g. `"Project Description"`).
 */
export async function getExamplesBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
  sectionFilter?: string,
): Promise<string> {
  const { data: examples } = await db
    .from("GrantExample")
    .select("*")
    .eq("companyId", companyId)
    .order("updatedAt", { ascending: false })
    .limit(20);
  if (!examples || examples.length === 0) return "";

  type Example = Record<string, unknown>;
  let relevant: Example[] = sectionFilter
    ? (examples as Example[]).filter(
        (e) => e.section === sectionFilter || e.section === "Full Application",
      )
    : (examples as Example[]);
  if (relevant.length === 0) relevant = examples as Example[];

  const top = relevant.slice(0, 3);
  const blocks = top.map((e, i) => {
    const header = [`EXAMPLE ${i + 1}: ${e.title}`];
    if (e.grantName) header.push(`Grant: ${e.grantName}`);
    if (e.funder)    header.push(`Funder: ${e.funder}`);
    if (e.outcome)   header.push(`Outcome: ${e.outcome}`);
    if (e.notes)     header.push(`Why it worked: ${e.notes}`);
    const content = typeof e.content === "string" ? (e.content as string).slice(0, 2000) : "";
    return `${header.join(" | ")}\n${content}`;
  });
  return `## REFERENCE EXAMPLES (study tone, structure, and specificity)\n\n${blocks.join("\n\n---\n\n")}`;
}

// ── Funder template ───────────────────────────────────────────────────────────

/**
 * Loads a matching FunderTemplate for a company and returns a formatted
 * `## FUNDER TEMPLATE` block. Matches by exact name, substring, or superset.
 * Returns an empty string when no template or no match is found.
 *
 * @param db          Service-role Supabase client.
 * @param companyId   Company to search templates for.
 * @param funderName  The funder name from the Grant row.
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
