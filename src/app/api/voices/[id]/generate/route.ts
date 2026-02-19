export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logAiUsage } from "@/lib/aiUsage";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { z } from "zod";

const generateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  contentType: z.string().default("blog"),
  platform: z.string().default("website"),
  targetWords: z.number().min(50).max(3000).default(400),
  temperature: z.number().min(0).max(1).default(0.75),
});

// POST /api/voices/[id]/generate — generate content in an author's voice
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const [{ data: author }, { data: style }] = await Promise.all([
      db.from("Author").select("name, bio").eq("id", params.id).maybeSingle(),
      db.from("AuthorStyleProfile").select("*").eq("authorId", params.id).maybeSingle(),
    ]);

    if (!author) return NextResponse.json({ error: "Author not found" }, { status: 404 });
    if (!style?.systemPrompt) {
      return NextResponse.json({ error: "This author has not been analysed yet. Run style analysis first." }, { status: 400 });
    }

    const body = await req.json();
    const data = generateSchema.parse(body);

    // Fetch 3 example posts for few-shot learning
    const { data: examples } = await db
      .from("AuthorPost")
      .select("title, body, contentType")
      .eq("authorId", params.id)
      .eq("contentType", data.contentType)
      .order("createdAt", { ascending: false })
      .limit(3);

    // Fall back to any posts if no type match
    const { data: anyExamples } = (!examples?.length)
      ? await db.from("AuthorPost").select("title, body, contentType").eq("authorId", params.id).order("createdAt", { ascending: false }).limit(3)
      : { data: null };

    const examplePosts = examples?.length ? examples : (anyExamples ?? []);
    const examplesBlock = examplePosts.length > 0
      ? "\n\nHERE ARE REAL EXAMPLES OF THIS AUTHOR'S WRITING — match this style exactly:\n" +
        examplePosts.map((p, i) =>
          `--- Example ${i + 1} (${p.contentType}) ---\n${p.title ? p.title + "\n" : ""}${p.body.slice(0, 800)}`
        ).join("\n\n")
      : "";

    const systemPrompt = `${style.systemPrompt}
${examplesBlock}

GENERATION RULES:
- Write EXACTLY like ${author.name} — same rhythm, vocabulary, sentence patterns, quirks
- Content type: ${data.contentType}${data.platform !== "website" ? ` for ${data.platform}` : ""}
- Target length: ~${data.targetWords} words
- Output ONLY the finished content — no meta-commentary, no "here is your content"`;

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt: data.prompt,
      model: MODEL_CONFIG.voiceGenerate,
      maxTokens: Math.min(4000, Math.ceil(data.targetWords * 1.5)),
      temperature: data.temperature,
      jsonMode: false,
    });

    const output = aiResult.content.trim();
    const wordCount = output.split(/\s+/).filter(Boolean).length;

    logAiUsage({ model: MODEL_CONFIG.voiceGenerate, feature: "voice_generate", promptTokens: aiResult.promptTokens, completionTokens: aiResult.completionTokens });

    return NextResponse.json({
      success: true,
      output,
      wordCount,
      tokensUsed: aiResult.totalTokens,
      author: author.name,
      model: MODEL_CONFIG.voiceGenerate,
    });
  } catch (err) {
    return handleApiError(err, "Voice generate");
  }
}
