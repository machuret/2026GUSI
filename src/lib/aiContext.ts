/**
 * aiContext.ts — Shared AI context loader
 *
 * Single source of truth for injecting company info, vault documents, and FAQs
 * into every AI tool: content generator, bulk, A/B, revise, voices, chatbot, etc.
 *
 * All functions are parallel-safe and budget-capped to avoid blowing context windows.
 */

import { db } from "./db";
import { DEMO_COMPANY_ID } from "./constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompanyContext {
  companyName: string;
  industry: string;
  website: string;
  block: string; // pre-formatted prompt block, empty string if nothing found
}

export interface VaultContext {
  docs: { filename: string; content: string }[];
  block: string; // pre-formatted prompt block
}

export interface FAQContext {
  faqs: { question: string; answer: string; category: string }[];
  block: string; // pre-formatted prompt block
}

// ── Company context ───────────────────────────────────────────────────────────

/**
 * Loads Company + CompanyInfo for a given companyId and returns a formatted
 * prompt block. Falls back to DEMO_COMPANY_ID if companyId is not provided.
 */
export async function getCompanyContext(companyId?: string): Promise<CompanyContext> {
  const id = companyId ?? DEMO_COMPANY_ID;

  const [{ data: company }, { data: info }] = await Promise.all([
    db.from("Company").select("name, industry, website").eq("id", id).maybeSingle(),
    db.from("CompanyInfo").select("*").eq("companyId", id).maybeSingle(),
  ]);

  const parts: string[] = [];

  if (company?.name)       parts.push(`Company: ${company.name}`);
  if (company?.industry)   parts.push(`Industry: ${company.industry}`);
  if (company?.website)    parts.push(`Website: ${company.website}`);
  if (info?.products)      parts.push(`Products/Services: ${info.products}`);
  if (info?.values)        parts.push(`Values: ${info.values}`);
  if (info?.corePhilosophy) parts.push(`Philosophy: ${info.corePhilosophy}`);
  if (info?.founders)      parts.push(`Founders/Team: ${info.founders}`);
  if (info?.history)       parts.push(`History: ${info.history}`);
  if (info?.achievements)  parts.push(`Achievements: ${info.achievements}`);
  if (info?.hashtags)      parts.push(`Brand hashtags: ${info.hashtags}`);

  // bulkContent is the "Writing DNA" — most important, goes last so it anchors the block
  if (info?.bulkContent)   parts.push(`\nWRITING DNA (follow this precisely):\n${info.bulkContent}`);

  const block = parts.length > 0
    ? `## COMPANY INFORMATION\n${parts.join("\n")}`
    : "";

  return {
    companyName: company?.name ?? "the company",
    industry: company?.industry ?? "",
    website: company?.website ?? "",
    block,
  };
}

// ── Vault context ─────────────────────────────────────────────────────────────

const VAULT_BUDGET_CHARS = 12_000; // ~3k tokens — keeps context window safe

/**
 * Loads vault documents for a companyId and returns a budget-capped prompt block.
 */
export async function getVaultContext(companyId?: string): Promise<VaultContext> {
  const id = companyId ?? DEMO_COMPANY_ID;

  const { data: docs } = await db
    .from("Document")
    .select("filename, content")
    .eq("companyId", id)
    .order("createdAt", { ascending: false })
    .limit(10);

  if (!docs || docs.length === 0) return { docs: [], block: "" };

  let budget = VAULT_BUDGET_CHARS;
  const chunks: string[] = [];

  for (const doc of docs) {
    if (budget <= 0) break;
    const chunk = doc.content.slice(0, Math.min(2000, budget));
    budget -= chunk.length;
    chunks.push(`--- ${doc.filename} ---\n${chunk}`);
  }

  const block = chunks.length > 0
    ? `## KNOWLEDGE VAULT\nUse this reference material to inform your content — facts, figures, and details should come from here:\n\n${chunks.join("\n\n")}`
    : "";

  return { docs: docs ?? [], block };
}

// ── FAQ context ───────────────────────────────────────────────────────────────

/**
 * Loads active FAQs for a given botId (chatbot) or companyId (content tools).
 * For content tools pass companyId — it loads FAQs from the default bot for that company.
 * For chatbot pass botId directly.
 */
export async function getFAQContext(opts: {
  botId?: string;
  companyId?: string;
  category?: string;
  limit?: number;
}): Promise<FAQContext> {
  const { category, limit = 20 } = opts;

  // Resolve botId: if not given, find the default active bot for the company
  let botId = opts.botId;
  if (!botId) {
    const companyId = opts.companyId ?? DEMO_COMPANY_ID;
    const { data: bot } = await db
      .from("ChatBot")
      .select("id")
      .eq("companyId", companyId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    botId = bot?.id;
  }

  if (!botId) return { faqs: [], block: "" };

  let query = db
    .from("ChatFAQ")
    .select("question, answer, category")
    .eq("botId", botId)
    .eq("active", true)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (category && category !== "general") {
    query = query.or(`category.eq.${category},category.eq.general`);
  }

  const { data: faqs } = await query;

  if (!faqs || faqs.length === 0) return { faqs: [], block: "" };

  const block = `## FREQUENTLY ASKED QUESTIONS\nUse these exact answers when a question matches — do not paraphrase:\n\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}`;

  return { faqs, block };
}

// ── Combined loader ───────────────────────────────────────────────────────────

/**
 * Loads all three contexts in parallel. Use this in AI routes for maximum efficiency.
 * Returns pre-formatted blocks ready to append to any system prompt.
 */
export async function loadAIContext(opts: {
  companyId?: string;
  botId?: string;
  faqCategory?: string;
  includeVault?: boolean;
  includeFAQ?: boolean;
}): Promise<{
  company: CompanyContext;
  vault: VaultContext;
  faq: FAQContext;
  /** Concatenated block — append directly to any system prompt */
  fullBlock: string;
}> {
  const {
    companyId,
    botId,
    faqCategory,
    includeVault = true,
    includeFAQ = true,
  } = opts;

  const [company, vault, faq] = await Promise.all([
    getCompanyContext(companyId),
    includeVault ? getVaultContext(companyId) : Promise.resolve({ docs: [], block: "" }),
    includeFAQ
      ? getFAQContext({ companyId, botId, category: faqCategory })
      : Promise.resolve({ faqs: [], block: "" }),
  ]);

  const fullBlock = [company.block, vault.block, faq.block]
    .filter(Boolean)
    .join("\n\n");

  return { company, vault, faq, fullBlock };
}
