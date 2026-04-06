-- Check if aiResearched field exists and has data
SELECT 
  id,
  name,
  "aiResearched",
  "crmStatus",
  founder,
  eligibility IS NOT NULL as has_eligibility,
  "howToApply" IS NOT NULL as has_how_to_apply
FROM "Grant"
WHERE "crmStatus" IS NOT NULL
ORDER BY "updatedAt" DESC
LIMIT 10;
