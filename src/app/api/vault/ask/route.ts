export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const EMBEDDING_MODEL = "text-embedding-3-small";

// Generate embedding for a query string
async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// POST /api/vault/ask — RAG: semantic search + GPT answer
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const { question, topK = 8, threshold = 0.35 } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ error: "Question is required (min 3 chars)" }, { status: 400 });
    }

    // 1. Embed the question (truncate to ~6000 chars to stay under embedding token limit)
    const trimmedQuestion = question.trim().slice(0, 6000);
    const queryEmbedding = await embedQuery(trimmedQuestion);

    // 2. Fetch company context for general questions
    const { data: companyRow } = await db
      .from("Company")
      .select("name, dna, industry, website, description")
      .eq("id", DEMO_COMPANY_ID)
      .single();

    // 3. Semantic search via pgvector
    const { data: chunks, error: searchErr } = await db.rpc("match_document_chunks", {
      query_embedding: queryEmbedding as unknown as string,
      match_company_id: DEMO_COMPANY_ID,
      match_threshold: threshold,
      match_count: topK,
    } as Record<string, unknown>);

    if (searchErr) throw searchErr;

    // Build company context snippet if available
    const companyContext = companyRow
      ? [`[Company Profile]`,
         companyRow.name ? `Company Name: ${companyRow.name}` : "",
         companyRow.industry ? `Industry: ${companyRow.industry}` : "",
         companyRow.website ? `Website: ${companyRow.website}` : "",
         companyRow.description ? `Description: ${companyRow.description}` : "",
         companyRow.dna ? `Company DNA:\n${companyRow.dna}` : "",
        ].filter(Boolean).join("\n")
      : null;

    if ((!chunks || chunks.length === 0) && !companyContext) {
      return NextResponse.json({
        answer: "I couldn't find any relevant information in the vault for that question. Try uploading more documents or rephrasing your question.",
        sources: [],
        chunks: 0,
      });
    }

    // 5. Fetch document filenames for citations
    const docIds = chunks && chunks.length > 0
      ? Array.from(new Set(chunks.map((c: { documentId: string }) => c.documentId))) as string[]
      : [];
    let nameMap = new Map<string, string>();
    if (docIds.length > 0) {
      const { data: docNames } = await db
        .from("Document")
        .select("id, filename")
        .in("id", docIds);
      nameMap = new Map(
        (docNames ?? []).map((d: { id: string; filename: string }) => [d.id, d.filename])
      );
    }

    // 4. Build context from matched chunks + company data
    const contextParts: string[] = [];

    if (companyContext) {
      contextParts.push(companyContext);
    }

    if (chunks && chunks.length > 0) {
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i] as { documentId: string; content: string; similarity: number; chunkIndex: number };
        const filename = nameMap.get(c.documentId) ?? "Unknown";
        contextParts.push(`[Source ${i + 1}: "${filename}" (relevance: ${(c.similarity * 100).toFixed(0)}%)]\n${c.content}`);
      }
    }

    const context = contextParts.join("\n\n---\n\n");

    // 6. GPT answer with sources
    const systemPrompt = `You are a knowledgeable assistant with access to the company's document vault. Answer the user's question using ONLY the provided source documents. Be thorough, specific, and cite your sources.

Rules:
- Answer based strictly on the provided documents — do not make up information
- Cite sources by name, e.g. "According to [filename]..."
- If the documents contain partial information, say what you found and what's missing
- If the documents don't contain the answer, clearly state that
- Be concise but complete — aim for 2-5 paragraphs
- Use bullet points for lists of facts or items
- If asked about numbers, dates, or specific data, quote them exactly from the source`;

    const userPrompt = `## VAULT DOCUMENTS\n${context}\n\n## QUESTION\n${question}`;

    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.vaultAsk,
      maxTokens: 1500,
      temperature: 0.1,
    });

    logAiUsage({
      model: MODEL_CONFIG.vaultAsk,
      feature: "vault_ask",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      userId: authUser.id,
    });

    // Build source citations
    const sources = (chunks ?? []).map(
      (c: { documentId: string; similarity: number; chunkIndex: number }) => ({
        documentId: c.documentId,
        filename: nameMap.get(c.documentId) ?? "Unknown",
        similarity: c.similarity,
        chunkIndex: c.chunkIndex,
      })
    );

    // Deduplicate sources by documentId
    const seen = new Set<string>();
    const uniqueSources = sources.filter((s: { documentId: string }) => {
      if (seen.has(s.documentId)) return false;
      seen.add(s.documentId);
      return true;
    });

    return NextResponse.json({
      answer: result.content,
      sources: uniqueSources,
      chunks: chunks.length,
      tokens: result.totalTokens,
    });
  } catch (err) {
    return handleApiError(err, "Vault Ask");
  }
}
