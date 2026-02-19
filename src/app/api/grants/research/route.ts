export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, url, founder, existingData } = await req.json();

    if (!name && !url) {
      return NextResponse.json({ error: "name or url required" }, { status: 400 });
    }

    const systemPrompt = `You are a grant research assistant. Given a grant name, organisation, and optional URL, research and fill in as many details as possible about this grant opportunity.

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "eligibility": "<who can apply — organisation type, sector, location, stage, size>",
  "howToApply": "<application process, steps, portal, documents required>",
  "amount": "<funding amount or range, e.g. Up to $50,000 or £10,000–£100,000>",
  "geographicScope": "<one of: Global | United States | UK | Australia | Europe | Asia | Africa | Sub-Saharan Africa | Latin America | Middle East | Canada | or specific country>",
  "projectDuration": "<allowed project duration, e.g. 6–24 months or Up to 3 years>",
  "submissionEffort": "<one of: Low | Medium | High — based on complexity of application>",
  "notes": "<any important notes, restrictions, or tips about this grant>"
}

If you cannot determine a field with reasonable confidence, return null for that field. Do not guess or fabricate specific numbers.`;

    const userPrompt = `Research this grant and fill in the missing details:

Grant Name: ${name ?? "Unknown"}
Organisation/Founder: ${founder ?? "Unknown"}
URL: ${url ?? "Not provided"}

Existing known data:
${JSON.stringify(existingData ?? {}, null, 2)}

Fill in as many fields as you can based on your knowledge of this grant or organisation.`;

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
        max_tokens: 800,
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

    // Strip null values so we don't overwrite existing data with nulls
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(result)) {
      if (v !== null && v !== undefined && v !== "") {
        filled[k] = v as string;
      }
    }

    return NextResponse.json({ success: true, filled });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
