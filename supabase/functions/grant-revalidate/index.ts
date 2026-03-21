// Supabase Edge Function: grant-revalidate
// POST — Independently validates whether a grant record is a real, live grant.
//
// Validation logic is intentionally different from the initial grant search:
//   1. LINK CHECK  — HEAD/GET the URL, confirm it returns 2xx (not dead/404/redirect-to-homepage)
//   2. CONTENT CHECK — crawl page text, confirm it contains grant-like signals
//   3. AI VERDICT — GPT-4o mini reads the crawled content + stored grant metadata
//      and makes a binary VALIDATED / FAILED decision with objective reasoning.
//
// Result is saved to Grant.validationStatus, Grant.validatedAt, Grant.validationResult.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-revalidate");

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY   = Deno.env.get("OPENAI_API_KEY")!;
const DEMO_COMPANY_ID  = "demo";
const MODEL            = "gpt-4o-mini"; // intentionally cheaper/faster — different model = independent logic

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyAuth(req: Request): boolean {
  const apikey = req.headers.get("apikey");
  const auth   = req.headers.get("Authorization");
  return apikey === SUPABASE_ANON_KEY || (auth?.startsWith("Bearer ") ?? false);
}

// ── Step 1: Link liveness check ───────────────────────────────────────────────

interface LinkResult {
  alive: boolean;
  statusCode: number | null;
  finalUrl: string | null;
  redirectedToRoot: boolean;
}

async function checkLink(url: string): Promise<LinkResult> {
  if (!url?.startsWith("http")) {
    return { alive: false, statusCode: null, finalUrl: null, redirectedToRoot: false };
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GrantValidator/1.0)" },
    });

    const finalUrl = res.url ?? url;

    // Detect redirect-to-root: if final URL is just the domain root and original had a path
    let redirectedToRoot = false;
    try {
      const orig  = new URL(url);
      const final = new URL(finalUrl);
      if (
        orig.pathname.length > 1 &&
        (final.pathname === "/" || final.pathname === "") &&
        orig.hostname === final.hostname
      ) {
        redirectedToRoot = true;
      }
    } catch { /* ignore parse errors */ }

    return {
      alive: res.ok && !redirectedToRoot,
      statusCode: res.status,
      finalUrl,
      redirectedToRoot,
    };
  } catch {
    return { alive: false, statusCode: null, finalUrl: null, redirectedToRoot: false };
  }
}

// ── Step 2: Crawl page content ────────────────────────────────────────────────

async function crawlPage(url: string): Promise<string> {
  if (!url?.startsWith("http")) return "";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GrantValidator/1.0)" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000); // wider context than normal crawl — we need enough to judge
  } catch {
    return "";
  }
}

// ── Step 3: AI grant authenticity check ──────────────────────────────────────

const VALIDATION_SYSTEM_PROMPT = `You are an independent Grant Validation Agent. Your ONLY job is to determine whether a record in a grant database represents a REAL, CURRENTLY ACTIVE grant funding opportunity — or whether it is fake, expired, miscategorised, or not a grant at all.

You must be completely objective. Do not be generous. A grant must meet ALL of the following to pass:
1. It is a real funding opportunity (not a loan, prize, competition, or internal program that is not open to external applicants)
2. There is evidence it is currently accepting applications OR has a future deadline (if the page has no deadline info, give benefit of the doubt ONLY if everything else is clearly a grant)
3. The stored name and funder match the page content (not a redirect to an unrelated page)
4. The URL resolves to a page about this specific grant (not a 404, homepage, or unrelated program)

Return ONLY valid JSON:
{
  "verdict": "VALIDATED" | "FAILED",
  "confidence": <integer 0-100>,
  "reasons": ["<concise reason 1>", "<concise reason 2>"],
  "grantSignals": ["<evidence it IS a grant>"],
  "failSignals": ["<evidence it is NOT a valid grant>"],
  "pageMatchesRecord": <true|false>
}`;

interface AIVerdict {
  verdict: "VALIDATED" | "FAILED";
  confidence: number;
  reasons: string[];
  grantSignals: string[];
  failSignals: string[];
  pageMatchesRecord: boolean;
}

async function aiValidate(opts: {
  grantName: string;
  founder: string | null;
  amount: string | null;
  eligibility: string | null;
  deadlineDate: string | null;
  linkResult: LinkResult;
  pageContent: string;
}): Promise<AIVerdict> {
  const { grantName, founder, amount, eligibility, deadlineDate, linkResult, pageContent } = opts;

  const userPrompt = [
    `## GRANT RECORD TO VALIDATE`,
    `Name: ${grantName}`,
    founder     ? `Funder: ${founder}`                      : "Funder: unknown",
    amount      ? `Stated Amount: ${amount}`                : "",
    eligibility ? `Eligibility: ${eligibility.slice(0, 300)}` : "",
    deadlineDate ? `Deadline: ${deadlineDate}`              : "Deadline: not recorded",
    ``,
    `## LINK CHECK RESULT`,
    `URL alive: ${linkResult.alive}`,
    `HTTP status: ${linkResult.statusCode ?? "timeout/error"}`,
    `Redirected to root: ${linkResult.redirectedToRoot}`,
    `Final URL: ${linkResult.finalUrl ?? "N/A"}`,
    ``,
    pageContent
      ? `## PAGE CONTENT (first 6000 chars)\n${pageContent}`
      : `## PAGE CONTENT\nNo content retrieved — URL failed to load.`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: VALIDATION_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.1, // low temp — we want deterministic objective judgment
      max_tokens: 600,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as AIVerdict;

  // Log AI usage
  try {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await db.from("AiUsageLog").insert({
      model: MODEL,
      feature: "grants_revalidate",
      promptTokens:     data.usage?.prompt_tokens     ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      userId: null,
    });
  } catch { /* non-critical */ }

  return parsed;
}

// ── Serve ─────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!verifyAuth(req)) return json({ error: "Unauthorized" }, 401);
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json();
    const grantId = body.grantId as string;
    if (!grantId) return json({ error: "grantId is required" }, 400);

    // 1. Load grant record
    const { data: grant, error: fetchErr } = await db
      .from("Grant")
      .select("id, companyId, name, url, founder, amount, eligibility, deadlineDate")
      .eq("id", grantId)
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!grant)   return json({ error: "Grant not found" }, 404);

    log.info("Starting revalidation", { grantId: grantId.slice(0, 8), name: grant.name, hasUrl: !!grant.url });

    // 2. Link check — if no URL stored, skip but record as a fail signal
    const linkResult: LinkResult = grant.url
      ? await checkLink(grant.url)
      : { alive: false, statusCode: null, finalUrl: null, redirectedToRoot: false };

    // 3. Crawl page content (only if link is alive)
    const pageContent = linkResult.alive ? await crawlPage(grant.url) : "";

    // 4. AI verdict — always runs, even with no URL (judges on stored data alone)
    const aiVerdict = await aiValidate({
      grantName:   grant.name,
      founder:     grant.founder    ?? null,
      amount:      grant.amount     ?? null,
      eligibility: grant.eligibility ?? null,
      deadlineDate: grant.deadlineDate ?? null,
      linkResult,
      pageContent,
    });

    // 5. Derive final status:
    //    - If URL is dead (not alive, not just missing) → always FAILED regardless of AI
    //    - If URL is missing → rely solely on AI verdict
    //    - If AI says FAILED with confidence >= 60 → FAILED
    //    - Otherwise VALIDATED
    let finalStatus: "VALIDATED" | "FAILED" = aiVerdict.verdict;
    if (grant.url && !linkResult.alive) {
      finalStatus = "FAILED";
      aiVerdict.reasons.unshift(`Link is dead (HTTP ${linkResult.statusCode ?? "timeout"}${linkResult.redirectedToRoot ? ", redirected to homepage" : ""})`);
    }

    const validationResult = {
      validatedAt:        new Date().toISOString(),
      linkAlive:          linkResult.alive,
      linkStatusCode:     linkResult.statusCode,
      redirectedToRoot:   linkResult.redirectedToRoot,
      aiVerdict:          aiVerdict.verdict,
      aiConfidence:       aiVerdict.confidence,
      reasons:            aiVerdict.reasons,
      grantSignals:       aiVerdict.grantSignals,
      failSignals:        aiVerdict.failSignals,
      pageMatchesRecord:  aiVerdict.pageMatchesRecord,
    };

    // 6. Persist to DB
    const { error: updateErr } = await db
      .from("Grant")
      .update({
        validationStatus: finalStatus,
        validatedAt:      new Date().toISOString(),
        validationResult: validationResult,
        updatedAt:        new Date().toISOString(),
      })
      .eq("id", grantId);

    if (updateErr) {
      log.error("DB update failed", { error: String(updateErr), grantId: grantId.slice(0, 8) });
      throw updateErr;
    }

    log.info("Revalidation complete", {
      grantId:   grantId.slice(0, 8),
      name:      grant.name,
      status:    finalStatus,
      linkAlive: linkResult.alive,
      aiConfidence: aiVerdict.confidence,
    });

    return json({
      success:          true,
      validationStatus: finalStatus,
      validationResult,
    });

  } catch (err) {
    log.error("Unhandled error", { error: String(err) });
    return json({ error: String(err) }, 500);
  }
});
