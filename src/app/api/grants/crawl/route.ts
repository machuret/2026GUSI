export const runtime = 'nodejs';
export const maxDuration = 60;
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

/**
 * Attempt to fetch page content via Firecrawl.
 * Returns markdown text on success, null on failure.
 * Firecrawl handles JS rendering and rotating IPs — used as fallback.
 */
async function fetchViaFirecrawl(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: false,
        waitFor: 2000,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md: string = data?.data?.markdown ?? data?.markdown ?? "";
    return md.slice(0, 48000) || null;
  } catch {
    return null;
  }
}

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

    let jsWarning: string | null = null;
    let html = "";
    let usedFirecrawl = false;

    // ── Step 1: direct fetch (free, fast) ────────────────────────────────
    let directFailed = false;
    let directFailReason = "";

    // JS-heavy sites: skip direct fetch and go straight to Firecrawl
    if (!isJsHeavy) {
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

        if (!pageRes.ok) {
          directFailed = true;
          directFailReason = pageRes.status === 403 ? "blocked (403)"
            : pageRes.status === 429 ? "rate-limited (429)"
            : `HTTP ${pageRes.status}`;
        } else {
          const rawHtml = await pageRes.text();
          html = stripHtml(rawHtml).slice(0, 48000);
          if (html.length < 100) {
            directFailed = true;
            directFailReason = "empty content";
          }
        }
      } catch (fetchErr) {
        directFailed = true;
        const msg = fetchErr instanceof Error ? fetchErr.message : "";
        directFailReason = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("abort")
          ? "timeout" : "network error";
      }
    } else {
      directFailed = true;
      directFailReason = "JS-rendered site";
    }

    // ── Step 2: Firecrawl fallback ────────────────────────────────────────
    if (directFailed) {
      const firecrawlKey = process.env.FIRECRAWL_API_KEY;
      if (firecrawlKey) {
        const fc = await fetchViaFirecrawl(url);
        if (fc && fc.length >= 100) {
          html = fc;
          usedFirecrawl = true;
          // Clear JS warning — Firecrawl handles JS rendering
          jsWarning = null;
        } else {
          // Both methods failed
          const isJsRelated = isJsHeavy || directFailReason === "JS-rendered site" || directFailReason === "empty content";
          return NextResponse.json({
            error: isJsRelated
              ? "Page is JavaScript-rendered and Firecrawl could not extract content. Try a more specific URL with filters applied."
              : `Could not fetch page (${directFailReason}) and Firecrawl fallback also failed. The site may be behind authentication.`,
            grants: [], partial: true,
          });
        }
      } else {
        // No Firecrawl key — return informative error
        const isTimeout = directFailReason === "timeout";
        const isBlocked = directFailReason.includes("403") || directFailReason.includes("blocked");
        const isRateLimited = directFailReason.includes("429");
        const isJsRelated = isJsHeavy || directFailReason === "empty content";
        return NextResponse.json({
          error: isBlocked
            ? "Access denied (HTTP 403). This site blocks automated access. Add a FIRECRAWL_API_KEY to bypass this, or try a different URL."
            : isRateLimited
            ? "Rate limited (HTTP 429). Wait a few minutes and try again, or add a FIRECRAWL_API_KEY."
            : isTimeout
            ? "Page timed out after 20 seconds. Add a FIRECRAWL_API_KEY for more reliable crawling."
            : isJsRelated
            ? "Page returned no readable content. This site may be JavaScript-rendered. Add a FIRECRAWL_API_KEY to handle JS sites."
            : `Failed to fetch page: ${directFailReason}`,
          grants: [], partial: true,
          tip: "Add FIRECRAWL_API_KEY to your environment variables for automatic fallback on blocked sites.",
        });
      }
    }

    if (isJsHeavy && !usedFirecrawl) {
      jsWarning = "This site is JavaScript-rendered — results may be limited. Add a FIRECRAWL_API_KEY for full JS rendering support.";
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
      result = await callOpenAIJson({ systemPrompt, userPrompt, model: "gpt-4o-mini", maxTokens: 6000, temperature: 0.05 });
    } catch (aiErr) {
      return NextResponse.json({
        error: aiErr instanceof Error ? aiErr.message : "AI extraction failed",
        grants: [],
        partial: true,
        jsWarning,
      });
    }

    const grants = Array.isArray(result.grants) ? result.grants : [];

    // Resolve relative, protocol-relative, and absolute URLs
    const baseUrl = new URL(url);
    const resolvedGrants = grants.map((g: Record<string, unknown>) => ({
      ...g,
      url: (() => {
        const raw = typeof g.url === "string" ? g.url.trim() : "";
        if (!raw) return url;
        if (raw.startsWith("//")) return `${baseUrl.protocol}${raw}`;
        if (raw.startsWith("/")) return `${baseUrl.origin}${raw}`;
        if (raw.startsWith("http")) return raw;
        // relative path like "../grants/xyz" or "grants/xyz"
        try { return new URL(raw, url).href; } catch { return url; }
      })(),
    }));

    return NextResponse.json({
      success: true,
      grants: resolvedGrants,
      totalFound: typeof result.totalFound === "number" ? result.totalFound : resolvedGrants.length,
      pageTitle: typeof result.pageTitle === "string" ? result.pageTitle : (siteName ?? url),
      jsWarning,
      htmlLength: html.length,
      usedFirecrawl,
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
