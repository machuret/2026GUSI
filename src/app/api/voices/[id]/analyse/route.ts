export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_SAMPLE_WORDS = 12000; // token budget for samples fed to GPT

function countTokensApprox(text: string) {
  return Math.ceil(text.split(/\s+/).length * 1.35);
}

// POST /api/voices/[id]/analyse — deep style analysis of an author
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });

    const { data: author } = await db.from("Author").select("*").eq("id", params.id).maybeSingle();
    if (!author) return NextResponse.json({ error: "Author not found" }, { status: 404 });

    const { data: posts } = await db
      .from("AuthorPost")
      .select("title, body, contentType, platform")
      .eq("authorId", params.id)
      .order("createdAt", { ascending: false })
      .limit(80);

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: "No content uploaded for this author yet. Upload samples first." }, { status: 400 });
    }

    // Build sample block respecting token budget
    let sampleBlock = "";
    let wordBudget = MAX_SAMPLE_WORDS;
    for (const p of posts) {
      const words = p.body.trim().split(/\s+/).length;
      if (wordBudget <= 0) break;
      const take = Math.min(words, wordBudget);
      const excerpt = p.body.trim().split(/\s+/).slice(0, take).join(" ");
      sampleBlock += `\n--- [${p.contentType} / ${p.platform}] ${p.title ? p.title + "\n" : ""}${excerpt}\n`;
      wordBudget -= take;
    }

    const totalWords = posts.reduce((s, p) => s + p.body.trim().split(/\s+/).length, 0);
    const avgWordCount = Math.round(totalWords / posts.length);

    const systemPrompt = `You are an elite writing style analyst and voice cloning specialist. Your job is to create a comprehensive, deeply detailed fingerprint of an author's writing style that will be used to clone their voice with AI.

Analyze every dimension of the writing: sentence construction, rhythm, vocabulary choices, rhetorical devices, emotional register, structural patterns, unique quirks, and anything that makes this author's voice distinctive and recognizable.

Be extremely specific — generic descriptions are useless. Extract actual phrases, actual sentence patterns, actual words they use.`;

    const userPrompt = `Author: ${author.name}
${author.bio ? `Bio: ${author.bio}\n` : ""}
Total samples: ${posts.length} pieces, ~${totalWords.toLocaleString()} words

CONTENT SAMPLES:
${sampleBlock}

Produce a comprehensive style fingerprint as JSON with EXACTLY these fields:
{
  "tone": "2-4 words capturing the dominant emotional register (e.g., 'authoritative-yet-warm', 'urgent-and-direct')",
  "vocabulary": ["20-30 signature words or domain terms this author uses frequently or distinctively"],
  "commonPhrases": ["10-15 actual recurring phrases, sentence starters, or transitions they use"],
  "sentencePatterns": ["8-12 specific sentence construction patterns, e.g., 'Opens with a rhetorical question', 'Uses em-dash for dramatic pause', 'Short punchy sentences after long ones'"],
  "rhetoricalDevices": ["6-10 rhetorical techniques they use: anaphora, tricolon, contrast, metaphor, etc. — with examples"],
  "openingHooks": ["5-8 patterns for how they open pieces — actual examples or templates"],
  "closingPatterns": ["4-6 patterns for how they close or sign off"],
  "emotionalRange": "Describe the emotional spectrum: when do they get passionate, clinical, humorous, urgent?",
  "uniqueQuirks": "3-5 truly distinctive habits that make this author immediately recognizable — punctuation, capitalization, paragraph length, etc.",
  "preferredFormats": ["5-8 structural formats they prefer: listicle, narrative arc, problem-solution, Q&A, etc."],
  "summary": "A rich 4-6 sentence description of this author's complete voice, style, and approach that could be used as a system prompt for an AI to clone them.",
  "systemPrompt": "A complete, ready-to-use system prompt (200-400 words) that instructs an AI to write EXACTLY like this author. Include all the key patterns, vocabulary, sentence structures, and quirks. This will be injected directly into GPT-4o."
}

Return ONLY valid JSON, no markdown fences.`;

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `OpenAI error: ${err.slice(0, 200)}` }, { status: 502 });
    }

    const aiData = await res.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    const tokenCount = aiData.usage?.total_tokens ?? countTokensApprox(raw);

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 }); }

    // Upsert style profile
    const { data: style, error: upsertErr } = await db
      .from("AuthorStyleProfile")
      .upsert({
        authorId: params.id,
        companyId: DEMO_COMPANY_ID,
        tone: parsed.tone ?? "",
        avgWordCount,
        vocabulary: parsed.vocabulary ?? [],
        commonPhrases: parsed.commonPhrases ?? [],
        preferredFormats: parsed.preferredFormats ?? [],
        sentencePatterns: parsed.sentencePatterns ?? [],
        rhetoricalDevices: parsed.rhetoricalDevices ?? [],
        openingHooks: parsed.openingHooks ?? [],
        closingPatterns: parsed.closingPatterns ?? [],
        emotionalRange: parsed.emotionalRange ?? "",
        uniqueQuirks: parsed.uniqueQuirks ?? "",
        summary: parsed.summary ?? "",
        systemPrompt: parsed.systemPrompt ?? "",
        tokenCount,
        updatedAt: new Date().toISOString(),
      }, { onConflict: "authorId" })
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    // Mark author as analysed
    await db.from("Author").update({ analysedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", params.id);

    return NextResponse.json({ success: true, style, tokenCount });
  } catch (err) {
    return handleApiError(err, "Voice analyse");
  }
}
