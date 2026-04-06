-- Diagnose Grant Pipeline Issue
-- Problem: CRM shows 0 records despite 5 grants in All Grants and 30 drafts in Builder

-- 1. Check total grants in system
SELECT 
  COUNT(*) as total_grants,
  COUNT(*) FILTER (WHERE "crmStatus" IS NOT NULL) as grants_in_crm,
  COUNT(*) FILTER (WHERE "crmStatus" IS NULL) as grants_not_in_crm
FROM "Grant";

-- 2. Check grant distribution by crmStatus
SELECT 
  "crmStatus",
  COUNT(*) as count
FROM "Grant"
GROUP BY "crmStatus"
ORDER BY count DESC;

-- 3. Check grant drafts
SELECT 
  COUNT(*) as total_drafts
FROM "GrantDraft";

-- 4. Check if grants have decision but no crmStatus
SELECT 
  "decision",
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE "crmStatus" IS NULL) as no_crm_status
FROM "Grant"
WHERE "decision" IS NOT NULL
GROUP BY "decision";

-- 5. Sample grants without crmStatus
SELECT 
  id,
  name,
  "decision",
  "crmStatus",
  "createdAt"
FROM "Grant"
WHERE "crmStatus" IS NULL
LIMIT 10;
