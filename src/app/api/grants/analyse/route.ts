export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAIJson } from "@/lib/openai";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";


const bodySchema = z.object({
  companyDNA: z.string().min(20, "Company DNA is too short. Fill in your Grant Profile or Company Info first."),
  grant: z.object({
    id: z.string().optional(),
    name: z.string(),
    founder: z.string().optional().nullable(),
    geographicScope: z.string().optional().nullable(),
    eligibility: z.string().optional().nullable(),
    amount: z.string().optional().nullable(),
    projectDuration: z.string().optional().nullable(),
    howToApply: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    deadlineDate: z.string().optional().nullable(),
  }),
});

async function persistScore(grantId: string, score: number, verdict: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;
  try {
    await fetch(`${supabaseUrl}/rest/v1/Grant?id=eq.${grantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ aiScore: score, aiVerdict: verdict }),
    });
  } catch {
    // non-fatal — analysis still returns even if persist fails
  }
}

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { grant, companyDNA } = parsed.data;

    // Calculate days until deadline for context
    const deadlineStr = grant.deadlineDate ? (() => {
      const d = new Date(grant.deadlineDate);
      const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
      if (days < 0) return `EXPIRED (${Math.abs(days)} days ago)`;
      if (days === 0) return "Due TODAY";
      return `${days} days remaining (${d.toLocaleDateString("en-AU")})`;
    })() : "No deadline specified";

    const systemPrompt = `You are a grant eligibility analyst. You will be given a company's profile (DNA) and a grant opportunity. Your job is to assess how likely this company is to successfully win this grant.

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

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "verdict": "<one of: Strong Fit | Good Fit | Possible Fit | Weak Fit | Not Eligible>",
  "summary": "<2-3 sentence plain-English summary of the assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "gaps": ["<specific gap or risk 1>", "<specific gap or risk 2>"],
  "recommendation": "<one concrete, actionable step to improve chances of winning>"
}`;

    const userPrompt = `COMPANY DNA:\n${companyDNA}\n\nGRANT DETAILS:\nName: ${grant.name}\nFounder/Organisation: ${grant.founder ?? "Unknown"}\nGeographic Scope: ${grant.geographicScope ?? "Not specified"}\nEligibility: ${grant.eligibility ?? "Not specified"}\nAmount: ${grant.amount ?? "Not specified"}\nProject Duration: ${grant.projectDuration ?? "Not specified"}\nHow to Apply: ${grant.howToApply ?? "Not specified"}\nDeadline: ${deadlineStr}\nNotes: ${grant.notes ?? "None"}\n\nAssess the likelihood of this company winning this grant.`;

    let result: Record<string, unknown>;
    try {
      result = await callOpenAIJson({ systemPrompt, userPrompt, maxTokens: 600, temperature: 0.3 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
    }

    if (grant.id && typeof result.score === "number") {
      await persistScore(grant.id, result.score, typeof result.verdict === "string" ? result.verdict : "");
    }

    return NextResponse.json({ success: true, analysis: result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
