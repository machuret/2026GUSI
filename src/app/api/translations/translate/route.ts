export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

// POST /api/translations/translate — AI translate a transcript using rules
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const translated = response.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ success: true, translated });
  } catch (err) {
    return handleApiError(err, "Translate");
  }
}
