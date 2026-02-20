-- Add CRM pipeline columns to Grant table
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "crmStatus" TEXT CHECK ("crmStatus" IN ('Researching', 'Pipeline', 'Active', 'Submitted', 'Won', 'Lost')),
  ADD COLUMN IF NOT EXISTS "crmNotes" TEXT;

-- Index for fast CRM board queries
CREATE INDEX IF NOT EXISTS "Grant_crmStatus_idx" ON "Grant" ("crmStatus");
