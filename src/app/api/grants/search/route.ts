export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, sector, geographicScope, companyDNA } = await req.json();

    if (!query && !sector) {
      return NextResponse.json({ error: "query or sector required" }, { status: 400 });
    }

    const systemPrompt = `You are a grant discovery specialist. Your job is to find real, currently active grant opportunities that match a given search query and company profile.

Return ONLY valid JSON in this exact format — an array of up to 8 grant results:
{
  "results": [
    {
      "name": "<full official grant name>",
      "founder": "<granting organisation name>",
      "url": "<official application or info URL — must be a real URL>",
      "deadlineDate": "<ISO date YYYY-MM-DD or null if ongoing/unknown>",
      "geographicScope": "<one of: Global | United States | UK | Australia | Europe | Asia | Africa | Sub-Saharan Africa | Latin America | Middle East | Canada | New Zealand | or specific country>",
      "amount": "<funding amount or range, or null if unknown>",
      "eligibility": "<brief eligibility summary>",
      "howToApply": "<brief application process>",
      "projectDuration": "<allowed duration or null>",
      "submissionEffort": "<Low | Medium | High>",
      "fitReason": "<1 sentence: why this grant matches the search/company>",
      "confidence": "<High | Medium | Low — how confident you are this grant is real and current>"
    }
  ]
}

CRITICAL RULES:
- Only return grants you have strong knowledge of. Do NOT fabricate grants.
- If you are not confident a grant is real, set confidence to "Low" and note it.
- URLs must be real official pages, not guessed.
- Prioritise grants that are currently open or have recurring cycles.
- If company DNA is provided, rank results by relevance to that company.`;

    const geoFilter = geographicScope ? `\nGeographic preference: ${geographicScope}` : "";
    const dnaSection = companyDNA
      ? `\nCOMPANY PROFILE (use this to rank and filter relevance):\n${companyDNA.slice(0, 1500)}`
      : "";

    const userPrompt = `Find grant opportunities matching this search:

Search query: ${query || ""}
Sector/focus: ${sector || "general"}${geoFilter}${dnaSection}

Return up to 8 real, relevant grants. Prioritise currently open or recurring grants.`;

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
        temperature: 0.2,
        max_tokens: 2000,
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
