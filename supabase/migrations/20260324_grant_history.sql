-- GrantHistory: stores past grant submissions, partner approaches, and outcomes.
-- Used for CRM duplicate-detection alerts and AI context injection.
CREATE TABLE IF NOT EXISTS "GrantHistory" (
  "id"             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId"      TEXT        NOT NULL DEFAULT 'demo',
  "funderName"     TEXT        NOT NULL,
  "grantName"      TEXT,
  "partnerOrg"     TEXT,
  "region"         TEXT,
  "outcome"        TEXT        CHECK ("outcome" IN (
                     'Won','Submitted','Rejected','Shortlisted',
                     'NotSubmitted','Exploratory','Active','Pending'
                   )),
  "amount"         TEXT,
  "rejectionReason" TEXT,
  "notes"          TEXT,
  "submittedAt"    DATE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "GrantHistory_companyId_idx"   ON "GrantHistory" ("companyId");
CREATE INDEX IF NOT EXISTS "GrantHistory_funderName_idx"  ON "GrantHistory" (lower("funderName"));
CREATE INDEX IF NOT EXISTS "GrantHistory_outcome_idx"     ON "GrantHistory" ("outcome");
