-- FunderTemplate: per-funder preferences/winning patterns for repeat applications
CREATE TABLE IF NOT EXISTS "FunderTemplate" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId"   TEXT NOT NULL,
  "funderName"  TEXT NOT NULL,           -- e.g. "Gates Foundation"
  "preferences" TEXT,                    -- AI instructions: what this funder loves
  "patterns"    TEXT,                    -- what has won before with this funder
  "avoid"       TEXT,                    -- what to avoid with this funder
  "notes"       TEXT,                    -- general notes
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("companyId", "funderName")
);

-- GrantDraftHistory: snapshot of a draft before it gets overwritten
CREATE TABLE IF NOT EXISTS "GrantDraftHistory" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "draftId"     TEXT NOT NULL,           -- references GrantDraft.id
  "companyId"   TEXT NOT NULL,
  "grantId"     TEXT NOT NULL,
  "grantName"   TEXT NOT NULL,
  "sections"    JSONB NOT NULL,
  "brief"       JSONB,
  "tone"        TEXT NOT NULL DEFAULT 'first_person',
  "length"      TEXT NOT NULL DEFAULT 'standard',
  "snapshotAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "label"       TEXT                     -- e.g. "Before regen all", "v2"
);

-- Index for fast lookup by draftId
CREATE INDEX IF NOT EXISTS "idx_draft_history_draftId" ON "GrantDraftHistory"("draftId");
