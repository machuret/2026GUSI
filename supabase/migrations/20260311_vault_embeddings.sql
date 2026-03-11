-- ============================================================================
-- Vault Intelligence: pgvector embeddings + DocumentChunk table
-- Enables semantic search, RAG Q&A, and smart context injection
-- ============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- DocumentChunk: stores chunked + embedded document fragments
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" uuid NOT NULL REFERENCES "Document"(id) ON DELETE CASCADE,
  "companyId" text NOT NULL,
  content text NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  "chunkIndex" integer NOT NULL DEFAULT 0,
  "tokenCount" integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_docchunk_company ON "DocumentChunk" ("companyId");
CREATE INDEX IF NOT EXISTS idx_docchunk_document ON "DocumentChunk" ("documentId");

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_docchunk_embedding ON "DocumentChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add 'digest' column to Document to store AI-generated summary
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS digest text;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "chunkCount" integer DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "embeddingStatus" text DEFAULT 'pending';

-- Helper function: semantic search (used by API routes)
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_company_id text,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  "documentId" uuid,
  content text,
  "chunkIndex" integer,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc."documentId",
    dc.content,
    dc."chunkIndex",
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM "DocumentChunk" dc
  WHERE dc."companyId" = match_company_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger: auto-digest on Document INSERT
CREATE OR REPLACE FUNCTION public.notify_auto_digest_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lciaprvesogbwolaowsj.supabase.co/functions/v1/auto-digest-document',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'Document',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'companyId', NEW."companyId",
        'filename', NEW.filename,
        'fileType', NEW."fileType",
        'content', left(NEW.content, 100)
      )
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_digest_document ON "Document";
CREATE TRIGGER trg_auto_digest_document
  AFTER INSERT ON "Document"
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auto_digest_document();
