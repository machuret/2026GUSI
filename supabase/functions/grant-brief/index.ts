/**
 * grant-brief — Supabase Edge Function
 *
 * Handles two modes:
 *   brief        → Reads 6 data sources, generates strategic writing brief (JSON)
 *   requirements → Extracts funder evaluation criteria from crawled page (JSON)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProfileContext, crawlUrl, getFunderTemplateBlock, getCompanyBlock, getLessonsBlock, getExamplesBlock } from "../_shared/grantContext.ts";
import { callOpenAIJson } from "../_shared/openai.ts";
import { logUsage } from "../_shared/db.ts";
import { FOCUS_CATEGORY_LIST } from "../_shared/sectionPrompts.ts";
import { buildGrantContext, buildGusiFacts, buildDateContextBlock } from "../_shared/grantBuilders.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-brief");

// ── Environment ───────────────────────────────────────────────────────────────

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID  = Deno.env.get("DEMO_COMPANY_ID") ?? "demo";

// ── CORS ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth: just verify a Bearer token is present ─────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ") || authHeader.length < 20) {
      log.warn("Missing or invalid authorization header");
      return json({ error: "Unauthorized" }, 401);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json();
    const { grantId, mode } = body as Record<string, unknown>;
    if (!grantId || typeof grantId !== "string") return json({ error: "grantId required" }, 400);
    if (!mode || !["brief", "requirements"].includes(mode as string))
      return json({ error: "mode must be brief | requirements" }, 400);

    // ── Parallel data fetch ─────────────────────────────────────────────────
    const [grantRes, profileRes, company] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyBlock(db, DEMO_COMPANY_ID),
    ]);
    if (!grantRes.data) return json({ error: "Grant not found" }, 404);
    const grant   = grantRes.data as Record<string, unknown>;
    const profile = profileRes.data as Record<string, unknown> | null;

    const crawledContent = grant.url ? await crawlUrl(grant.url as string, 12000) : "";

    // ── MODE: requirements ──────────────────────────────────────────────────
    if (mode === "requirements") {
      if (!crawledContent || crawledContent.length < 100) {
        return json({
          success: true,
          requirements: { criteria: [], wordLimits: {}, evaluationRubric: [], mandatoryRequirements: [] },
          note: "No crawled content — requirements could not be extracted.",
        });
      }
      const sysPrompt = `You are a grant requirements analyst. Extract structured application requirements from the grant page content provided.\n\nReturn ONLY valid JSON:\n{\n  "criteria": ["<evaluation criterion 1>"],\n  "wordLimits": { "<Section Name>": <word limit as number> },\n  "evaluationRubric": ["<rubric item>"],\n  "mandatoryRequirements": ["<hard requirement>"]\n}\n\nRULES:\n- criteria: things the funder will assess — extract from headings, scoring guides, FAQs. Up to 12.\n- wordLimits: only include if explicit limits are mentioned.\n- evaluationRubric: scoring weights if mentioned.\n- mandatoryRequirements: eligibility hard gates.\n- Never invent criteria not present in the text.`;
      const usrPrompt = `Extract grant requirements from this page.\nGrant: ${grant.name}\nFunder: ${grant.founder ?? "Unknown"}\n\nPAGE CONTENT:\n${crawledContent.slice(0, 12000)}`;
      let requirements: Record<string, unknown> = { criteria: [], wordLimits: {}, evaluationRubric: [], mandatoryRequirements: [] };
      try {
        const result = await callOpenAIJson(sysPrompt, usrPrompt, 800, 0);
        logUsage(db, DEMO_COMPANY_ID, "grants_requirements", result.promptTokens, result.completionTokens);
        requirements = JSON.parse(result.content);
      } catch (reqErr) { log.warn("Requirements extraction failed", { error: String(reqErr) }); }
      await db.from("Grant").update({ aiRequirements: requirements, updatedAt: new Date().toISOString() }).eq("id", grantId);
      return json({ success: true, requirements });
    }

    // ── MODE: brief ─────────────────────────────────────────────────────────
    log.info("Generating Intelligence Brief", { grantId: grantId.slice(0, 8) });

    const [examplesBlock, funderTemplateBlock, lessonsBlock] = await Promise.all([
      getExamplesBlock(db, DEMO_COMPANY_ID, undefined),
      getFunderTemplateBlock(db, DEMO_COMPANY_ID, (grant.founder as string | null) ?? null),
      getLessonsBlock(db, DEMO_COMPANY_ID, "grant"),
    ]);

    const profileBlock    = profile ? buildProfileContext(profile) : "";
    const grantBlock      = buildGrantContext(grant);
    const gusiFactsBlock  = buildGusiFacts(profile, company);

    const dateContextBlock = buildDateContextBlock(grant);

    const masterContext = [
      grantBlock,
      gusiFactsBlock,
      profileBlock,
      funderTemplateBlock,
      company.block,
      lessonsBlock,
      crawledContent ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\n${crawledContent}` : "",
    ].filter(Boolean).join("\n\n");

    const sysPrompt = `You are a senior grant writing strategist. Analyse the grant and organisation data and produce a strategic writing brief.${examplesBlock ? "\n\nYou have been given reference examples of real grant applications. Study their tone, structure, and specificity to inform your brief." : ""}\n\nReturn ONLY valid JSON — no markdown, no explanation:\n{\n  "funderPriorities": ["<priority 1>", "<priority 2>", "<priority 3>"],\n  "keyThemes": ["<theme 1>", "<theme 2>"],\n  "eligibilityStrengths": ["<strength 1>", "<strength 2>"],\n  "eligibilityRisks": ["<risk 1>", "<risk 2>"],\n  "suggestedAsk": "<amount or range to request>",\n  "toneGuidance": "<brief style guidance for this specific funder>",\n  "winningAngle": "<the single most compelling narrative angle — 1-2 sentences>",\n  "keywordsToUse": ["<funder keyword 1>", "<funder keyword 2>", "<funder keyword 3>"],\n  "focusArea": {\n    "primary": "<one of: ${FOCUS_CATEGORY_LIST}>",\n    "tags": ["<specific sub-topic 1>", "<specific sub-topic 2>", "<specific sub-topic 3>"]\n  }\n}\n\nfocusArea rules:\n- primary: pick exactly ONE category from the list\n- tags: 2–4 short, specific sub-topics relevant to this grant`;

    const usrPrompt = `Analyse this grant opportunity and organisation profile, then produce the strategic writing brief.\n\n${dateContextBlock}\n\n${masterContext}${examplesBlock ? `\n\n${examplesBlock}` : ""}`;

    const result = await callOpenAIJson(sysPrompt, usrPrompt, 600, 0.2);
    logUsage(db, DEMO_COMPANY_ID, "grants_write_brief", result.promptTokens, result.completionTokens);

    let brief: Record<string, unknown>;
    try { brief = JSON.parse(result.content); }
    catch { return json({ error: "AI returned invalid brief JSON" }, 500); }

    await db.from("Grant").update({ aiBrief: brief, updatedAt: new Date().toISOString() }).eq("id", grantId);

    log.info("Intelligence Brief complete", { grantId: grantId.slice(0, 8) });
    return json({ success: true, brief, grantName: grant.name });

  } catch (err) {
    log.error("Unhandled error", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    return json({ error: String(err) }, 500);
  }
});
