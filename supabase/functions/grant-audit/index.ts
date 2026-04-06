// Supabase Edge Function: grant-audit
// POST — Runs AI audit on a grant draft, saves result to GrantAudit table.
// GET  — Lists saved audits for the company.
// Replaces Next.js /api/grants/audit.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProfileContext, getVaultBlock, buildCriteriaBlock } from "../_shared/grantContext.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-audit");

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY    = Deno.env.get("OPENAI_API_KEY")!;
const DEMO_COMPANY_ID   = Deno.env.get("DEMO_COMPANY_ID") ?? "demo";
const MODEL             = "gpt-4o";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyAuth(req: Request): boolean {
  const apikey = req.headers.get("apikey");
  const auth = req.headers.get("Authorization");
  return apikey === SUPABASE_ANON_KEY || (auth?.startsWith("Bearer ") ?? false);
}


// ── OpenAI caller with retries ───────────────────────────────────────────────

async function callOpenAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const maxRetries = 2;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 2000,
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? "{}",
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    }
    const errText = await res.text();
    lastErr = new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
    if (![429, 500, 502, 503, 504].includes(res.status)) break;
  }
  throw lastErr ?? new Error("OpenAI request failed");
}

// ── Default audit prompt ─────────────────────────────────────────────────────

const DEFAULT_AUDIT_PROMPT = `You are a rigorous, adversarial Grant Application Auditor working on behalf of a professional grant assessor. Your role is to find every weakness, gap, and inaccuracy — not to be encouraging.

## WHAT YOU AUDIT
For each section evaluate four dimensions equally:
1. **Accuracy** — Does the content reflect the organisation's real activities, mission, financials, and team as documented in the vault and profile?
2. **Evidence** — Are all claims backed by specific, verifiable facts from the vault (numbers, dates, names, outcomes)? Vague statements are penalised.
3. **Funder Alignment** — Does the section address the funder's stated priorities and eligibility criteria directly?
4. **Completeness** — Is required content present, or are there conspicuous gaps?
5. **Criteria Coverage** — If FUNDER REQUIREMENTS are provided, does each section address the specific evaluation criteria?

## SCORING RUBRIC — USE THE FULL 0–100 RANGE

Score each section using this scale. Do NOT cluster scores near 80.

| Score | Meaning |
|-------|-------------------------------------------------------------------------|
| 90–100 | Publication-ready. Zero gaps, all claims evidenced, perfectly aligned. Rare. |
| 75–89  | Strong with minor issues. 1–2 small gaps or weak evidence points. |
| 60–74  | Acceptable but needs work. Several vague claims, some misalignment, missing data. |
| 40–59  | Significant problems. Missing key content, unsupported claims, poor funder alignment. |
| 20–39  | Weak. Major gaps, inaccuracies, or content irrelevant to this funder. |
| 0–19   | Placeholder / not written / completely off-topic. |

## DEDUCTION RULES (apply before finalising each score)
Start from 70 as your baseline for a decently written section, then:
- Each vague, unsupported claim (no number, no date, no name): **−5**
- Each factual error or claim that contradicts vault/profile data: **−10**
- Each missing required element for this section type: **−8**
- Each instance of funder language ignored / criteria not addressed: **−7**
- Each repeated statistic or achievement already used in another section: **−5**
- Generic cliché sentence ("passionate about", "committed to excellence", etc.): **−3**

## CALIBRATION NOTE
A well-written but generic section should score ~60. A good section with real specificity scores ~72. Only sections that are genuinely outstanding — with named evidence, tight funder alignment, and zero gaps — should reach 85+. Scores above 90 should be rare.

## OVERALL SCORE
Do NOT calculate overallScore yourself. Set it to 0 — the server will compute it as the mean of section scores.

If FUNDER REQUIREMENTS are provided, also populate criteriaChecks for each criterion.

Return ONLY valid JSON, no markdown:
{
  "overallScore": 0,
  "overallVerdict": "<Excellent | Good | Needs Work | Poor>",
  "summary": "<2-3 sentence plain-English assessment — be direct about the main weaknesses>",
  "sectionAudits": [
    {
      "section": "<section name>",
      "score": <integer 0-100 using the rubric above>,
      "issues": ["<specific, actionable issue — quote the problematic text if helpful>", ...],
      "improvements": ["<concrete improvement citing real vault data, names, or numbers>", ...]
    }
  ],
  "topRecommendations": ["<highest-impact fix 1>", "<highest-impact fix 2>", "<highest-impact fix 3>"],
  "criteriaChecks": [
    {
      "criterion": "<criterion text>",
      "addressed": <true|false>,
      "section": "<which section addresses it, or null>",
      "note": "<brief note on how well it is addressed or what is missing>"
    }
  ]
}`;

// ── Serve ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!verifyAuth(req)) return json({ error: "Unauthorized" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // GET — list saved audits
    if (req.method === "GET") {
      const { data, error } = await db
        .from("GrantAudit")
        .select("id, draftId, grantName, overallScore, overallVerdict, summary, sectionAudits, topRecommendations, improvedAt, createdAt")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("createdAt", { ascending: false })
        .limit(50);
      if (error) throw error;
      return json({ audits: data ?? [] });
    }

    // POST — run audit
    if (req.method === "POST") {
      const body = await req.json();
      const draftId = body.draftId as string;
      if (!draftId) return json({ error: "draftId is required" }, 400);

      // 1. Load draft
      const { data: draft } = await db
        .from("GrantDraft")
        .select("grantId, grantName, sections")
        .eq("id", draftId)
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle();
      if (!draft) return json({ error: "Draft not found" }, 404);

      const grantName = draft.grantName as string;
      const sections = (draft.sections as Record<string, string>) ?? {};

      // 2. Load grant metadata + aiRequirements
      let grantDetails = "";
      let aiRequirements: { criteria?: string[]; evaluationRubric?: string[]; mandatoryRequirements?: string[] } | null = null;
      if (draft.grantId) {
        const { data: grant } = await db
          .from("Grant")
          .select("name, eligibility, founder, amount, geographicScope, howToApply, aiRequirements")
          .eq("id", draft.grantId)
          .maybeSingle();
        if (grant) {
          grantDetails = [
            `Grant: ${grant.name}`,
            grant.founder         ? `Funder: ${grant.founder}` : null,
            grant.amount          ? `Amount: ${grant.amount}` : null,
            grant.eligibility     ? `Eligibility: ${grant.eligibility}` : null,
            grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
            grant.howToApply      ? `How to Apply: ${grant.howToApply}` : null,
          ].filter(Boolean).join("\n");
          aiRequirements = (grant.aiRequirements as typeof aiRequirements) ?? null;
        }
      }

      // 3. Load profile + vault + custom prompt in parallel
      const [{ data: profile }, vaultBlock, { data: promptRow }] = await Promise.all([
        db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
        getVaultBlock(db, DEMO_COMPANY_ID),
        db.from("PromptTemplate")
          .select("systemPrompt")
          .eq("companyId", DEMO_COMPANY_ID)
          .eq("contentType", "grant_audit")
          .order("updatedAt", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const systemPrompt = promptRow?.systemPrompt ?? DEFAULT_AUDIT_PROMPT;
      const profileBlock = profile ? buildProfileContext(profile as Record<string, unknown>) : "";

      // 4. Build draft content block
      const draftBlock = Object.entries(sections)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `### ${k}\n${(v as string).trim()}`)
        .join("\n\n");

      const criteriaBlock = buildCriteriaBlock(aiRequirements);

      const userPrompt = [
        `## GRANT APPLICATION BEING AUDITED: ${grantName}`,
        grantDetails ? `## GRANT DETAILS\n${grantDetails}` : "",
        criteriaBlock,
        profileBlock,
        vaultBlock,
        `## DRAFT APPLICATION CONTENT\n${draftBlock}`,
      ].filter(Boolean).join("\n\n");

      // 5. Call OpenAI
      const result = await callOpenAI({
        systemPrompt,
        userPrompt,
        maxTokens: 3000,
        temperature: 0.3,
      });

      let audit: Record<string, unknown>;
      try {
        audit = JSON.parse(result.content);
      } catch {
        return json({ error: "AI returned invalid JSON" }, 500);
      }

      // ── Server-side score computation ─────────────────────────────────────
      // Recalculate overallScore as mean of section scores — prevents AI
      // inflating the headline number independently of section assessments.
      const sectionAudits = audit.sectionAudits as { score: number }[] | undefined;
      if (sectionAudits && sectionAudits.length > 0) {
        const scores = sectionAudits.map((s) => Math.max(0, Math.min(100, Math.round(s.score ?? 0))));
        const mean   = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        audit.overallScore   = mean;
        audit.overallVerdict =
          mean >= 85 ? "Excellent" :
          mean >= 70 ? "Good" :
          mean >= 50 ? "Needs Work" :
          "Poor";
      }

      // 6. Save audit to DB
      const { data: saved, error: saveErr } = await db
        .from("GrantAudit")
        .insert({
          companyId: DEMO_COMPANY_ID,
          draftId,
          grantName,
          overallScore: audit.overallScore ?? 0,
          overallVerdict: audit.overallVerdict ?? "Poor",
          summary: audit.summary ?? "",
          sectionAudits: audit.sectionAudits ?? [],
          topRecommendations: audit.topRecommendations ?? [],
          criteriaChecks: audit.criteriaChecks ?? [],
          fullResult: audit,
        })
        .select("id")
        .single();
      if (saveErr) log.error("DB save failed", { error: String(saveErr), draftId });

      // 7. Log AI usage
      try {
        await db.from("AiUsageLog").insert({
          model: MODEL,
          feature: "grants_audit",
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          userId: null,
        });
      } catch { /* non-critical */ }

      log.info("Audit complete", { grantName, score: audit.overallScore, auditId: saved?.id ?? null });
      return json({ success: true, audit, auditId: saved?.id ?? null });
    }

    // DELETE — remove a saved audit by ID
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const auditId = url.searchParams.get("id");
      if (!auditId) return json({ error: "id is required" }, 400);
      const { error } = await db
        .from("GrantAudit")
        .delete()
        .eq("id", auditId)
        .eq("companyId", DEMO_COMPANY_ID);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    log.error("Unhandled error", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    return json({ error: String(err) }, 500);
  }
});
