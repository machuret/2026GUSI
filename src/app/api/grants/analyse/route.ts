export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function persistScore(grantId: string, score: number, verdict: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/Grant?id=eq.${grantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ aiScore: score, aiVerdict: verdict }),
    });
  } catch {
    // non-fatal — analysis still returns even if persist fails
  }
}

export async function POST(req: NextRequest) {
  try {
    const { grant, companyDNA } = await req.json();

    if (!grant) {
      return NextResponse.json({ error: "grant required" }, { status: 400 });
    }

    if (!companyDNA || companyDNA.trim().length < 20) {
      return NextResponse.json({
        error: "Company DNA is too short. Please fill in your Company Info page (values, philosophy, founders, achievements) before running the fit calculator.",
      }, { status: 400 });
    }

    const systemPrompt = `You are a grant eligibility analyst. You will be given a company's profile (DNA) and a grant opportunity. Your job is to assess how likely this company is to successfully win this grant.

Analyse the following dimensions:
1. Mission/purpose alignment — does the company's work match what the grant funds?
2. Geographic eligibility — is the company in the right location?
3. Sector/industry fit — does the grant target this company's sector?
4. Stage/size fit — is the company at the right stage or scale?
5. Eligibility criteria — does the company meet stated requirements?
6. Competitive positioning — how strong is the company's case vs typical applicants?

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "verdict": "<one of: Strong Fit | Good Fit | Possible Fit | Weak Fit | Not Eligible>",
  "summary": "<2-3 sentence plain-English summary of the assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendation": "<one concrete action to improve the application>"
}`;

    const userPrompt = `COMPANY DNA:
${companyDNA}

GRANT DETAILS:
Name: ${grant.name}
Founder/Organisation: ${grant.founder ?? "Unknown"}
Geographic Scope: ${grant.geographicScope ?? "Not specified"}
Eligibility: ${grant.eligibility ?? "Not specified"}
Amount: ${grant.amount ?? "Not specified"}
Project Duration: ${grant.projectDuration ?? "Not specified"}
How to Apply: ${grant.howToApply ?? "Not specified"}
Notes: ${grant.notes ?? "None"}

Assess the likelihood of this company winning this grant.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const result = JSON.parse(content);

    // Persist score to DB (non-blocking)
    if (grant.id && result.score !== undefined) {
      await persistScore(grant.id, result.score, result.verdict ?? "");
    }

    return NextResponse.json({ success: true, analysis: result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
