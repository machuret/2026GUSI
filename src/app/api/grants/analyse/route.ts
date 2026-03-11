export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getCompanyContext, getVaultContext } from "@/lib/aiContext";
import { stripHtml } from "@/lib/htmlUtils";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const bodySchema = z.object({
  grantId: z.string().min(1),
});

async function crawlGrantUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, 8000);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    // Allow service-role key auth for internal/webhook calls (Supabase Edge Function)
    const authHeader = req.headers.get("authorization") ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isServiceCall = serviceKey && authHeader === `Bearer ${serviceKey}`;

    let authUser: { id: string } | null = null;
    if (!isServiceCall) {
      const { user, response: authError } = await requireAuth();
      if (authError) return authError;
      authUser = user;
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
      crawledContent = await crawlGrantUrl(grant.url as string);
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
    const profileLines = profile ? [
      profile.orgType ? `Organisation Type: ${profile.orgType}` : null,
      profile.sector ? `Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}` : null,
      profile.location ? `Location: ${profile.location}, ${profile.country ?? "Australia"}` : null,
      profile.stage ? `Stage: ${profile.stage}` : null,
      profile.teamSize ? `Team Size: ${profile.teamSize}` : null,
      profile.annualRevenue ? `Annual Revenue: ${profile.annualRevenue}` : null,
      (profile.focusAreas as string[] | null)?.length ? `Focus Areas: ${(profile.focusAreas as string[]).join(", ")}` : null,
      profile.targetFundingMin != null || profile.targetFundingMax != null
        ? `Target Funding: $${profile.targetFundingMin ?? 0} – $${profile.targetFundingMax ?? "Any"}` : null,
      profile.preferredDuration ? `Preferred Duration: ${profile.preferredDuration}` : null,
      profile.isRegisteredCharity ? "Registered Charity: Yes" : null,
      profile.indigenousOwned ? "Indigenous-owned: Yes" : null,
      profile.womanOwned ? "Woman-owned: Yes" : null,
      profile.regionalOrRural ? "Regional/Rural: Yes" : null,
      profile.missionStatement ? `\nMission Statement:\n${profile.missionStatement}` : null,
      profile.keyActivities ? `\nKey Activities:\n${profile.keyActivities}` : null,
      profile.uniqueStrengths ? `\nUnique Strengths:\n${profile.uniqueStrengths}` : null,
      profile.pastGrantsWon ? `\nPast Grants Won:\n${profile.pastGrantsWon}` : null,
    ].filter(Boolean) : [];

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
      profileLines.length > 0 ? `## GRANT PROFILE\n${profileLines.join("\n")}` : "",
      company.block,
      vault.block,
      crawledContent
        ? `## LIVE GRANT PAGE CONTENT (crawled from ${grant.url})\nUse this to verify eligibility criteria, funder priorities, and application requirements:\n\n${crawledContent}`
        : "",
    ].filter(Boolean);

    const masterContext = contextParts.join("\n\n");

    // ── Prompt ────────────────────────────────────────────────────────────
    const systemPrompt = `You are a grant eligibility analyst. You will be given a company's full profile and a grant opportunity with rich context (including the funder's own website content when available). Your job is to assess how likely this company is to successfully win this grant.

Analyse the following dimensions (each scored roughly equally):
1. Mission/purpose alignment — does the company's work match what the grant funds?
2. Geographic eligibility — is the company in the right location?
3. Sector/industry fit — does the grant target this company's sector?
4. Stage/size fit — is the company at the right stage or scale?
5. Eligibility criteria — does the company meet stated requirements?
6. Competitive positioning — how strong is the company's case vs typical applicants?
7. Timeline feasibility — can the company realistically prepare and submit by the deadline?

Important rules:
- If the grant deadline has EXPIRED, automatically set verdict to "Not Eligible" and score to 0, noting the deadline has passed.
- If the deadline is within 7 days, factor in whether a quality application is realistically achievable.
- Be specific about WHY something is a strength or gap — generic advice is not useful.
- If live grant page content is provided, use it as the PRIMARY source for eligibility criteria and funder priorities — it is more current than our stored data.
- Cite specific evidence from the company profile, vault documents, or grant page to support your assessment.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "verdict": "<one of: Strong Fit | Good Fit | Possible Fit | Weak Fit | Not Eligible>",
  "summary": "<2-3 sentence plain-English summary of the assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "gaps": ["<specific gap or risk 1>", "<specific gap or risk 2>"],
  "recommendation": "<one concrete, actionable step to improve chances of winning>"
}`;

    const userPrompt = `Assess this company's likelihood of winning this grant.\n\n${masterContext}`;

    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.grantsAnalyse,
      maxTokens: 800,
      temperature: 0.3,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.grantsAnalyse,
      feature: "grants_analyse",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      userId: authUser?.id,
    });

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(result.content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // ── Persist full analysis to Grant record ─────────────────────────────
    const score = typeof analysis.score === "number" ? Math.min(100, Math.max(0, Math.round(analysis.score))) : null;
    const verdict = typeof analysis.verdict === "string" ? analysis.verdict : null;
    const decision = verdict === "Strong Fit" || verdict === "Good Fit" ? "Apply"
      : verdict === "Not Eligible" ? "No" : "Maybe";

    await db.from("Grant").update({
      aiScore: score,
      aiVerdict: verdict,
      aiAnalysis: analysis,
      decision,
      updatedAt: new Date().toISOString(),
    }).eq("id", grantId);

    return NextResponse.json({ success: true, analysis, decision });
  } catch (err) {
    return handleApiError(err, "Grant Analyse");
  }
}
