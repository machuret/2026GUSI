-- Fix Grant Pipeline Issue
-- Problem: Grants exist but have no crmStatus, so they don't appear in CRM
-- Solution: Add automatic pipeline status based on grant decision

-- Step 1: Update existing grants to have appropriate crmStatus based on their decision
UPDATE "Grant"
SET "crmStatus" = CASE
  -- If decision is "Apply", move to Pipeline
  WHEN "decision" = 'Apply' THEN 'Pipeline'
  
  -- If decision is "Maybe", move to Researching
  WHEN "decision" = 'Maybe' THEN 'Researching'
  
  -- If decision is "Rejected" or "No", move to Lost
  WHEN "decision" IN ('Rejected', 'No') THEN 'Lost'
  
  -- If no decision yet but grant exists, move to Researching
  WHEN "decision" IS NULL THEN 'Researching'
  
  ELSE "crmStatus" -- Keep existing status if already set
END
WHERE "crmStatus" IS NULL;

-- Step 2: Create a function to automatically set crmStatus on new grants
CREATE OR REPLACE FUNCTION set_default_crm_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set crmStatus if it's not already set
  IF NEW."crmStatus" IS NULL THEN
    NEW."crmStatus" := CASE
      WHEN NEW."decision" = 'Apply' THEN 'Pipeline'
      WHEN NEW."decision" = 'Maybe' THEN 'Researching'
      WHEN NEW."decision" IN ('Rejected', 'No') THEN 'Lost'
      ELSE 'Researching' -- Default for new grants
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to auto-set crmStatus on INSERT
DROP TRIGGER IF EXISTS grant_set_crm_status ON "Grant";
CREATE TRIGGER grant_set_crm_status
  BEFORE INSERT ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION set_default_crm_status();

-- Step 4: Create trigger to update crmStatus when decision changes
CREATE OR REPLACE FUNCTION update_crm_status_on_decision_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if decision changed and crmStatus is still in early stages
  IF NEW."decision" IS DISTINCT FROM OLD."decision" 
     AND NEW."crmStatus" IN ('Researching', 'Pipeline', NULL) THEN
    NEW."crmStatus" := CASE
      WHEN NEW."decision" = 'Apply' THEN 'Pipeline'
      WHEN NEW."decision" = 'Maybe' THEN 'Researching'
      WHEN NEW."decision" IN ('Rejected', 'No') THEN 'Lost'
      ELSE NEW."crmStatus" -- Keep current status
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grant_update_crm_on_decision ON "Grant";
CREATE TRIGGER grant_update_crm_on_decision
  BEFORE UPDATE ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_status_on_decision_change();

-- Step 5: Verify the fix
SELECT 
  'After Fix' as status,
  COUNT(*) as total_grants,
  COUNT(*) FILTER (WHERE "crmStatus" IS NOT NULL) as grants_in_crm,
  COUNT(*) FILTER (WHERE "crmStatus" IS NULL) as grants_not_in_crm
FROM "Grant";

-- Step 6: Show distribution by crmStatus
SELECT 
  "crmStatus",
  COUNT(*) as count
FROM "Grant"
GROUP BY "crmStatus"
ORDER BY 
  CASE "crmStatus"
    WHEN 'Researching' THEN 1
    WHEN 'Pipeline' THEN 2
    WHEN 'Active' THEN 3
    WHEN 'Built' THEN 4
    WHEN 'Improved' THEN 5
    WHEN 'Submitted' THEN 6
    WHEN 'Won' THEN 7
    WHEN 'Lost' THEN 8
    ELSE 9
  END;
