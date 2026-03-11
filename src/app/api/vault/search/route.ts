export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const EMBEDDING_MODEL = "text-embedding-3-small";

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

// POST /api/vault/search — semantic search across vault documents
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { query, topK = 10, threshold = 0.6 } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const queryEmbedding = await embedQuery(query.trim());

    const { data: chunks, error: searchErr } = await db.rpc("match_document_chunks", {
      query_embedding: queryEmbedding as unknown as string,
      match_company_id: DEMO_COMPANY_ID,
      match_threshold: threshold,
      match_count: topK,
    } as Record<string, unknown>);

    if (searchErr) throw searchErr;

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // Fetch filenames
    const docIds = Array.from(new Set(chunks.map((c: { documentId: string }) => c.documentId))) as string[];
    const { data: docNames } = await db
      .from("Document")
      .select("id, filename, fileType")
      .in("id", docIds);

    const nameMap = new Map(
      (docNames ?? []).map((d: { id: string; filename: string; fileType: string }) => [d.id, { filename: d.filename, fileType: d.fileType }])
    );

    const results = chunks.map(
      (c: { id: string; documentId: string; content: string; similarity: number; chunkIndex: number }) => ({
        id: c.id,
        documentId: c.documentId,
        filename: nameMap.get(c.documentId)?.filename ?? "Unknown",
        fileType: nameMap.get(c.documentId)?.fileType ?? "text",
        content: c.content,
        similarity: c.similarity,
        chunkIndex: c.chunkIndex,
      })
    );

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    return handleApiError(err, "Vault Search");
  }
}
