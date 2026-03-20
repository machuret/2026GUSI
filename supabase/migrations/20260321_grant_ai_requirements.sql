-- Add aiRequirements JSONB column to Grant table for storing extracted funder criteria
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "aiRequirements" JSONB;
