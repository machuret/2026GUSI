export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAI } from "@/lib/openai";
import { KNOWN_GRANT_SITES } from "@/lib/grantSites";

const bodySchema = z.object({
  url: z.string().url("A valid URL is required"),
  siteName: z.string().optional(),
  extractionHint: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { url, siteName, extractionHint } = parsed.data;

    // Fetch the page HTML
    let html = "";
    try {
      const pageRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; GrantResearchBot/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!pageRes.ok) {
        return NextResponse.json({
          error: `Could not fetch page (HTTP ${pageRes.status}). The site may block automated access.`,
          grants: [],
          partial: true,
        });
      }

      const rawHtml = await pageRes.text();
      // Strip scripts, styles, nav, footer to reduce tokens — keep main content
      html = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{3,}/g, "\n")
        .trim()
        .slice(0, 12000); // cap at ~3k tokens
    } catch (fetchErr) {
      return NextResponse.json({
        error: `Failed to fetch page: ${fetchErr instanceof Error ? fetchErr.message : "Network error"}. The site may require a browser or block bots.`,
        grants: [],
        partial: true,
      });
    }

    if (html.length < 100) {
      return NextResponse.json({
        error: "Page returned no readable content. It may be JavaScript-rendered (SPA) and requires a browser to load.",
        grants: [],
        partial: true,
      });
    }

    const systemPrompt = `You are a grant data extraction specialist. You will be given the text content of a grant listing webpage. Extract all grant opportunities you can find.

Return ONLY valid JSON in this exact format:
{
  "grants": [
    {
      "name": "<full grant name>",
      "founder": "<granting organisation>",
      "url": "<direct link to this specific grant, or the page URL if not available>",
      "deadlineDate": "<ISO date YYYY-MM-DD or null>",
      "geographicScope": "<Global | United States | UK | Australia | Europe | Asia | Africa | or specific country>",
      "amount": "<funding amount or range, or null>",
      "eligibility": "<brief eligibility summary>",
      "howToApply": "<brief application process>",
      "projectDuration": "<allowed duration or null>",
      "submissionEffort": "<Low | Medium | High>",
      "confidence": "<High | Medium | Low>"
    }
  ],
  "totalFound": <number>,
  "pageTitle": "<title of the page>"
}

RULES:
- Extract ONLY grants clearly visible in the text. Do not invent grants.
- If a field is not present in the text, return null.
- Return up to 15 grants maximum.
- Set confidence to "High" only if name + org + URL are all clearly present.`;

    const userPrompt = `Extract all grants from this page content.
Source: ${siteName || url}
${extractionHint ? `Hint: ${extractionHint}` : ""}

PAGE CONTENT:
${html}`;

    const content = await callOpenAI({ systemPrompt, userPrompt, maxTokens: 4000, temperature: 0.1 });
    const result = JSON.parse(content);

    return NextResponse.json({
      success: true,
      grants: result.grants ?? [],
      totalFound: result.totalFound ?? (result.grants?.length ?? 0),
      pageTitle: result.pageTitle ?? siteName ?? url,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed",
    }, { status: 500 });
  }
}

// GET — return the curated site list
export async function GET() {
  return NextResponse.json({ sites: KNOWN_GRANT_SITES });
}
