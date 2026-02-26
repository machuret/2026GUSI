-- Add Mailchimp tables (referenced by API routes but never created)

CREATE TABLE IF NOT EXISTS "MailchimpConnection" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId"    TEXT NOT NULL,
    "apiKey"       TEXT NOT NULL,
    "dataCenter"   TEXT NOT NULL,
    "accountName"  TEXT,
    "accountEmail" TEXT,
    "connectedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "MailchimpConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MailchimpConnection_companyId_key" UNIQUE ("companyId")
);

CREATE TABLE IF NOT EXISTS "MailchimpAudience" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "openRate"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickRate"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "syncedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "MailchimpAudience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MailchimpAudience_companyId_idx" ON "MailchimpAudience"("companyId");

CREATE TABLE IF NOT EXISTS "MailchimpCampaign" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "audienceId"      TEXT,
    "title"           TEXT NOT NULL,
    "subjectLine"     TEXT,
    "status"          TEXT NOT NULL,
    "sendTime"        TIMESTAMPTZ,
    "emailsSent"      INTEGER NOT NULL DEFAULT 0,
    "openRate"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickRate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unsubscribeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "syncedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "MailchimpCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MailchimpCampaign_companyId_idx" ON "MailchimpCampaign"("companyId");
