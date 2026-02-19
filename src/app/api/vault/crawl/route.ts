export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";
import { callOpenAI } from "@/lib/openai";
import { stripHtml } from "@/lib/htmlUtils";

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Fetch the page
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GUSIBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (err) {
      return NextResponse.json(
        { error: `Could not fetch URL: ${err instanceof Error ? err.message : "Network error"}` },
        { status: 422 }
      );
    }

    const text = stripHtml(html).slice(0, 12000);

    if (text.length < 100) {
      return NextResponse.json({ error: "Page content too short or could not be extracted" }, { status: 422 });
    }

    // Use AI to extract a clean, structured summary for the vault
    const systemPrompt = `You are a content extraction specialist. Given raw webpage text, extract and structure the most useful information for an AI content generator to learn from.

Return a clean, well-structured summary that captures:
- The main topic and purpose of the page
- Key facts, statistics, claims, or data points
- Tone and voice of the writing
- Any specific terminology, brand language, or unique phrases
- Actionable insights or key messages

Format as clear paragraphs. Be thorough — this will be used as training context for an AI. Aim for 300-800 words.`;

    const extracted = await callOpenAI({
      systemPrompt,
      userPrompt: `Extract and structure the key content from this webpage:\n\nURL: ${url}\n\nRAW TEXT:\n${text}`,
      maxTokens: 1200,
      temperature: 0.1,
    });

    // Extract page title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 120) : new URL(url).hostname;

    return NextResponse.json({
      success: true,
      title,
      content: extracted,
      charCount: extracted.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crawl failed" },
      { status: 500 }
    );
  }
}
