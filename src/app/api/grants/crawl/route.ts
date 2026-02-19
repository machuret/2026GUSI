export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAIJson } from "@/lib/openai";
import { stripHtml } from "@/lib/htmlUtils";
import { KNOWN_GRANT_SITES } from "@/lib/grantSites";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";

const bodySchema = z.object({
  url: z.string().url("A valid URL is required"),
  siteName: z.string().optional(),
  extractionHint: z.string().optional(),
  siteId: z.string().optional(),
});

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { url, siteName, extractionHint, siteId } = parsed.data;

    // Look up known site config for crawlHint and jsHeavy flag
    const knownSite = siteId ? KNOWN_GRANT_SITES.find((s) => s.id === siteId) : null;
    const isJsHeavy = knownSite?.jsHeavy ?? false;
    const siteHint = knownSite?.crawlHint ?? extractionHint ?? "";

    // Warn early for JS-heavy sites but still attempt
    let jsWarning: string | null = null;
    if (isJsHeavy) {
      jsWarning = "This site is JavaScript-rendered and may return limited results. Try pasting a specific search results URL instead.";
    }

    // Fetch the page HTML with longer timeout and better headers
    let html = "";
    let fetchStatus = 200;
    try {
      const pageRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        signal: AbortSignal.timeout(20000),
      });

      fetchStatus = pageRes.status;

      if (!pageRes.ok) {
        const errMsg = fetchStatus === 403
          ? `Access denied (HTTP 403). This site blocks automated access. Try a different URL or paste the grant details manually.`
          : fetchStatus === 429
          ? `Rate limited (HTTP 429). Wait a few minutes and try again.`
          : `Could not fetch page (HTTP ${fetchStatus}). The site may block automated access.`;
        return NextResponse.json({ error: errMsg, grants: [], partial: true, jsWarning });
      }

      const rawHtml = await pageRes.text();
      html = stripHtml(rawHtml).slice(0, 20000); // increased to ~5k tokens
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
      const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort");
      return NextResponse.json({
        error: isTimeout
          ? `Page timed out after 20 seconds. The site may be slow or blocking bots. Try a more specific URL.`
          : `Failed to fetch page: ${msg}`,
        grants: [],
        partial: true,
        jsWarning,
      });
    }

    if (html.length < 200) {
      return NextResponse.json({
        error: isJsHeavy
          ? "Page returned no readable content — this site requires a browser to render. Try copying a direct search results URL with filters applied."
          : "Page returned no readable content. It may be JavaScript-rendered or empty.",
        grants: [],
        partial: true,
        jsWarning,
      });
    }

    const systemPrompt = `You are a grant data extraction specialist. Extract ALL grant opportunities from the webpage text provided.

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{
  "grants": [
    {
      "name": "<full official grant name>",
      "founder": "<granting organisation or agency>",
      "url": "<direct URL to this grant if found in text, otherwise use the source URL>",
      "deadlineDate": "<ISO date YYYY-MM-DD or null>",
      "geographicScope": "<Global | United States | UK | Australia | Europe | Asia | Africa | Canada | or specific country/state>",
      "amount": "<funding amount or range as string, e.g. '$50,000' or 'Up to $200,000', or null>",
      "eligibility": "<1-2 sentence eligibility summary>",
      "howToApply": "<brief application process or null>",
      "projectDuration": "<e.g. '12 months', '2 years', or null>",
      "submissionEffort": "<Low | Medium | High>",
      "confidence": "<High | Medium | Low>"
    }
  ],
  "totalFound": <number>,
  "pageTitle": "<title of the page>"
}

STRICT RULES:
- Extract ONLY grants/funding opportunities explicitly mentioned in the text. Never invent.
- If a field is absent, use null — never guess.
- Return up to 30 grants.
- confidence=High: name + org + clear details all present.
- confidence=Medium: name + org present but details sparse.
- confidence=Low: only partial info available.
- For URLs found in text like [/grants/xyz], prepend the source domain.
- submissionEffort: Low=simple online form, Medium=proposal required, High=complex multi-stage.`;

    const userPrompt = `Extract all grant opportunities from this page.
Source URL: ${url}
Site name: ${siteName || "Unknown"}
${siteHint ? `Focus: ${siteHint}` : ""}

PAGE CONTENT:
${html}`;

    let result: Record<string, unknown>;
    try {
      result = await callOpenAIJson({ systemPrompt, userPrompt, maxTokens: 6000, temperature: 0.05 });
    } catch (aiErr) {
      return NextResponse.json({
        error: aiErr instanceof Error ? aiErr.message : "AI extraction failed",
        grants: [],
        partial: true,
        jsWarning,
      });
    }

    const grants = Array.isArray(result.grants) ? result.grants : [];

    // Resolve relative URLs
    const baseUrl = new URL(url);
    const resolvedGrants = grants.map((g: Record<string, unknown>) => ({
      ...g,
      url: typeof g.url === "string" && g.url.startsWith("/")
        ? `${baseUrl.origin}${g.url}`
        : (g.url || url),
    }));

    return NextResponse.json({
      success: true,
      grants: resolvedGrants,
      totalFound: typeof result.totalFound === "number" ? result.totalFound : resolvedGrants.length,
      pageTitle: typeof result.pageTitle === "string" ? result.pageTitle : (siteName ?? url),
      jsWarning,
      htmlLength: html.length,
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
