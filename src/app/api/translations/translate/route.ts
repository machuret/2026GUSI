export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";
import { callOpenAI } from "@/lib/openai";

export async function OPTIONS() { return handleOptions(); }

// POST /api/translations/translate — edge function, calls OpenAI directly
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const { text, targetLanguage, rules } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "text and targetLanguage are required" }, { status: 400 });
    }

    const rulesBlock = rules && rules.trim()
      ? `\n\nTRANSLATION RULES — follow these strictly:\n${rules}`
      : "";

    const systemPrompt = `You are a professional translator. Translate the provided content accurately into ${targetLanguage}.${rulesBlock}

Guidelines:
- Preserve the original meaning, tone and structure exactly
- Keep formatting (paragraphs, line breaks, bullet points) intact
- Do not add explanations or commentary
- Output ONLY the translated text`;

    let translated: string;
    try {
      translated = (await callOpenAI({
        systemPrompt,
        userPrompt: text,
        maxTokens: 4000,
        temperature: 0.2,
        jsonMode: false,
      })).trim();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Translation failed" },
        { status: 502 }
      );
    }

    if (!translated) {
      return NextResponse.json({ error: "OpenAI returned an empty translation" }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      translated,
      model: "gpt-4o",
      wordCount: translated.split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Translation failed" },
      { status: 500 }
    );
  }
}
