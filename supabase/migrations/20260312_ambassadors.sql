-- Ambassador profiles table
CREATE TABLE IF NOT EXISTS "Ambassador" (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "companyId"   text NOT NULL DEFAULT 'demo',
  "name"        text NOT NULL,
  "title"       text,
  "bio"         text,
  "photoUrl"    text,
  "slug"        text NOT NULL,
  "sortOrder"   int DEFAULT 0,
  "active"      boolean DEFAULT true,
  "linkedinUrl" text,
  "websiteUrl"  text,
  "createdAt"   timestamptz DEFAULT now(),
  "updatedAt"   timestamptz DEFAULT now()
);

-- Unique slug per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassador_slug ON "Ambassador" ("companyId", "slug");
CREATE INDEX IF NOT EXISTS idx_ambassador_company ON "Ambassador" ("companyId", "active", "sortOrder");
