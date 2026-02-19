import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GUSIBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 400 });

    const html = await res.text();

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to scrape URL" }, { status: 500 });
  }
}
