-- Add Missing Performance Indexes
-- Issue: Queries filtering by aiRecommendation will be slow without index

-- Index for filtering by AI recommendation
CREATE INDEX IF NOT EXISTS "Grant_aiRecommendation_idx" 
  ON "Grant" ("aiRecommendation")
  WHERE "aiRecommendation" IS NOT NULL;

-- Index for filtering by decision + aiRecommendation (override queries)
CREATE INDEX IF NOT EXISTS "Grant_decision_aiRecommendation_idx" 
  ON "Grant" ("decision", "aiRecommendation")
  WHERE "decision" IS NOT NULL AND "aiRecommendation" IS NOT NULL;

-- Index for decisionAt (sorting by decision time)
CREATE INDEX IF NOT EXISTS "Grant_decisionAt_idx" 
  ON "Grant" ("decisionAt" DESC NULLS LAST)
  WHERE "decisionAt" IS NOT NULL;

-- Verify indexes created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Grant'
  AND indexname LIKE '%aiRecommendation%'
ORDER BY indexname;
