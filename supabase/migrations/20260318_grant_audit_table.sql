-- GrantAudit: persists AI audit results for grant drafts
CREATE TABLE IF NOT EXISTS "GrantAudit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" TEXT NOT NULL,
  "draftId" UUID NOT NULL,
  "grantName" TEXT NOT NULL,
  "overallScore" INTEGER NOT NULL DEFAULT 0,
  "overallVerdict" TEXT NOT NULL DEFAULT 'Poor',
  "summary" TEXT NOT NULL DEFAULT '',
  "sectionAudits" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "topRecommendations" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "fullResult" JSONB,
  "improvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grant_audit_company ON "GrantAudit" ("companyId");
CREATE INDEX IF NOT EXISTS idx_grant_audit_draft ON "GrantAudit" ("draftId");
