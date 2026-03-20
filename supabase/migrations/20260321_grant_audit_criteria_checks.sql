-- Add criteriaChecks JSONB column to GrantAudit table
ALTER TABLE "GrantAudit"
  ADD COLUMN IF NOT EXISTS "criteriaChecks" JSONB;
