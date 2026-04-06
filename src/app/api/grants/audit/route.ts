export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getVaultContext } from "@/lib/aiContext";
import { buildProfileContext } from "@/lib/grantCrawl";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const DEFAULT_AUDIT_PROMPT = `You are a rigorous, adversarial Grant Application Auditor working on behalf of a professional grant assessor. Your role is to find every weakness, gap, and inaccuracy — not to be encouraging.

## WHAT YOU AUDIT
For each section evaluate four dimensions equally:
1. **Accuracy** — Does the content reflect the organisation's real activities, mission, financials, and team as documented in the vault and profile?
2. **Evidence** — Are all claims backed by specific, verifiable facts from the vault (numbers, dates, names, outcomes)? Vague statements are penalised.
3. **Funder Alignment** — Does the section address the funder's stated priorities and eligibility criteria directly?
4. **Completeness** — Is required content present, or are there conspicuous gaps?

## SCORING RUBRIC — USE THE FULL 0–100 RANGE

Score each section using this scale. Do NOT cluster scores near 80.

| Score | Meaning |
|-------|---------|
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
Do NOT calculate overallScore yourself. Set it to 0 — the server will compute it as the weighted mean of section scores.

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
  "topRecommendations": ["<highest-impact fix 1>", "<highest-impact fix 2>", "<highest-impact fix 3>"]
}`;

// POST /api/grants/audit
// Body: { draftId: string } OR { grantId: string, sections: Record<string,string>, grantName: string }
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();

    // ── Input size guards ──────────────────────────────────────────────────
    if (body.sections && typeof body.sections === "object") {
      const sectionKeys = Object.keys(body.sections);
      if (sectionKeys.length > 20) {
        return NextResponse.json({ error: "Too many sections (max 20)" }, { status: 400 });
      }
      const totalChars = Object.values(body.sections as Record<string, string>)
        .reduce((sum, v) => sum + (typeof v === "string" ? v.length : 0), 0);
      if (totalChars > 150_000) {
        return NextResponse.json({ error: "Section content exceeds maximum allowed size" }, { status: 400 });
      }
    }

    let grantName = "";
    let sections: Record<string, string> = {};
    let grantDetails = "";

    // Load from saved draft by ID
    if (body.draftId) {
      const { data: draft } = await db
        .from("GrantDraft")
        .select("grantId, grantName, sections")
        .eq("id", body.draftId)
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle();
      if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      grantName = draft.grantName;
      sections  = (draft.sections as Record<string, string>) ?? {};

      // Fetch grant metadata
      const { data: grant } = await db.from("Grant").select("name, eligibility, founder, amount, geographicScope, howToApply")
        .eq("id", draft.grantId).maybeSingle();
      if (grant) {
        grantDetails = [
          `Grant: ${grant.name}`,
          grant.founder    ? `Funder: ${grant.founder}` : null,
          grant.amount     ? `Amount: ${grant.amount}` : null,
          grant.eligibility ? `Eligibility: ${grant.eligibility}` : null,
          grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
          grant.howToApply  ? `How to Apply: ${grant.howToApply}` : null,
        ].filter(Boolean).join("\n");
      }
    } else if (body.sections && body.grantName) {
      grantName = body.grantName;
      sections  = body.sections;
      if (body.grantId) {
        const { data: grant } = await db.from("Grant").select("name, eligibility, founder, amount, geographicScope, howToApply")
          .eq("id", body.grantId).eq("companyId", DEMO_COMPANY_ID).maybeSingle();
        if (grant) {
          grantDetails = [
            `Grant: ${grant.name}`,
            grant.founder         ? `Funder: ${grant.founder}` : null,
            grant.amount          ? `Amount: ${grant.amount}` : null,
            grant.eligibility     ? `Eligibility: ${grant.eligibility}` : null,
            grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
            grant.howToApply      ? `How to Apply: ${grant.howToApply}` : null,
          ].filter(Boolean).join("\n");
        }
      }
    } else {
      return NextResponse.json({ error: "Provide draftId or sections + grantName" }, { status: 400 });
    }

    // Load grant profile
    const [{ data: profile }, vault] = await Promise.all([
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      getVaultContext(DEMO_COMPANY_ID),
    ]);

    // Load custom audit prompt from PromptTemplate if one exists
    const { data: promptRow } = await db
      .from("PromptTemplate")
      .select("systemPrompt")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("contentType", "grant_audit")
      .order("updatedAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    const systemPrompt = promptRow?.systemPrompt ?? DEFAULT_AUDIT_PROMPT;

    // Build profile block
    const profileBlock = profile ? buildProfileContext(profile as Record<string, unknown>) : "";

    // Build draft content block
    const draftBlock = Object.entries(sections)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `### ${k}\n${v.trim()}`)
      .join("\n\n");

    const userPrompt = [
      `## GRANT APPLICATION BEING AUDITED: ${grantName}`,
      grantDetails ? `## GRANT DETAILS\n${grantDetails}` : "",
      profileBlock ? `## ORGANISATION PROFILE\n${profileBlock}` : "",
      vault.block  ? vault.block : "",
      `## DRAFT APPLICATION CONTENT\n${draftBlock}`,
    ].filter(Boolean).join("\n\n");

    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.grantsAnalyse,
      maxTokens: 2000,
      temperature: 0.3,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.grantsAnalyse,
      feature: "grants_audit",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    let audit: Record<string, unknown>;
    try {
      audit = JSON.parse(result.content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // ── Server-side score computation ─────────────────────────────────────────
    // Recalculate overallScore as mean of section scores — prevents AI inflating
    // the headline number independently of the section-level assessments.
    const sectionAudits = audit.sectionAudits as { score: number }[] | undefined;
    if (sectionAudits && sectionAudits.length > 0) {
      const scores = sectionAudits.map((s) => Math.max(0, Math.min(100, Math.round(s.score ?? 0))));
      const mean = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      audit.overallScore = mean;
      // Derive verdict from computed score so it's always consistent
      audit.overallVerdict =
        mean >= 85 ? "Excellent" :
        mean >= 70 ? "Good" :
        mean >= 50 ? "Needs Work" :
        "Poor";
    }

    return NextResponse.json({ success: true, audit });
  } catch (err) {
    return handleApiError(err, "Grant Audit");
  }
}
