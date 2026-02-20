export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAIJson } from "@/lib/openai";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";

const bodySchema = z.object({
  query: z.string().max(500).optional(),
  geographicScope: z.string().optional(),
  applicantCountry: z.string().optional(),
  orgType: z.string().optional(),
  fundingSize: z.string().optional(),
  deadlineUrgency: z.string().optional(),
  eligibilityType: z.string().optional(),
  grantType: z.string().optional(),
  companyDNA: z.string().max(5000).optional(),
  existingNames: z.array(z.string()).max(500).optional(),
}).refine(
  (d) => d.query || d.grantType || d.orgType || d.geographicScope,
  { message: "At least one search filter is required" }
);

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { query, geographicScope, applicantCountry, orgType, fundingSize, deadlineUrgency, eligibilityType, grantType, companyDNA, existingNames } = parsed.data;

    const systemPrompt = `You are a world-class grant research specialist with encyclopaedic knowledge of global, national, and regional funding programs. Your mission is to find the maximum number of real, currently active (or annually recurring) grant opportunities that precisely match the given filters.

Return ONLY valid JSON in this exact format:
{
  "results": [
    {
      "name": "<full official grant name>",
      "founder": "<granting organisation name>",
      "url": "<official application or info URL — must be a real, verifiable URL>",
      "deadlineDate": "<ISO date YYYY-MM-DD or null if ongoing/rolling>",
      "geographicScope": "<Global | United States | UK | Australia | Europe | Asia | Africa | Sub-Saharan Africa | Latin America | Middle East | Canada | New Zealand | or specific country>",
      "amount": "<funding amount or range, e.g. 'Up to $50,000' or null>",
      "eligibility": "<who can apply — org type, sector, location, stage, size>",
      "howToApply": "<brief application process — portal name, steps, timeline>",
      "projectDuration": "<allowed project duration or null>",
      "submissionEffort": "<Low | Medium | High>",
      "fitReason": "<1–2 sentences: exactly why this grant matches the filters and company profile>",
      "confidence": "<High | Medium | Low — your confidence this grant is real, active, and correctly described>"
    }
  ]
}

RULES:
- Return up to 20 grants. Push yourself to find as many real matches as possible — do not stop at 5 or 10.
- Include grants from government bodies, foundations, accelerators, corporate programs, and international organisations.
- Only return grants you have genuine knowledge of. Never fabricate a grant name or URL.
- If a URL is uncertain, omit it (set to null) rather than guess.
- Strictly respect ALL filters — wrong org type or geography = exclude.
- Prioritise currently open grants, then annually recurring ones.
- Rank by fit score if company DNA is provided.
- If existingNames are provided, DO NOT return any grant whose name closely matches one in that list.`;

    const filters: string[] = [];
    if (query)            filters.push(`Keywords/topic: ${query}`);
    if (grantType)        filters.push(`Grant type: ${grantType}`);
    if (geographicScope)  filters.push(`Grant geographic scope: ${geographicScope}`);
    if (applicantCountry) filters.push(`Applicant country (where our org is based): ${applicantCountry}`);
    if (orgType)          filters.push(`Organisation type: ${orgType}`);
    if (eligibilityType)  filters.push(`Eligibility: ${eligibilityType}`);
    if (fundingSize)      filters.push(`Funding size: ${fundingSize}`);
    if (deadlineUrgency)  filters.push(`Deadline: ${deadlineUrgency}`);

    const dnaSection = companyDNA
      ? `\nCOMPANY PROFILE (rank results by relevance to this):\n${companyDNA.slice(0, 2500)}`
      : "";

    const excludeSection = existingNames && existingNames.length > 0
      ? `\nEXCLUDE THESE (already in our database — do not return them):\n${existingNames.slice(0, 100).join(", ")}`
      : "";

    const userPrompt = `Find up to 20 real grant opportunities matching ALL of these filters:

${filters.join("\n")}${dnaSection}${excludeSection}

Be exhaustive — search your knowledge across government grants, foundations, corporate programs, EU funds, UN programs, bilateral aid, and private philanthropy. Return as many real matches as you can find (up to 20).`;

    let result: Record<string, unknown>;
    try {
      result = await callOpenAIJson({ systemPrompt, userPrompt, maxTokens: 5000, temperature: 0.2 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, results: (result.results as unknown[]) ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
