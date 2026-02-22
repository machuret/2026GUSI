-- Add lang column to ChatSession (missing from original migration)
ALTER TABLE "ChatSession"
  ADD COLUMN IF NOT EXISTS "lang" TEXT NOT NULL DEFAULT 'en';
