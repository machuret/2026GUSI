-- Add enrichmentStatus column to Lead table for tracking enrichment progress
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichmentStatus" text DEFAULT 'pending';

-- Index for filtering by enrichment status
CREATE INDEX IF NOT EXISTS idx_lead_enrichment_status ON "Lead" ("enrichmentStatus");
