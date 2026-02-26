export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAIJson } from "@/lib/openai";
import { stripHtml } from "@/lib/htmlUtils";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";
import { isPrivateUrl } from "@/lib/urlValidation";

const bodySchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  founder: z.string().optional(),
  existingData: z.record(z.any()).optional(),
}).refine((d) => d.name || d.url, { message: "name or url required" });

async function crawlUrl(url: string): Promise<string> {
  if (isPrivateUrl(url)) return "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html).slice(0, 6000);
  } catch {
    return "";
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
    const { name, url, founder, existingData } = parsed.data;

    // Crawl the grant URL for real page content
    let crawledContent = "";
    if (url) {
      crawledContent = await crawlUrl(url);
    }

    const systemPrompt = `You are a grant research assistant. Given a grant name, organisation, optional URL, and any crawled page content, research and fill in as many details as possible about this grant opportunity.

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

RULES:
- Prioritise information from the crawled page content over your training data.
- If you cannot determine a field with reasonable confidence, return null for that field.
- Do not guess or fabricate specific numbers.`;

    const crawlBlock = crawledContent
      ? `\n\nCRAWLED PAGE CONTENT (from ${url}):\n${crawledContent}`
      : "";

    const userPrompt = `Research this grant and fill in the missing details:

Grant Name: ${name ?? "Unknown"}
Organisation/Founder: ${founder ?? "Unknown"}
URL: ${url ?? "Not provided"}

Existing known data:
${JSON.stringify(existingData ?? {}, null, 2)}${crawlBlock}

Fill in as many fields as you can.`;

    let result: Record<string, unknown>;
    try {
      result = await callOpenAIJson({ systemPrompt, userPrompt, maxTokens: 800, temperature: 0.2 });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
    }

    // Whitelist only known grant fields — AI can return arbitrary keys
    const ALLOWED_KEYS = new Set([
      "eligibility", "howToApply", "amount", "geographicScope",
      "projectDuration", "submissionEffort", "notes",
    ]);
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(result)) {
      if (ALLOWED_KEYS.has(k) && v !== null && v !== undefined && v !== "") {
        filled[k] = v as string;
      }
    }

    return NextResponse.json({ success: true, filled });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
