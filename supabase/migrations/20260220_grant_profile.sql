-- GrantProfile: stores the company's grant eligibility profile for intelligent matching
CREATE TABLE IF NOT EXISTS "GrantProfile" (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId"       TEXT NOT NULL UNIQUE,
  -- Organisation identity
  "orgType"         TEXT,           -- e.g. "Non-profit", "SME", "University", "Social Enterprise"
  "sector"          TEXT,           -- e.g. "Health", "Education", "Technology", "Environment"
  "subSector"       TEXT,           -- more specific e.g. "Medical Imaging", "EdTech"
  "location"        TEXT,           -- e.g. "Victoria, Australia"
  "country"         TEXT DEFAULT 'Australia',
  -- Stage & size
  "stage"           TEXT,           -- e.g. "Early Stage", "Growth", "Established"
  "teamSize"        TEXT,           -- e.g. "1-5", "6-20", "21-50", "50+"
  "annualRevenue"   TEXT,           -- e.g. "Under $500k", "$500k-$2M", "$2M+"
  "yearFounded"     TEXT,
  -- Grant focus
  "focusAreas"      TEXT[],         -- e.g. ["R&D", "Export", "Training", "Innovation"]
  "targetFundingMin" INTEGER,       -- minimum grant amount interested in (AUD)
  "targetFundingMax" INTEGER,       -- maximum grant amount
  "preferredDuration" TEXT,         -- e.g. "Under 12 months", "1-2 years", "2+ years"
  -- Eligibility flags
  "isRegisteredCharity" BOOLEAN DEFAULT false,
  "hasABN"          BOOLEAN DEFAULT true,
  "hasACN"          BOOLEAN DEFAULT false,
  "indigenousOwned" BOOLEAN DEFAULT false,
  "womanOwned"      BOOLEAN DEFAULT false,
  "regionalOrRural" BOOLEAN DEFAULT false,
  -- Free-text context for AI
  "missionStatement" TEXT,
  "keyActivities"   TEXT,
  "pastGrantsWon"   TEXT,
  "uniqueStrengths" TEXT,
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new columns to Grant table
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "matchScore"     INTEGER,   -- 0-100 profile match score
  ADD COLUMN IF NOT EXISTS "complexityScore" INTEGER,  -- 0-100 AI complexity score
  ADD COLUMN IF NOT EXISTS "complexityLabel" TEXT,     -- "Low" | "Medium" | "High" | "Very High"
  ADD COLUMN IF NOT EXISTS "complexityNotes" TEXT;     -- AI explanation of complexity
