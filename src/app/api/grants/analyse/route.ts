export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getCompanyContext, getVaultContext } from "@/lib/aiContext";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { crawlGrantUrl, buildProfileContext } from "@/lib/grantCrawl";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  grantId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // Allow service-role key auth for internal/webhook calls (Supabase Edge Function)
    const authHeader = req.headers.get("authorization") ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isServiceCall = serviceKey && authHeader === `Bearer ${serviceKey}`;

    if (!isServiceCall) {
      const { error: authError } = requireEdgeAuth(req);
      if (authError) return authError;
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { grantId } = parsed.data;

    // ── Parallel data fetch ────────────────────────────────────────────────
    const [
      { data: grant, error: grantErr },
      { data: profile },
      company,
      vault,
    ] = await Promise.all([
      db.from("Grant").select("*").eq("id", grantId).maybeSingle(),
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getCompanyContext(DEMO_COMPANY_ID),
      getVaultContext(DEMO_COMPANY_ID),
    ]);

    if (grantErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // ── Crawl grant URL if available ───────────────────────────────────────
    let crawledContent = "";
    if (grant.url) {
      const crawlStart = Date.now();
      crawledContent = await crawlGrantUrl(grant.url as string);
      const crawlMs = Date.now() - crawlStart;
      if (crawlMs > 3000) logger.warn("Grant Analyse", `Slow crawl: ${crawlMs}ms for ${grant.url}`);
    }

    // ── Build grant details block ─────────────────────────────────────────
    const grantLines = [
      `Grant Name: ${grant.name}`,
      grant.founder ? `Funder / Organisation: ${grant.founder}` : null,
      grant.amount ? `Funding Amount: ${grant.amount}` : null,
      grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
      grant.eligibility ? `Eligibility: ${grant.eligibility}` : null,
      grant.howToApply ? `How to Apply: ${grant.howToApply}` : null,
      grant.projectDuration ? `Project Duration: ${grant.projectDuration}` : null,
      grant.notes ? `Notes: ${grant.notes}` : null,
    ].filter(Boolean);

    // ── Build profile block ───────────────────────────────────────────────
    const profileBlock = profile ? buildProfileContext(profile as Record<string, unknown>) : "";

    // ── Deadline context ──────────────────────────────────────────────────
    const deadlineStr = grant.deadlineDate ? (() => {
      const d = new Date(grant.deadlineDate as string);
      const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
      if (days < 0) return `EXPIRED (${Math.abs(days)} days ago)`;
      if (days === 0) return "Due TODAY";
      return `${days} days remaining (${d.toLocaleDateString("en-AU")})`;
    })() : "No deadline specified";

    // ── Assemble context ─────────────────────────────────────────────────
    const contextParts: string[] = [
      `## GRANT DETAILS\n${grantLines.join("\n")}\nDeadline: ${deadlineStr}`,
      profileBlock,
      company.block,
      vault.block,
      crawledContent
        ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\nUse this to verify eligibility criteria, funder priorities, and application requirements:\n\n${crawledContent}`
        : "",
    ].filter(Boolean);

    const masterContext = contextParts.join("\n\n");

    // ── Prompt ────────────────────────────────────────────────────────────
    const systemPrompt = `You are a rigorous grant eligibility analyst. You will be given a company's full profile and a grant opportunity. Your job is to give a precise, calibrated assessment of how likely this company is to WIN this specific grant.

Score each dimension independently (0–100), then compute a weighted average for the final score:
1. Mission/purpose alignment (weight 25%) — does the company's work directly match what the funder prioritises?
2. Geographic eligibility (weight 20%) — is the company definitively in the eligible region?
3. Sector/industry fit (weight 20%) — does the funder explicitly target this company's sector?
4. Stage/size fit (weight 15%) — does the company meet the stage, team size, and revenue requirements?
5. Eligibility criteria (weight 10%) — does the company satisfy every stated requirement?
6. Competitive positioning (weight 10%) — how strong is the application vs typical competition?

SCORE CALIBRATION — use the full 0–100 range honestly:
- 0–15: Ineligible or clearly disqualified (wrong country, wrong sector, expired deadline)
- 16–35: Significant gaps — missing key criteria, weak alignment, long odds
- 36–55: Possible but uncertain — some fit but notable gaps or unknown eligibility factors
- 56–75: Good fit — strong case with minor gaps or competition risk
- 76–90: Very strong fit — meets nearly all criteria, compelling case
- 91–100: Reserve ONLY for near-perfect matches where the company is an ideal candidate

CRITICAL RULES:
- Never default to 80–85 unless the evidence specifically supports it. Most grants should score below 70.
- If the grant deadline has EXPIRED, set score to 0 and verdict to "Not Eligible".
- If the deadline is within 7 days, penalise score by up to 20 points for timeline risk.
- Be specific — cite exact profile fields, grant criteria, or page content. No generic statements.
- If live grant page content is provided, treat it as the PRIMARY source — it overrides stored data.
- A missing profile field (e.g. no location set, no org type) should lower the score, not be ignored.

Verdict mapping:
- Strong Fit: score 76–100
- Good Fit: score 56–75
- Possible Fit: score 36–55
- Weak Fit: score 16–35
- Not Eligible: score 0–15

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "verdict": "<one of: Strong Fit | Good Fit | Possible Fit | Weak Fit | Not Eligible>",
  "summary": "<2-3 sentence plain-English summary of the assessment>",
  "strengths": ["<specific strength citing exact evidence>", "<specific strength>"],
  "gaps": ["<specific gap citing exact missing criterion>", "<specific gap>"],
  "recommendation": "<one concrete, actionable step most likely to improve the score>"
}`;

    const userPrompt = `Assess this company's likelihood of winning this grant.\n\n${masterContext}`;

    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.grantsAnalyse,
      maxTokens: 1200,
      temperature: 0.5,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.grantsAnalyse,
      feature: "grants_analyse",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(result.content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // ── Persist full analysis to Grant record ─────────────────────────────
    const score = typeof analysis.score === "number" ? Math.min(100, Math.max(0, Math.round(analysis.score))) : null;

    // Enforce verdict↔score consistency — AI occasionally returns a mismatched pair.
    // Derive the canonical verdict from the score band so the UI is never contradictory.
    const verdictFromScore = (s: number): string => {
      if (s >= 76) return "Strong Fit";
      if (s >= 56) return "Good Fit";
      if (s >= 36) return "Possible Fit";
      if (s >= 16) return "Weak Fit";
      return "Not Eligible";
    };
    const rawVerdict = typeof analysis.verdict === "string" ? analysis.verdict : null;
    const verdict = score != null ? verdictFromScore(score) : rawVerdict;

    // Only auto-set decision if the user hasn't manually chosen one
    const currentDecision = (grant as Record<string, unknown>).decision as string | null;
    const autoDecision = verdict === "Strong Fit" || verdict === "Good Fit" ? "Apply"
      : verdict === "Not Eligible" ? "No" : "Maybe";
    const decision = currentDecision ?? autoDecision;
    const decisionUpdate = currentDecision ? {} : { decision };

    const { error: updateErr } = await db.from("Grant").update({
      aiScore: score,
      aiVerdict: verdict,
      aiAnalysis: analysis,
      ...decisionUpdate,
      updatedAt: new Date().toISOString(),
    }).eq("id", grantId);

    if (updateErr) {
      logger.error("Grant Analyse", `DB update failed for ${grantId}`, updateErr);
      return NextResponse.json({ error: "Analysis succeeded but failed to save — please try again" }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis: { ...analysis, verdict }, decision });
  } catch (err) {
    return handleApiError(err, "Grant Analyse");
  }
}
