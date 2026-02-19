export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiHelpers";

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.0\.0\.0|::1|169\.254\.)/i;

function isSafeUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.test(host)) return false;
  if (host === "metadata.google.internal") return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!isSafeUrl(parsedUrl)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    const res = await fetch(parsedUrl.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GUSIBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 400 });

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5_000_000) {
      return NextResponse.json({ error: "Page too large (>5MB)" }, { status: 400 });
    }

    const html = await res.text();
    if (html.length > 5_000_000) return NextResponse.json({ error: "Page too large (>5MB)" }, { status: 400 });

    // Strip HTML tags, scripts, styles, nav, footer
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{3,}/g, "\n\n")
      .trim();

    // Try to extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

    // Extract domain for platform
    const domain = new URL(url).hostname.replace("www.", "");

    return NextResponse.json({ success: true, title, body: clean, platform: domain, url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to scrape URL" }, { status: 500 });
  }
}
