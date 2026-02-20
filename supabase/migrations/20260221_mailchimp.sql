-- Mailchimp integration tables

CREATE TABLE IF NOT EXISTS "MailchimpConnection" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId"    TEXT NOT NULL UNIQUE,
  "apiKey"       TEXT NOT NULL,
  "dataCenter"   TEXT NOT NULL,
  "accountName"  TEXT,
  "accountEmail" TEXT,
  "connectedAt"  TIMESTAMPTZ DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "MailchimpConnection_companyId_idx" ON "MailchimpConnection"("companyId");

CREATE TABLE IF NOT EXISTS "MailchimpAudience" (
  id              TEXT PRIMARY KEY,
  "companyId"     TEXT NOT NULL,
  name            TEXT NOT NULL,
  "memberCount"   INTEGER DEFAULT 0,
  "openRate"      FLOAT DEFAULT 0,
  "clickRate"     FLOAT DEFAULT 0,
  "syncedAt"      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "MailchimpAudience_companyId_idx" ON "MailchimpAudience"("companyId");

CREATE TABLE IF NOT EXISTS "MailchimpCampaign" (
  id                  TEXT PRIMARY KEY,
  "companyId"         TEXT NOT NULL,
  "audienceId"        TEXT,
  title               TEXT NOT NULL,
  "subjectLine"       TEXT,
  status              TEXT,
  "sendTime"          TIMESTAMPTZ,
  "emailsSent"        INTEGER DEFAULT 0,
  "openRate"          FLOAT DEFAULT 0,
  "clickRate"         FLOAT DEFAULT 0,
  "unsubscribeRate"   FLOAT DEFAULT 0,
  "syncedAt"          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "MailchimpCampaign_companyId_idx" ON "MailchimpCampaign"("companyId");
