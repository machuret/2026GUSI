export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      query,
      sector,
      geographicScope,
      applicantCountry,
      orgType,
      fundingSize,
      deadlineUrgency,
      eligibilityType,
      grantType,
      companyDNA,
    } = await req.json();

    if (!query && !sector && !grantType && !orgType) {
      return NextResponse.json({ error: "At least one search filter is required" }, { status: 400 });
    }

    const systemPrompt = `You are a grant discovery specialist with deep knowledge of global funding opportunities. Your job is to find real, currently active grant opportunities that precisely match the given filters and company profile.

Return ONLY valid JSON in this exact format — an array of up to 10 grant results:
{
  "results": [
    {
      "name": "<full official grant name>",
      "founder": "<granting organisation name>",
      "url": "<official application or info URL — must be a real URL>",
      "deadlineDate": "<ISO date YYYY-MM-DD or null if ongoing/unknown>",
      "geographicScope": "<one of: Global | United States | UK | Australia | Europe | Asia | Africa | Sub-Saharan Africa | Latin America | Middle East | Canada | New Zealand | or specific country>",
      "amount": "<funding amount or range, or null if unknown>",
      "eligibility": "<who can apply — org type, sector, location, stage>",
      "howToApply": "<brief application process>",
      "projectDuration": "<allowed duration or null>",
      "submissionEffort": "<Low | Medium | High>",
      "fitReason": "<1 sentence: why this grant matches the filters/company>",
      "confidence": "<High | Medium | Low — how confident you are this grant is real and current>"
    }
  ]
}

CRITICAL RULES:
- Only return grants you have strong knowledge of. Do NOT fabricate grants.
- If you are not confident a grant is real, set confidence to "Low".
- URLs must be real official pages — never guess a URL.
- Strictly respect ALL filters provided — if org type is NGO, only return grants for NGOs.
- Prioritise grants that are currently open or have recurring annual cycles.
- If company DNA is provided, rank results by relevance to that company first.`;

    // Build structured filter block
    const filters: string[] = [];
    if (query)            filters.push(`Keywords: ${query}`);
    if (sector)           filters.push(`Sector/focus area: ${sector}`);
    if (grantType)        filters.push(`Grant type: ${grantType}`);
    if (geographicScope)  filters.push(`Grant geographic scope (where the grant funds): ${geographicScope}`);
    if (applicantCountry) filters.push(`Applicant country (where our organisation is based): ${applicantCountry}`);
    if (orgType)          filters.push(`Organisation type: ${orgType}`);
    if (eligibilityType)  filters.push(`Eligibility: ${eligibilityType}`);
    if (fundingSize)      filters.push(`Funding size range: ${fundingSize}`);
    if (deadlineUrgency)  filters.push(`Deadline urgency: ${deadlineUrgency}`);

    const dnaSection = companyDNA
      ? `\nCOMPANY PROFILE (use this to rank relevance and check fit):\n${companyDNA.slice(0, 2000)}`
      : "";

    const userPrompt = `Find grant opportunities matching ALL of these filters:

${filters.join("\n")}${dnaSection}

Return up to 10 real, relevant grants that match ALL the filters above. Strictly filter by org type and eligibility if specified.`;

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
        temperature: 0.15,
        max_tokens: 3000,
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

    return NextResponse.json({ success: true, results: result.results ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
