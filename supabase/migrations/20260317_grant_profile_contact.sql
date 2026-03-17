-- Add grant contact person fields to GrantProfile
-- Used in /grants/profile to store the person responsible for grant applications.
-- These fields flow into all AI-generated grant sections via buildProfileContext().
ALTER TABLE "GrantProfile"
  ADD COLUMN IF NOT EXISTS "contactName"    TEXT,   -- e.g. "Jane Smith"
  ADD COLUMN IF NOT EXISTS "contactRole"    TEXT,   -- e.g. "CEO", "Grants Manager"
  ADD COLUMN IF NOT EXISTS "contactEmail"   TEXT,   -- e.g. "jane@org.com"
  ADD COLUMN IF NOT EXISTS "contactPhone"   TEXT,   -- e.g. "+61 400 000 000"
  ADD COLUMN IF NOT EXISTS "contactAddress" TEXT;   -- e.g. "123 Main St, Melbourne VIC 3000"

-- Secondary org type (added in earlier session — safe to re-run)
ALTER TABLE "GrantProfile"
  ADD COLUMN IF NOT EXISTS "orgType2" TEXT;         -- e.g. "Social Enterprise" alongside "Non-profit"
