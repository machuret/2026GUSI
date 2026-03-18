-- Add extraDocs JSONB column for storing additional org documents
-- (e.g. Global Health Initiatives page, Capability Statement, etc.)
-- These flow into AI grant writing context via buildProfileContext().
ALTER TABLE "GrantProfile"
  ADD COLUMN IF NOT EXISTS "extraDocs" JSONB DEFAULT '[]'::jsonb;

-- Rename ABN/ACN columns to EIN (GUSI is American, not Australian)
-- Safe: column may already have been renamed or may not exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GrantProfile' AND column_name = 'hasABN') THEN
    ALTER TABLE "GrantProfile" RENAME COLUMN "hasABN" TO "hasEIN";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'GrantProfile' AND column_name = 'hasACN') THEN
    ALTER TABLE "GrantProfile" DROP COLUMN "hasACN";
  END IF;
END $$;

-- Update default country from Australia to United States
ALTER TABLE "GrantProfile" ALTER COLUMN "country" SET DEFAULT 'United States';
