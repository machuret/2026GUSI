-- Grant Examples table: stores example grant applications for use as AI writing references
CREATE TABLE IF NOT EXISTS "GrantExample" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "grantName" TEXT NOT NULL DEFAULT '',
  "funder" TEXT NOT NULL DEFAULT '',
  "amount" TEXT NOT NULL DEFAULT '',
  "outcome" TEXT NOT NULL DEFAULT '',
  "section" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by company
CREATE INDEX IF NOT EXISTS "GrantExample_companyId_idx" ON "GrantExample" ("companyId");

-- RLS
ALTER TABLE "GrantExample" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grant_example_select" ON "GrantExample"
  FOR SELECT USING (true);

CREATE POLICY "grant_example_insert" ON "GrantExample"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "grant_example_update" ON "GrantExample"
  FOR UPDATE USING (true);

CREATE POLICY "grant_example_delete" ON "GrantExample"
  FOR DELETE USING (true);
