export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { logActivity } from "@/lib/activity";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// POST /api/grants/rank — re-score all grants against the GrantProfile
export async function POST(req: NextRequest) {
  try {
    const { response: authError, user: authUser } = await requireAuth();
    if (authError) return authError;

    const [{ data: profile }, { data: grants }] = await Promise.all([
      db.from("GrantProfile").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      db.from("Grant").select("id, name, eligibility, geographicScope, amount, projectDuration, howToApply, notes, founder").eq("companyId", DEMO_COMPANY_ID),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "No Grant Profile found. Please complete your Grant Profile first." }, { status: 400 });
    }
    if (!grants || grants.length === 0) {
      return NextResponse.json({ error: "No grants to rank." }, { status: 400 });
    }

    const profileSummary = [
      `Organisation Type: ${profile.orgType ?? "Not specified"}`,
      `Sector: ${profile.sector ?? "Not specified"}${profile.subSector ? ` / ${profile.subSector}` : ""}`,
      `Location: ${profile.location ?? "Not specified"}, ${profile.country ?? "Australia"}`,
      `Stage: ${profile.stage ?? "Not specified"}`,
      `Team Size: ${profile.teamSize ?? "Not specified"}`,
      `Annual Revenue: ${profile.annualRevenue ?? "Not specified"}`,
      `Focus Areas: ${(profile.focusAreas ?? []).join(", ") || "Not specified"}`,
      `Target Funding: $${profile.targetFundingMin ?? 0} – $${profile.targetFundingMax ?? "Any"}`,
      `Preferred Duration: ${profile.preferredDuration ?? "Any"}`,
      `Registered Charity: ${profile.isRegisteredCharity ? "Yes" : "No"}`,
      `Has ABN: ${profile.hasABN ? "Yes" : "No"}`,
      `Indigenous Owned: ${profile.indigenousOwned ? "Yes" : "No"}`,
      `Woman Owned: ${profile.womanOwned ? "Yes" : "No"}`,
      `Regional/Rural: ${profile.regionalOrRural ? "Yes" : "No"}`,
      profile.missionStatement ? `Mission: ${profile.missionStatement}` : null,
      profile.keyActivities ? `Key Activities: ${profile.keyActivities}` : null,
      profile.uniqueStrengths ? `Unique Strengths: ${profile.uniqueStrengths}` : null,
      profile.pastGrantsWon ? `Past Grants Won: ${profile.pastGrantsWon}` : null,
    ].filter(Boolean).join("\n");

    const results: { id: string; matchScore: number }[] = [];
    let totalPrompt = 0;
    let totalCompletion = 0;

    // Batch grants in groups of 5 to reduce API calls
    const BATCH_SIZE = 3;
    for (let i = 0; i < grants.length; i += BATCH_SIZE) {
      const batch = grants.slice(i, i + BATCH_SIZE);

      const systemPrompt = `You are a grant matching expert. Given a company profile and a list of grants, score how well each grant matches the company (0-100).

Scoring criteria:
- Geographic eligibility match (25 points)
- Sector/mission alignment (25 points)  
- Org type & eligibility criteria match (20 points)
- Funding amount within target range (15 points)
- Duration preference match (15 points)

Return ONLY valid JSON array, no markdown:
[{"id": "<grant_id>", "matchScore": <0-100>}, ...]`;

      const userPrompt = `COMPANY PROFILE:\n${profileSummary}\n\nGRANTS TO SCORE:\n${batch.map(g => `ID: ${g.id}\nName: ${g.name}\nEligibility: ${g.eligibility ?? "N/A"}\nGeographic Scope: ${g.geographicScope ?? "N/A"}\nAmount: ${g.amount ?? "N/A"}\nDuration: ${g.projectDuration ?? "N/A"}\nFounder/Org: ${g.founder ?? "N/A"}\n`).join("\n---\n")}`;

      try {
        const aiResult = await callOpenAIWithUsage({
          systemPrompt,
          userPrompt,
          model: MODEL_CONFIG.grantsAnalyse,
          maxTokens: 400,
          temperature: 0.1,
          jsonMode: true,
        });

        totalPrompt += aiResult.promptTokens;
        totalCompletion += aiResult.completionTokens;

        const cleaned = aiResult.content
          .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        const scores: { id: string; matchScore: number }[] = Array.isArray(parsed) ? parsed : (parsed.scores ?? []);

        for (const s of scores) {
          if (s.id && typeof s.matchScore === "number") {
            const matchScore = Math.min(100, Math.max(0, Math.round(s.matchScore)));
            await db.from("Grant").update({ matchScore, updatedAt: new Date().toISOString() }).eq("id", s.id);
            results.push({ id: s.id, matchScore });
          }
        }
      } catch {
        // skip batch on error — partial results still returned
      }
    }

    logAiUsage({
      model: MODEL_CONFIG.grantsAnalyse,
      feature: "grants_rank",
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      userId: authUser?.id,
    });

    await logActivity(authUser!.id, authUser!.email || "", "grants.rank", `Ranked ${results.length} grants`);

    return NextResponse.json({ success: true, ranked: results.length, results });
  } catch (error) {
    return handleApiError(error, "Rank Grants");
  }
}
