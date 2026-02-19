export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAIJson } from "@/lib/openai";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";

const bodySchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  founder: z.string().optional(),
  existingData: z.record(z.any()).optional(),
}).refine((d) => d.name || d.url, { message: "name or url required" });

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { name, url, founder, existingData } = parsed.data;

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

    let result: Record<string, unknown>;
    try {
      result = await callOpenAIJson({ systemPrompt, userPrompt, maxTokens: 800, temperature: 0.2 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
    }

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
