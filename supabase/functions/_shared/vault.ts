/**
 * _shared/vault.ts
 * Knowledge vault retrieval — basic (recent docs) and semantic (pgvector).
 *
 * Exports:
 *  - getVaultBlock         — recent-document fallback retrieval
 *  - getSemanticVaultBlock — pgvector similarity search with OpenAI embedding
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Maximum total characters injected into prompts from vault documents. */
const VAULT_BUDGET_CHARS = 12_000;

/** Maximum characters taken from any single document chunk. */
const CHUNK_MAX_CHARS = 2_000;

// ── Basic vault (recent docs) ─────────────────────────────────────────────────

/**
 * Fetches the 10 most recently uploaded vault documents for a company and
 * returns a budget-capped `## KNOWLEDGE VAULT` prompt block.
 * Used as a fallback when semantic search is unavailable.
 *
 * @param db         Service-role Supabase client.
 * @param companyId  Company whose documents to retrieve.
 */
export async function getVaultBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
): Promise<string> {
  const { data: docs } = await db
    .from("Document")
    .select("filename, content")
    .eq("companyId", companyId)
    .order("createdAt", { ascending: false })
    .limit(10);

  if (!docs || docs.length === 0) return "";

  let budget = VAULT_BUDGET_CHARS;
  const chunks: string[] = [];
  for (const doc of docs) {
    if (budget <= 0) break;
    const chunk = (doc.content as string).slice(0, Math.min(CHUNK_MAX_CHARS, budget));
    budget -= chunk.length;
    chunks.push(`--- ${doc.filename} ---\n${chunk}`);
  }
  return `## KNOWLEDGE VAULT\n${chunks.join("\n\n")}`;
}

// ── Semantic vault (pgvector) ─────────────────────────────────────────────────

/**
 * Retrieves vault content semantically via pgvector `match_document_chunks` RPC,
 * ranking chunks by cosine similarity to an OpenAI embedding of `taskHint`.
 *
 * Falls back to `getVaultBlock` (recent-docs) on any failure — safe to call even
 * if the embedding migration has not been run.
 *
 * @param db            Service-role Supabase client.
 * @param companyId     Company whose vault to search.
 * @param taskHint      Free-text query to embed (e.g. grant name + section name).
 * @param openaiApiKey  OpenAI API key for the embeddings call.
 */
export async function getSemanticVaultBlock(
  db: ReturnType<typeof createClient>,
  companyId: string,
  taskHint: string,
  openaiApiKey: string,
): Promise<string> {
  try {
    const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: taskHint }),
    });
    if (!embedRes.ok) throw new Error("embedding failed");
    const embedData = await embedRes.json();
    const embedding: number[] | undefined = embedData.data?.[0]?.embedding;
    if (!embedding) throw new Error("no embedding returned");

    const { data: chunks, error: rpcErr } = await db.rpc("match_document_chunks", {
      query_embedding: embedding,
      match_company_id: companyId,
      match_threshold: 0.6,
      match_count: 12,
    } as Record<string, unknown>);
    if (rpcErr || !chunks || chunks.length === 0) throw new Error("no matching chunks");

    const docIds = Array.from(
      new Set(chunks.map((c: { documentId: string }) => c.documentId)),
    ) as string[];
    const { data: docNames } = await db
      .from("Document")
      .select("id, filename")
      .in("id", docIds);
    const nameMap = new Map(
      (docNames ?? []).map((d: { id: string; filename: string }) => [d.id, d.filename]),
    );

    let budget = VAULT_BUDGET_CHARS;
    const parts: string[] = [];
    for (const chunk of chunks) {
      if (budget <= 0) break;
      const fname = nameMap.get(chunk.documentId) ?? "Document";
      const text = (chunk.content as string).slice(0, Math.min(CHUNK_MAX_CHARS, budget));
      budget -= text.length;
      parts.push(
        `--- ${fname} (relevance: ${((chunk.similarity as number) * 100).toFixed(0)}%) ---\n${text}`,
      );
    }
    return parts.length > 0
      ? `## KNOWLEDGE VAULT (semantically matched)\nThe following excerpts are most relevant to this section:\n\n${parts.join("\n\n")}`
      : await getVaultBlock(db, companyId);
  } catch {
    return getVaultBlock(db, companyId);
  }
}
