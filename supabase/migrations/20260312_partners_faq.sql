-- Partner profiles table
CREATE TABLE IF NOT EXISTS "Partner" (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "companyId"   text NOT NULL DEFAULT 'demo',
  "name"        text NOT NULL,
  "description" text,
  "logoUrl"     text,
  "url"         text,
  "slug"        text NOT NULL,
  "sortOrder"   int DEFAULT 0,
  "active"      boolean DEFAULT true,
  "createdAt"   timestamptz DEFAULT now(),
  "updatedAt"   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_slug ON "Partner" ("companyId", "slug");
CREATE INDEX IF NOT EXISTS idx_partner_company ON "Partner" ("companyId", "active", "sortOrder");

-- FAQ table
CREATE TABLE IF NOT EXISTS "Faq" (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "companyId"   text NOT NULL DEFAULT 'demo',
  "question"    text NOT NULL,
  "answer"      text NOT NULL,
  "category"    text,
  "sortOrder"   int DEFAULT 0,
  "active"      boolean DEFAULT true,
  "createdAt"   timestamptz DEFAULT now(),
  "updatedAt"   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faq_company ON "Faq" ("companyId", "active", "sortOrder");
