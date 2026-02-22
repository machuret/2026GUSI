-- Safety Audit: ComplianceRule and AuditResult tables
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS "ComplianceRule" (
  "id"          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId"   TEXT        NOT NULL,
  "ruleType"    TEXT        NOT NULL CHECK ("ruleType" IN ('legal', 'medical', 'ethical')),
  "title"       TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "severity"    TEXT        NOT NULL DEFAULT 'high' CHECK ("severity" IN ('critical', 'high', 'medium', 'low')),
  "active"      BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ComplianceRule_companyId_idx" ON "ComplianceRule" ("companyId");
CREATE INDEX IF NOT EXISTS "ComplianceRule_ruleType_idx"  ON "ComplianceRule" ("ruleType");

CREATE TABLE IF NOT EXISTS "AuditResult" (
  "id"              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId"       TEXT        NOT NULL,
  "contentId"       TEXT        NOT NULL,
  "contentCategory" TEXT        NOT NULL,
  "contentSnippet"  TEXT,
  "passed"          BOOLEAN     NOT NULL DEFAULT false,
  "violations"      JSONB       NOT NULL DEFAULT '[]',
  "scannedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "scannedBy"       TEXT
);

CREATE INDEX IF NOT EXISTS "AuditResult_companyId_idx"  ON "AuditResult" ("companyId");
CREATE INDEX IF NOT EXISTS "AuditResult_contentId_idx"  ON "AuditResult" ("contentId");
CREATE INDEX IF NOT EXISTS "AuditResult_scannedAt_idx"  ON "AuditResult" ("scannedAt");
