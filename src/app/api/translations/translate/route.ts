export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleOptions } from "@/lib/cors";

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
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

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      return NextResponse.json(
        { error: `OpenAI error (${openaiRes.status}): ${errBody.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await openaiRes.json() as { choices: { message: { content: string } }[] };
    const translated = json.choices[0]?.message?.content?.trim() ?? "";

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
