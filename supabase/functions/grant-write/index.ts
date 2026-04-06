/**
 * grant-write — Supabase Edge Function
 *
 * Handles one mode:
 *   section → generate a single grant section (streaming text)
 *
 * For Intelligence Brief / Requirements, use the grant-brief Edge Function.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProfileContext, buildCriteriaBlock, crawlUrl, getFunderTemplateBlock, getSemanticVaultBlock, getCompanyBlock, getLessonsBlock, getExamplesBlock } from "../_shared/grantContext.ts";
import { callOpenAIStream } from "../_shared/openai.ts";
import { WORD_TARGETS, MAX_TOKEN_TARGETS, EMPHASIS_MAP, getSectionInstruction } from "../_shared/sectionPrompts.ts";
import { buildGrantContext, buildGusiFacts, buildDateContextBlock } from "../_shared/grantBuilders.ts";
import { verifyRequest } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-write");

// ── Environment ───────────────────────────────────────────────────────────────

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY    = Deno.env.get("OPENAI_API_KEY")!;
const DEMO_COMPANY_ID   = Deno.env.get("DEMO_COMPANY_ID") ?? "demo";

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
    // ── Auth: verify JWT via Supabase Auth ───────────────────────────────
    const auth = await verifyRequest(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await req.json() as Record<string, unknown>;
    const { grantId, mode, section: rawSection } = body;
    if (!grantId || typeof grantId !== "string") return json({ error: "grantId required" }, 400);
    if (mode !== "section") return json({ error: "mode must be section. Use grant-brief for brief/requirements." }, 400);
    if (!rawSection || typeof rawSection !== "string") return json({ error: "section required" }, 400);

    // ── Parallel data fetch ────────────────────────────────────────────────
    const [grantRes, profileRes, company] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyBlock(db, DEMO_COMPANY_ID),
    ]);
    if (!grantRes.data) return json({ error: "Grant not found" }, 404);
    const grant   = grantRes.data as Record<string, unknown>;
    const profile = profileRes.data as Record<string, unknown> | null;

    const crawledContent = grant.url ? await crawlUrl(grant.url as string, 12000) : "";

    // ── Fetch context ──────────────────────────────────────────────────────
    const [examplesBlock, funderTemplateBlock, lessonsBlock] = await Promise.all([
      getExamplesBlock(db, DEMO_COMPANY_ID, rawSection),
      getFunderTemplateBlock(db, DEMO_COMPANY_ID, (grant.founder as string | null) ?? null),
      getLessonsBlock(db, DEMO_COMPANY_ID, "grant"),
    ]);

    const profileBlock   = profile ? buildProfileContext(profile) : "";
    const grantBlock     = buildGrantContext(grant);
    const gusiFactsBlock = buildGusiFacts(profile, company);
    const dateContextBlock = buildDateContextBlock(grant);

    // ── MODE: section ──────────────────────────────────────────────────────
    const section           = rawSection;
    const brief             = body.brief as Record<string, unknown> | undefined;
    const tone              = (body.tone              as string | undefined) ?? "first_person";
    const length            = (body.length            as string | undefined) ?? "standard";
    const previousSections  = (body.previousSections  as Record<string, string> | undefined) ?? {};
    const customInstructions = body.customInstructions as string | undefined;
    const regenNote          = body.regenNote          as string | undefined;
    const requirements       = body.requirements       as Record<string, unknown> | undefined;

    if (!brief) return json({ error: "brief required in section mode" }, 400);

    // ── Contact Details: assembled directly from profile, no AI ───────────
    if (section === "Contact Details") {
      const contacts = (profile?.contacts as { name: string; role?: string; email?: string; phone?: string }[] | null);
      const lines: string[] = [];
      if (contacts?.length) {
        contacts.forEach((c, i) => {
          lines.push(i === 0 ? "PRIMARY CONTACT" : `ADDITIONAL CONTACT ${i + 1}`);
          lines.push(`Name: ${c.name}`);
          if (c.role)  lines.push(`Position: ${c.role}`);
          if (c.email) lines.push(`Email: ${c.email}`);
          if (c.phone) lines.push(`Phone: ${c.phone}`);
          lines.push("");
        });
      } else {
        if (profile?.contactName)    lines.push(`Name: ${profile.contactName}`);
        if (profile?.contactRole)    lines.push(`Position: ${profile.contactRole}`);
        if (profile?.contactEmail)   lines.push(`Email: ${profile.contactEmail}`);
        if (profile?.contactPhone)   lines.push(`Phone: ${profile.contactPhone}`);
        if (profile?.contactAddress) lines.push(`Address: ${profile.contactAddress}`);
      }
      const content = lines.filter(Boolean).join("\n").trim()
        || "Please complete your Grant Profile contact details to populate this section.";
      return new Response(content, {
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // ── Semantic vault for this section ────────────────────────────────────
    const vaultBlock = await getSemanticVaultBlock(
      db, DEMO_COMPANY_ID,
      `${grant.name as string} ${section} ${(brief?.keyThemes as string[] | undefined)?.join(" ") ?? ""}`,
      OPENAI_API_KEY,
    );

    // Override masterContext's basic vault with semantic version
    const sectionMasterContext = [
      grantBlock, gusiFactsBlock, profileBlock, funderTemplateBlock, company.block,
      lessonsBlock, vaultBlock,
      crawledContent ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\n${crawledContent}` : "",
    ].filter(Boolean).join("\n\n");

    const wordTarget  = WORD_TARGETS[length]      ?? 300;
    const maxTokens   = MAX_TOKEN_TARGETS[length]  ?? 1200;
    const toneInstruction = tone === "first_person"
      ? 'Write in first person ("We are…", "Our organisation…", "We will…")'
      : 'Write in third person ("The organisation is…", "The team will…")';

    // ── Criteria / requirements block ──────────────────────────────────────
    const reqObj = requirements ?? (grant.aiRequirements as Record<string, unknown> | null) ?? {};
    const criteriaBlock = buildCriteriaBlock({
      criteria:             (reqObj.criteria             as string[] | undefined) ?? [],
      evaluationRubric:     (reqObj.evaluationRubric     as string[] | undefined) ?? [],
      mandatoryRequirements: (reqObj.mandatoryRequirements as string[] | undefined) ?? [],
    });

    // ── Focus emphasis block ───────────────────────────────────────────────
    const focusAreaObj = brief.focusArea as { primary?: string; tags?: string[] } | undefined;
    const focusPrimary = focusAreaObj?.primary?.trim();
    const focusTags    = focusAreaObj?.tags?.filter(Boolean) ?? [];
    const emphasisRule = focusPrimary ? EMPHASIS_MAP[focusPrimary] : null;
    const focusEmphasisBlock = emphasisRule
      ? `\n\n## CONTENT EMPHASIS FOR THIS GRANT TYPE: ${focusPrimary}${focusTags.length > 0 ? ` (${focusTags.join(", ")})` : ""}\nLEAD WITH: ${emphasisRule.lead}\nSUPPRESS OR MINIMISE: ${emphasisRule.suppress}\nUSE THESE DOMAIN KEYWORDS: ${emphasisRule.keywords}\nThis is a ${focusPrimary} grant — every paragraph should reinforce this framing.`
      : "";

    const suggestedAsk = (brief.suggestedAsk as string | undefined)?.trim() || null;
    const briefBlock = `## STRATEGIC WRITING BRIEF${suggestedAsk ? `\n⚠ REQUESTED FUNDING AMOUNT (LOCKED): ${suggestedAsk} — every section MUST use this exact figure.` : ""}
Funder Priorities: ${(brief.funderPriorities as string[] | undefined)?.join(", ") ?? "N/A"}
Key Themes: ${(brief.keyThemes as string[] | undefined)?.join(", ") ?? "N/A"}
Winning Angle: ${brief.winningAngle ?? "N/A"}
Tone Guidance: ${brief.toneGuidance ?? "N/A"}
Keywords to use: ${(brief.keywordsToUse as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Strengths: ${(brief.eligibilityStrengths as string[] | undefined)?.join(", ") ?? "N/A"}
Eligibility Risks to address: ${(brief.eligibilityRisks as string[] | undefined)?.join(", ") ?? "N/A"}${criteriaBlock ? `\n\n${criteriaBlock}` : ""}`;

    // ── Previously written sections (anti-repetition context) ──────────────
    let prevSectionsBlock = "";
    if (previousSections && Object.keys(previousSections).length > 0) {
      const entries = Object.entries(previousSections).map(([name, text]) => {
        const words   = text.trim().split(/\s+/).length;
        const preview = text.slice(0, 2500).trim();
        return `### ${name} (${words} words)\n${preview}${text.length > 2500 ? "…" : ""}`;
      });
      prevSectionsBlock = `\n\n## PREVIOUSLY WRITTEN SECTIONS\nCRITICAL — do NOT reuse any statistic, dollar figure, program name, achievement, or anecdote that already appears here. Each section must introduce only new information.\n${entries.join("\n\n")}`;
    }

    const systemPrompt = `You are a professional grant writer with 15 years of experience winning competitive grants. You write compelling, specific, evidence-based applications that speak directly to funders' priorities.

WRITING RULES:
- ${toneInstruction}
- MAXIMUM word count: ${wordTarget} words — stop the moment your point is made. Never pad or repeat to reach a length.
- Mirror the funder's own language and keywords back to them
- Be specific — names, numbers, dates, outcomes — never vague
- Every claim must be grounded in the data provided
- Do NOT use generic grant-writing clichés ("passionate about", "committed to excellence")
- Write flowing prose, not bullet points (unless the section calls for a list)
- This section will be read by a grant assessor — make it easy to assess against criteria${focusEmphasisBlock}
- NO REPETITION: every statistic, achievement, or example may appear in only ONE section
- DATE ACCURACY (critical): all dates and timelines must be grounded in the DATE CONTEXT block — never use past dates as future ones, never guess a year
- NUMBERS INTEGRITY (critical): never invent specific figures unless explicitly stated in the GUSI FACTS, vault, or profile. If a number is not documented, describe impact qualitatively or state data collection is underway${suggestedAsk ? `
- FUNDING CONSISTENCY (critical): The total funding request is ${suggestedAsk}. Every section must state this same figure. Never reference a different amount.${section === "Budget & Budget Narrative" ? ` For this Budget section, all line items MUST sum exactly to ${suggestedAsk}.` : ""}` : ""}${examplesBlock ? "\n- Study the REFERENCE EXAMPLES provided — match their quality, specificity, and professional tone. Do NOT copy them directly." : ""}${customInstructions ? `\n\nPERMANENT SECTION INSTRUCTIONS (applied every time this section is generated — follow closely):\n${customInstructions}` : ""}${regenNote ? `\n\nONE-SHOT REGEN NOTE (for this regeneration only — override or extend the permanent instructions above as needed):\n${regenNote}` : ""}`;

    const userPrompt = `Write the "${section}" section of this grant application.

SECTION INSTRUCTIONS:
${getSectionInstruction(section)}

${dateContextBlock}

${briefBlock}

FULL CONTEXT:
${sectionMasterContext}

Write only the section content — no heading, no preamble. Just the prose.
IMPORTANT: Reference the organisation by its real name, mention specific programs, real team members, and real achievements from the GUSI FACTS block.${examplesBlock ? `\n\n${examplesBlock}` : ""}${prevSectionsBlock}`;

    // ── Stream response ────────────────────────────────────────────────────
    log.info("Streaming section", { section, grantId: grantId.slice(0, 8) });
    const stream = callOpenAIStream(systemPrompt, userPrompt, maxTokens, 0.45);
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (err) {
    log.error("Unhandled error", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    return json({ error: String(err) }, 500);
  }
});
