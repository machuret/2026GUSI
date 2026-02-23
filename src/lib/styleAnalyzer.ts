import { openai } from "./openai";
import { db } from "./db";

export interface AnalysisResult {
  tone: string;
  vocabulary: string[];
  avgWordCount: number;
  commonPhrases: string[];
  preferredFormats: string[];
  summary: string;
}

export interface FullStyleAnalysis {
  global: AnalysisResult;
  byContentType: Record<string, AnalysisResult>;
}

const MIN_POSTS_FOR_TYPE_PROFILE = 3;

function buildAnalysisPrompt(postSamples: string, docSamples: string, label: string): string {
  return `You are a content style analyst. Analyze the following ${label} content samples and extract their writing style fingerprint.

CONTENT SAMPLES:
${postSamples}

${docSamples ? `DOCUMENTS:\n${docSamples}` : ""}

Respond in valid JSON with exactly these fields:
{
  "tone": "one or two words describing the overall tone (e.g., professional-friendly, witty-casual, authoritative-warm)",
  "vocabulary": ["array", "of", "10-20", "signature", "words", "or", "terms", "they", "frequently", "use"],
  "commonPhrases": ["array of 5-10 recurring phrases or sentence patterns they tend to use"],
  "preferredFormats": ["array of content format types they prefer, e.g., listicle, narrative, how-to, Q&A, short-form-tip"],
  "summary": "A 2-3 sentence description of this ${label} writing style, voice, and content approach."
}

Return ONLY the JSON, no markdown fences.`;
}

function formatPosts(postList: any[], maxCount: number): string {
  return postList
    .slice(0, maxCount)
    .map(
      (p: any, i: number) =>
        `--- Post ${i + 1} (${p.platform}, ${p.contentType}) ---\n${p.title ? p.title + "\n" : ""}${p.body}`
    )
    .join("\n\n");
}

function computeAvgWords(postList: any[]): number {
  const totalWords = postList.reduce(
    (sum: number, p: any) => sum + (p.body ? p.body.split(/\s+/).length : 0),
    0
  );
  return postList.length > 0 ? Math.round(totalWords / postList.length) : 0;
}

async function runAnalysis(prompt: string, avgWordCount: number): Promise<AnalysisResult> {
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

/**
 * Analyzes company style globally AND per content type.
 * Returns a global profile plus a map of per-type profiles for types with 3+ posts.
 */
export async function analyzeCompanyStyle(
  companyId: string
): Promise<FullStyleAnalysis> {
  const [{ data: posts }, { data: documents }] = await Promise.all([
    db.from("ContentPost").select("*").eq("companyId", companyId)
      .order("createdAt", { ascending: false }).limit(100),
    db.from("Document").select("*").eq("companyId", companyId)
      .order("createdAt", { ascending: false }).limit(10),
  ]);

  const postList = posts ?? [];
  const docList = documents ?? [];

  if (postList.length === 0 && docList.length === 0) {
    throw new Error("No content found for this company. Please ingest some content first.");
  }

  const docSamples = docList
    .slice(0, 3)
    .map((d: any, i: number) => `--- Document ${i + 1} (${d.filename}) ---\n${d.content.slice(0, 2000)}`)
    .join("\n\n");

  // 1. Global analysis
  const globalPrompt = buildAnalysisPrompt(formatPosts(postList, 15), docSamples, "company-wide");
  const globalResult = await runAnalysis(globalPrompt, computeAvgWords(postList));

  // 2. Per-content-type analysis (in parallel, only for types with enough posts)
  const byType: Record<string, any[]> = {};
  for (const p of postList) {
    const ct = p.contentType ?? "unknown";
    if (!byType[ct]) byType[ct] = [];
    byType[ct].push(p);
  }

  const typeEntries = Object.entries(byType).filter(
    ([, typePosts]) => typePosts.length >= MIN_POSTS_FOR_TYPE_PROFILE
  );

  const typeResults = await Promise.allSettled(
    typeEntries.map(async ([ct, typePosts]) => {
      const prompt = buildAnalysisPrompt(formatPosts(typePosts, 10), "", `${ct}`);
      const result = await runAnalysis(prompt, computeAvgWords(typePosts));
      return { contentType: ct, result };
    })
  );

  const byContentType: Record<string, AnalysisResult> = {};
  for (const r of typeResults) {
    if (r.status === "fulfilled") {
      byContentType[r.value.contentType] = r.value.result;
    }
  }

  return { global: globalResult, byContentType };
}
