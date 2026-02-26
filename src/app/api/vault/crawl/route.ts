export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";
import { stripHtml } from "@/lib/htmlUtils";
import { MODEL_CONFIG } from "@/lib/openai";
import { isPrivateUrl } from "@/lib/urlValidation";

export async function OPTIONS() { return handleOptions(); }

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    if (isPrivateUrl(url)) {
      return NextResponse.json({ error: "Cannot crawl private or internal URLs" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
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

    const systemPrompt = `You are a content extraction specialist. Given raw webpage text, extract and structure the most useful information for an AI content generator to learn from.

Return a clean, well-structured summary that captures:
- The main topic and purpose of the page
- Key facts, statistics, claims, or data points
- Tone and voice of the writing
- Any specific terminology, brand language, or unique phrases
- Actionable insights or key messages

Format as clear paragraphs. Be thorough — this will be used as training context for an AI. Aim for 300-800 words.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.vaultCrawl,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract and structure the key content from this webpage:\n\nURL: ${url}\n\nRAW TEXT:\n${text}` },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return NextResponse.json(
        { error: `OpenAI error (${openaiRes.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const aiData = await openaiRes.json();
    const extracted = (aiData.choices?.[0]?.message?.content ?? "").trim();

    if (!extracted) {
      return NextResponse.json({ error: "AI returned empty content" }, { status: 502 });
    }

    // Extract page title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = "Untitled";
    try { title = titleMatch ? titleMatch[1].trim().slice(0, 120) : new URL(url).hostname; }
    catch { title = titleMatch?.[1]?.trim().slice(0, 120) || url.slice(0, 80); }

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
