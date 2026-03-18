-- Add contacts JSONB array to GrantProfile for multiple founders/contacts
ALTER TABLE "GrantProfile"
  ADD COLUMN IF NOT EXISTS "contacts" JSONB NOT NULL DEFAULT '[]'::jsonb;
