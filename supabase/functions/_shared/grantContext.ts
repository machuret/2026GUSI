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

// ── Semantic vault ────────────────────────────────────────────────────────────

/**
 * Tries semantic vault retrieval via pgvector match_document_chunks RPC.
 * Falls back to getVaultBlock (recent docs) on any failure — safe to call even
 * if the embedding migration has not been run.
 */
export async function getSemanticVaultBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
  taskHint: string,
  openaiApiKey: string,
): Promise<string> {
  try {
    const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: taskHint }),
    });
    if (!embedRes.ok) throw new Error("embedding failed");
    const embedData = await embedRes.json();
    const embedding: number[] | undefined = embedData.data?.[0]?.embedding;
    if (!embedding) throw new Error("no embedding");

    const { data: chunks, error: rpcErr } = await db.rpc("match_document_chunks", {
      query_embedding: embedding,
      match_company_id: companyId,
      match_threshold: 0.6,
      match_count: 12,
    } as Record<string, unknown>);
    if (rpcErr || !chunks || chunks.length === 0) throw new Error("no chunks");

    const docIds = Array.from(new Set(chunks.map((c: { documentId: string }) => c.documentId))) as string[];
    const { data: docNames } = await db.from("Document").select("id, filename").in("id", docIds);
    const nameMap = new Map((docNames ?? []).map((d: { id: string; filename: string }) => [d.id, d.filename]));

    let budget = VAULT_BUDGET_CHARS;
    const parts: string[] = [];
    for (const chunk of chunks) {
      if (budget <= 0) break;
      const fname = nameMap.get(chunk.documentId) ?? "Document";
      const text = (chunk.content as string).slice(0, Math.min(2000, budget));
      budget -= text.length;
      parts.push(`--- ${fname} (relevance: ${((chunk.similarity as number) * 100).toFixed(0)}%) ---\n${text}`);
    }
    return parts.length > 0
      ? `## KNOWLEDGE VAULT (semantically matched)\nThe following excerpts are most relevant to this section:\n\n${parts.join("\n\n")}`
      : await getVaultBlock(db, companyId);
  } catch {
    return getVaultBlock(db, companyId);
  }
}

// ── Company ───────────────────────────────────────────────────────────────────

/**
 * Loads Company + CompanyInfo and returns a formatted prompt block.
 */
export async function getCompanyBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ name: string; industry: string; website: string; block: string }> {
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
    name:     company?.name     ?? "the organisation",
    industry: company?.industry ?? "",
    website:  company?.website  ?? "",
    block: parts.length > 0 ? `## COMPANY INFORMATION\n${parts.join("\n")}` : "",
  };
}

// ── Lessons ───────────────────────────────────────────────────────────────────

/**
 * Loads active Lessons for a company and returns a formatted prompt block.
 * Optionally filtered by contentType (loads global + matching type).
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
  const filtered = contentType
    ? (lessons as { feedback: string; severity: string; contentType: string | null }[])
        .filter((l) => !l.contentType || l.contentType === contentType)
    : (lessons as { feedback: string; severity: string; contentType: string | null }[]);
  if (filtered.length === 0) return "";
  const lines = filtered.map((l) => {
    const p = l.severity === "high" ? "MUST" : l.severity === "medium" ? "SHOULD" : "PREFER";
    return `- [${p}] ${l.feedback}`;
  });
  return `## LEARNED RULES (apply these to every response)\n${lines.join("\n")}`;
}

// ── Grant examples ────────────────────────────────────────────────────────────

/**
 * Loads GrantExamples and returns a formatted prompt block.
 * Prioritises examples matching sectionFilter, falls back to all examples.
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
    ? (examples as Example[]).filter((e) => e.section === sectionFilter || e.section === "Full Application")
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
