-- GrantDraft: stores AI-generated grant application drafts
-- Grant.id is TEXT (gen_random_uuid()::text) so grantId must also be TEXT — no FK
CREATE TABLE IF NOT EXISTS "GrantDraft" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "grantId"   TEXT NOT NULL,
  "grantName" TEXT NOT NULL,
  sections    JSONB NOT NULL DEFAULT '{}',
  brief       JSONB,
  tone        TEXT DEFAULT 'first_person',
  length      TEXT DEFAULT 'standard',
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "GrantDraft_companyId_idx" ON "GrantDraft"("companyId");
CREATE INDEX IF NOT EXISTS "GrantDraft_grantId_idx"   ON "GrantDraft"("grantId");
