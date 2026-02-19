import { openai } from "./openai";
import { db } from "./db";

interface AnalysisResult {
  tone: string;
  vocabulary: string[];
  avgWordCount: number;
  commonPhrases: string[];
  preferredFormats: string[];
  summary: string;
}

export async function analyzeCompanyStyle(
  companyId: string
): Promise<AnalysisResult> {
  const { data: posts } = await db
    .from("ContentPost")
    .select("*")
    .eq("companyId", companyId)
    .order("createdAt", { ascending: false })
    .limit(50);

  const { data: documents } = await db
    .from("Document")
    .select("*")
    .eq("companyId", companyId)
    .order("createdAt", { ascending: false })
    .limit(10);

  const postList = posts ?? [];
  const docList = documents ?? [];

  if (postList.length === 0 && docList.length === 0) {
    throw new Error(
      "No content found for this company. Please ingest some content first."
    );
  }

  const totalWords = postList.reduce(
    (sum: number, p: any) => sum + (p.body ? p.body.split(/\s+/).length : 0),
    0
  );
  const avgWordCount = postList.length > 0 ? Math.round(totalWords / postList.length) : 0;

  const postSamples = postList
    .slice(0, 15)
    .map(
      (p: any, i: number) =>
        `--- Post ${i + 1} (${p.platform}, ${p.contentType}) ---\n${p.title ? p.title + "\n" : ""}${p.body}`
    )
    .join("\n\n");

  const docSamples = docList
    .slice(0, 3)
    .map(
      (d: any, i: number) =>
        `--- Document ${i + 1} (${d.filename}) ---\n${d.content.slice(0, 2000)}`
    )
    .join("\n\n");

  const prompt = `You are a content style analyst. Analyze the following content samples from a company and extract their writing style fingerprint.

CONTENT SAMPLES:
${postSamples}

${docSamples ? `DOCUMENTS:\n${docSamples}` : ""}

Respond in valid JSON with exactly these fields:
{
  "tone": "one or two words describing the overall tone (e.g., professional-friendly, witty-casual, authoritative-warm)",
  "vocabulary": ["array", "of", "10-20", "signature", "words", "or", "terms", "they", "frequently", "use"],
  "commonPhrases": ["array of 5-10 recurring phrases or sentence patterns they tend to use"],
  "preferredFormats": ["array of content format types they prefer, e.g., listicle, narrative, how-to, Q&A, short-form-tip"],
  "summary": "A 2-3 sentence description of this company's writing style, voice, and content approach."
}

Return ONLY the JSON, no markdown fences.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse style analysis from AI. Raw: " + raw.slice(0, 300));
  }

  parsed.avgWordCount = avgWordCount;

  return parsed;
}
