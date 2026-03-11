// Supabase Edge Function: auto-digest-document
// Triggered by INSERT on Document table.
// 1. Fetches full document content
// 2. Chunks it into ~500-token pieces
// 3. Generates OpenAI embeddings for each chunk
// 4. Stores chunks + embeddings in DocumentChunk table
// 5. Generates a summary digest and updates the Document record

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const CHUNK_SIZE = 1500;      // ~375 tokens per chunk
const CHUNK_OVERLAP = 200;    // overlap for context continuity
const EMBEDDING_MODEL = "text-embedding-3-small";
const DIGEST_MODEL = "gpt-4o-mini";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    companyId: string;
    filename: string;
    fileType: string;
    content?: string; // truncated in trigger — we re-fetch
  };
}

// ── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 200);
      const paragraphBreak = slice.lastIndexOf("\n\n");
      const sentenceBreak = slice.lastIndexOf(". ");
      const lineBreak = slice.lastIndexOf("\n");

      if (paragraphBreak > CHUNK_SIZE * 0.6) {
        end = start + paragraphBreak + 2;
      } else if (sentenceBreak > CHUNK_SIZE * 0.6) {
        end = start + sentenceBreak + 2;
      } else if (lineBreak > CHUNK_SIZE * 0.6) {
        end = start + lineBreak + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) { // skip tiny fragments
      chunks.push(chunk);
    }

    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

// ── OpenAI Embedding ────────────────────────────────────────────────────────

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

// ── OpenAI Digest ───────────────────────────────────────────────────────────

async function generateDigest(filename: string, content: string): Promise<string> {
  const truncated = content.slice(0, 8000);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DIGEST_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a knowledge extraction specialist. Given a document, create a dense summary that captures ALL key facts, figures, terminology, and insights. This summary will be used to help an AI answer questions about the document later.

Rules:
- Be thorough — every important fact, number, name, date, claim should be included
- Use bullet points for key facts
- Include any specific terminology or jargon defined in the document
- Note the document's purpose and audience
- Keep under 500 words but maximize information density`,
        },
        {
          role: "user",
          content: `Document: "${filename}"\n\n${truncated}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI digest failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

// ── Supabase helpers ────────────────────────────────────────────────────────

async function supabaseFetch(path: string, opts: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  let payload: WebhookPayload | null = null;
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      console.error("Missing env vars");
      return new Response(JSON.stringify({ error: "Misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify caller is authorized (service role key from trigger)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!payload) {
      return new Response(JSON.stringify({ error: "No payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not INSERT" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const docId = payload.record?.id;
    const companyId = payload.record?.companyId;

    if (!docId || !companyId) {
      return new Response(JSON.stringify({ error: "Missing id or companyId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Digesting document: ${docId} (${payload.record?.filename})`);

    // Mark as processing
    await supabaseFetch(`Document?id=eq.${docId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ embeddingStatus: "processing" }),
    });

    // Fetch full document content
    const docRes = await supabaseFetch(
      `Document?id=eq.${docId}&select=id,companyId,filename,content,fileType`,
    );
    if (!docRes.ok) {
      throw new Error(`Failed to fetch document: ${await docRes.text()}`);
    }

    const docs = await docRes.json();
    const doc = docs[0];
    if (!doc?.content) {
      throw new Error("Document has no content");
    }

    const content: string = doc.content;
    const filename: string = doc.filename;

    // 1. Chunk the document
    const chunks = chunkText(content);
    console.log(`Chunked into ${chunks.length} pieces`);

    if (chunks.length === 0) {
      await supabaseFetch(`Document?id=eq.${docId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ embeddingStatus: "empty", chunkCount: 0 }),
      });
      return new Response(JSON.stringify({ success: true, chunks: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Generate embeddings (batch up to 100 at a time)
    const allEmbeddings: number[][] = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await getEmbeddings(batch);
      allEmbeddings.push(...embeddings);
    }

    console.log(`Generated ${allEmbeddings.length} embeddings`);

    // 3. Delete existing chunks for this document (idempotent)
    await supabaseFetch(`DocumentChunk?documentId=eq.${docId}`, {
      method: "DELETE",
    });

    // 4. Insert chunks with embeddings
    const chunkRows = chunks.map((text, i) => ({
      documentId: docId,
      companyId,
      content: text,
      embedding: JSON.stringify(allEmbeddings[i]),
      chunkIndex: i,
      tokenCount: Math.ceil(text.length / 4),
      metadata: { filename, fileType: doc.fileType },
    }));

    // Insert in batches to avoid payload limits
    for (let i = 0; i < chunkRows.length; i += 20) {
      const batch = chunkRows.slice(i, i + 20);
      const insertRes = await supabaseFetch("DocumentChunk", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(batch),
      });
      if (!insertRes.ok) {
        const err = await insertRes.text();
        throw new Error(`Failed to insert chunks: ${err.slice(0, 200)}`);
      }
    }

    console.log(`Stored ${chunkRows.length} chunks`);

    // 5. Generate digest summary
    const digest = await generateDigest(filename, content);
    console.log(`Generated digest (${digest.length} chars)`);

    // 6. Update document with digest + status
    await supabaseFetch(`Document?id=eq.${docId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        digest,
        chunkCount: chunks.length,
        embeddingStatus: "complete",
      }),
    });

    console.log(`Document ${docId} fully digested: ${chunks.length} chunks, digest ready`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId: docId,
        chunks: chunks.length,
        digestLength: digest.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-digest-document error:", err);

    // Try to mark as failed (payload is from outer scope)
    try {
      const failId = payload?.record?.id;
      if (failId) {
        await supabaseFetch(`Document?id=eq.${failId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ embeddingStatus: "failed" }),
        });
      }
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
