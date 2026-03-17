export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getVaultContext } from "@/lib/aiContext";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const DEFAULT_AUDIT_PROMPT = `You are a Grant Application Auditor. Your job is to review a draft grant application and assess its accuracy and quality against the organisation's real information (vault documents and grant profile).

Audit the following dimensions:
1. **Accuracy** — Does the content accurately reflect the organisation's actual activities, mission, financials, and team?
2. **Completeness** — Are there gaps where key information is missing or vague?
3. **Alignment** — Does the application align with the grant's stated eligibility criteria and funder priorities?
4. **Evidence** — Are claims supported by specific, verifiable evidence from the vault?
5. **Improvements** — What concrete improvements can be made based on available vault content?

For each section of the draft, provide:
- An accuracy score (0-100)
- Specific issues found (if any)
- Concrete improvements using real information from the vault

Return ONLY valid JSON in this exact format, no markdown:
{
  "overallScore": <integer 0-100>,
  "overallVerdict": "<Excellent | Good | Needs Work | Poor>",
  "summary": "<2-3 sentence plain-English summary>",
  "sectionAudits": [
    {
      "section": "<section name>",
      "score": <0-100>,
      "issues": ["<specific issue 1>", ...],
      "improvements": ["<concrete improvement 1>", ...]
    }
  ],
  "topRecommendations": ["<priority action 1>", "<priority action 2>", "<priority action 3>"]
}`;

// POST /api/grants/audit
// Body: { draftId: string } OR { grantId: string, sections: Record<string,string>, grantName: string }
export async function POST(req: NextRequest) {
  try {
    const { response: authError, user } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

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
          .eq("id", body.grantId).maybeSingle();
        if (grant) {
          grantDetails = [
            `Grant: ${grant.name}`,
            grant.founder    ? `Funder: ${grant.founder}` : null,
            grant.amount     ? `Amount: ${grant.amount}` : null,
            grant.eligibility ? `Eligibility: ${grant.eligibility}` : null,
            grant.geographicScope ? `Geographic Scope: ${grant.geographicScope}` : null,
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
    const profileBlock = profile ? [
      profile.orgType      ? `Organisation Type: ${profile.orgType}` : null,
      profile.sector       ? `Sector: ${profile.sector}${profile.subSector ? ` / ${profile.subSector}` : ""}` : null,
      profile.location     ? `Location: ${profile.location}, ${profile.country ?? "Australia"}` : null,
      profile.missionStatement ? `\nMission Statement:\n${profile.missionStatement}` : null,
      profile.keyActivities    ? `\nKey Activities:\n${profile.keyActivities}` : null,
      profile.uniqueStrengths  ? `\nUnique Strengths:\n${profile.uniqueStrengths}` : null,
      profile.pastGrantsWon    ? `\nPast Grants Won:\n${profile.pastGrantsWon}` : null,
    ].filter(Boolean).join("\n") : "";

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
      userId: user?.id,
    });

    let audit: Record<string, unknown>;
    try {
      audit = JSON.parse(result.content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    return NextResponse.json({ success: true, audit });
  } catch (err) {
    return handleApiError(err, "Grant Audit");
  }
}
