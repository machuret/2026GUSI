-- Separate AI Recommendation from User Decision
-- Problem: aiScore and decision are conflated - identical scores get different decisions
-- Solution: Add aiRecommendation field to track AI's suggestion separately from user's choice

-- Step 1: Add new fields to Grant table
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "aiRecommendation" TEXT 
    CHECK ("aiRecommendation" IN ('Apply', 'Maybe', 'No')),
  ADD COLUMN IF NOT EXISTS "decisionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionAt" TIMESTAMPTZ;

-- Step 2: Backfill aiRecommendation from existing aiVerdict for grants that have been analyzed
UPDATE "Grant"
SET "aiRecommendation" = CASE
  WHEN "aiVerdict" IN ('Strong Fit', 'Good Fit') THEN 'Apply'
  WHEN "aiVerdict" = 'Not Eligible' THEN 'No'
  WHEN "aiVerdict" IN ('Possible Fit', 'Weak Fit') THEN 'Maybe'
  ELSE NULL
END
WHERE "aiScore" IS NOT NULL 
  AND "aiVerdict" IS NOT NULL 
  AND "aiRecommendation" IS NULL;

-- Step 3: For grants where decision was auto-set and matches AI recommendation, set decisionAt
UPDATE "Grant"
SET "decisionAt" = "updatedAt"
WHERE "decision" IS NOT NULL
  AND "aiRecommendation" IS NOT NULL
  AND "decision" = "aiRecommendation"
  AND "decisionAt" IS NULL;

-- Step 4: Create index for filtering by override status (decision != aiRecommendation)
CREATE INDEX IF NOT EXISTS "Grant_decision_override_idx" 
  ON "Grant" (("decision" IS DISTINCT FROM "aiRecommendation"))
  WHERE "aiRecommendation" IS NOT NULL;

-- Step 5: Create index for decisionAt for sorting by decision time
CREATE INDEX IF NOT EXISTS "Grant_decisionAt_idx" 
  ON "Grant" ("decisionAt" DESC NULLS LAST);

-- Step 6: Add comment explaining the separation
COMMENT ON COLUMN "Grant"."aiRecommendation" IS 'AI-generated recommendation (Apply/Maybe/No) based on fit score - always updated on re-analysis';
COMMENT ON COLUMN "Grant"."decision" IS 'User final decision (Apply/Maybe/No/Rejected) - only changed by user, preserved on re-analysis';
COMMENT ON COLUMN "Grant"."decisionReason" IS 'User explanation when overriding AI recommendation';
COMMENT ON COLUMN "Grant"."decisionAt" IS 'Timestamp when user made decision';

-- Verification queries
SELECT 
  'Grants with AI recommendation' as metric,
  COUNT(*) as count
FROM "Grant"
WHERE "aiRecommendation" IS NOT NULL

UNION ALL

SELECT 
  'Grants with user decision' as metric,
  COUNT(*) as count
FROM "Grant"
WHERE "decision" IS NOT NULL

UNION ALL

SELECT 
  'Grants where user overrode AI' as metric,
  COUNT(*) as count
FROM "Grant"
WHERE "decision" IS DISTINCT FROM "aiRecommendation"
  AND "aiRecommendation" IS NOT NULL
  AND "decision" IS NOT NULL;
