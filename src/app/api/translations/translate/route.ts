export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

const CHUNK_WORDS = 800; // translate in chunks if text is very long

async function translateChunk(
  chunk: string,
  targetLanguage: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: chunk },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

function splitIntoChunks(text: string, maxWords: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  let wordCount = 0;
  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (wordCount + words > maxWords && current) {
      chunks.push(current.trim());
      current = para;
      wordCount = words;
    } else {
      current = current ? current + "\n\n" + para : para;
      wordCount += words;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

// POST /api/translations/translate
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { text, targetLanguage, rules } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "text and targetLanguage are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const rulesBlock = rules?.trim()
      ? `\n\nTRANSLATION RULES — follow these strictly:\n${rules.trim()}`
      : "";

    const systemPrompt = `You are a professional translator. Translate the provided content accurately into ${targetLanguage}.${rulesBlock}

Guidelines:
- Preserve the original meaning, tone and structure exactly
- Keep formatting (paragraphs, line breaks, bullet points) intact
- Do not add explanations or commentary
- Output ONLY the translated text`;

    const wordCount = text.trim().split(/\s+/).length;
    let translated: string;

    if (wordCount <= CHUNK_WORDS) {
      // Short text — single call
      translated = await translateChunk(text, targetLanguage, systemPrompt, apiKey);
    } else {
      // Long text — split into chunks and translate in parallel batches of 3
      const chunks = splitIntoChunks(text, CHUNK_WORDS);
      const results: string[] = new Array(chunks.length);
      const BATCH = 3;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map((c) => translateChunk(c, targetLanguage, systemPrompt, apiKey))
        );
        batchResults.forEach((r, j) => { results[i + j] = r; });
      }
      translated = results.join("\n\n");
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
    return handleApiError(err, "Translation");
  }
}
