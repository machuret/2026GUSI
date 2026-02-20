export const runtime = 'nodejs';
export const maxDuration = 120;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

const CHUNK_WORDS = 800;
const CHUNK_BATCH = 2;  // max parallel OpenAI calls for long-text chunks
const RETRY_DELAYS_MS = [2000, 5000, 12000]; // backoff delays for 429/5xx

// Module-level constant — not rebuilt on every request
const CATEGORY_GUIDANCE: Record<string, string> = {
  "Newsletter":     "This is a newsletter — maintain a warm, engaging tone suited to subscriber communications.",
  "Blog Post":      "This is a blog post — preserve a conversational, informative tone with natural flow.",
  "Social Media":   "This is social media content — keep it punchy, energetic, and platform-appropriate. Preserve emojis and hashtags.",
  "Press Release":  "This is a press release — use formal, journalistic language. Preserve all proper nouns, titles, and dates exactly.",
  "Announcement":   "This is an announcement — keep it clear, direct, and professional.",
  "Sales Page":     "This is a sales page — preserve persuasive language, CTAs, and urgency cues. Do not soften selling language.",
  "Cold Email":     "This is a cold email — maintain a professional yet personable tone. Preserve the subject line if present.",
  "Webinar":        "This is webinar content — preserve a conversational, instructional tone suitable for live delivery.",
  "Course Content": "This is educational course content — use clear, precise language. Preserve all technical terms and instructional structure.",
};

async function translateChunk(
  chunk: string,
  targetLanguage: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
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
          max_tokens: 4000,
        }),
      });

      // Non-retryable client errors — throw immediately
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const errText = await res.text();
        throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 200)}`);
      }

      // Rate limit or server error — retry with backoff
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = res.headers.get("retry-after");
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : (RETRY_DELAYS_MS[attempt] ?? 15000);
        lastError = new Error(`OpenAI ${res.status} — retrying (attempt ${attempt + 1})`);
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        const errText = await res.text();
        throw new Error(`OpenAI error (${res.status}) after ${attempt + 1} attempts: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = (data.choices?.[0]?.message?.content ?? "").trim();
      if (!content) throw new Error("OpenAI returned empty content");
      return content;
    } catch (err) {
      // Only retry if it's our own retryable error, not a hard throw
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRY_DELAYS_MS.length && !lastError.message.startsWith("OpenAI error (")) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      } else if (lastError.message.startsWith("OpenAI error (")) {
        throw lastError; // non-retryable, propagate immediately
      }
    }
  }

  throw lastError;
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

    const { text, targetLanguage, category, rules } = await req.json();

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

    const categoryLabel = category?.trim() || "General";
    const categoryHint = CATEGORY_GUIDANCE[categoryLabel]
      ? `\n\nCONTENT TYPE: ${categoryLabel}\n${CATEGORY_GUIDANCE[categoryLabel]}`
      : `\n\nCONTENT TYPE: ${categoryLabel}\nTranslate with appropriate tone and terminology for this content type.`;

    const systemPrompt = `You are a professional translator. Translate the provided content accurately into ${targetLanguage}.${categoryHint}${rulesBlock}

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
      // Long text — split into chunks, translate in small batches to avoid rate limits
      const chunks = splitIntoChunks(text, CHUNK_WORDS);
      const results: string[] = [];
      for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
        const batch = chunks.slice(i, i + CHUNK_BATCH);
        const settled = await Promise.allSettled(
          batch.map((c) => translateChunk(c, targetLanguage, systemPrompt, apiKey))
        );
        for (const outcome of settled) {
          if (outcome.status === "fulfilled") {
            results.push(outcome.value);
          } else {
            // Propagate the first chunk failure — better than silently dropping content
            throw new Error(`Chunk translation failed: ${outcome.reason?.message ?? "unknown"}`);
          }
        }
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
