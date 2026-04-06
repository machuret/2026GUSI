-- ═══════════════════════════════════════════════════════════════════════════
-- GRANT PIPELINE FIX - ROLLBACK SCRIPT
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Purpose: Safely undo changes made by fix_grant_pipeline_v2_PRODUCTION.sql
-- Use Case: If the fix causes issues or needs to be reverted
--
-- IMPORTANT: This script will:
--   1. Remove triggers
--   2. Remove trigger functions
--   3. Optionally clear crmStatus (set back to NULL)
--   4. Optionally drop audit table
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'GRANT PIPELINE FIX - ROLLBACK';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'This will undo the grant pipeline fix.';
  RAISE NOTICE '';
  RAISE NOTICE 'WARNING: This will remove triggers and optionally clear data.';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- ── STEP 1: DROP TRIGGERS ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── STEP 1: Drop Triggers ──';
END $$;

DROP TRIGGER IF EXISTS grant_set_crm_status ON "Grant";
RAISE NOTICE '✓ Dropped grant_set_crm_status trigger';

DROP TRIGGER IF EXISTS grant_update_crm_on_decision ON "Grant";
RAISE NOTICE '✓ Dropped grant_update_crm_on_decision trigger';

-- ── STEP 2: DROP TRIGGER FUNCTIONS ──────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── STEP 2: Drop Trigger Functions ──';
END $$;

DROP FUNCTION IF EXISTS set_default_crm_status();
RAISE NOTICE '✓ Dropped set_default_crm_status() function';

DROP FUNCTION IF EXISTS update_crm_status_on_decision_change();
RAISE NOTICE '✓ Dropped update_crm_status_on_decision_change() function';

-- ── STEP 3: CLEAR BACKFILLED DATA (OPTIONAL) ────────────────────────────────
-- UNCOMMENT THE FOLLOWING BLOCK TO CLEAR crmStatus BACK TO NULL
-- WARNING: This will make grants invisible in CRM again

/*
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── STEP 3: Clear Backfilled crmStatus ──';
  
  UPDATE "Grant"
  SET "crmStatus" = NULL,
      "updatedAt" = NOW()
  WHERE "crmStatus" IS NOT NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RAISE NOTICE '✓ Cleared crmStatus for % grants', affected_rows;
END $$;
*/

-- ── STEP 4: DROP AUDIT TABLE (OPTIONAL) ─────────────────────────────────────
-- UNCOMMENT THE FOLLOWING BLOCK TO DROP THE AUDIT TABLE
-- WARNING: This will permanently delete all status change history

/*
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── STEP 4: Drop Audit Table ──';
  
  DROP TABLE IF EXISTS "GrantStatusAudit" CASCADE;
  
  RAISE NOTICE '✓ Dropped GrantStatusAudit table';
END $$;
*/

-- ── VERIFICATION ────────────────────────────────────────────────────────────
DO $$
DECLARE
  triggers_exist BOOLEAN;
  functions_exist BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Verification ──';
  
  -- Check if triggers still exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name IN ('grant_set_crm_status', 'grant_update_crm_on_decision')
  ) INTO triggers_exist;
  
  -- Check if functions still exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname IN ('set_default_crm_status', 'update_crm_status_on_decision_change')
  ) INTO functions_exist;
  
  IF triggers_exist THEN
    RAISE WARNING 'Some triggers still exist - rollback may be incomplete';
  ELSE
    RAISE NOTICE '✓ All triggers removed';
  END IF;
  
  IF functions_exist THEN
    RAISE WARNING 'Some functions still exist - rollback may be incomplete';
  ELSE
    RAISE NOTICE '✓ All functions removed';
  END IF;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ ROLLBACK COMPLETED';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers and functions have been removed.';
  RAISE NOTICE '';
  RAISE NOTICE 'To also clear data:';
  RAISE NOTICE '  1. Uncomment STEP 3 to clear crmStatus';
  RAISE NOTICE '  2. Uncomment STEP 4 to drop audit table';
  RAISE NOTICE '  3. Re-run this script';
  RAISE NOTICE '';
  RAISE NOTICE 'To re-apply the fix:';
  RAISE NOTICE '  Run fix_grant_pipeline_v2_PRODUCTION.sql again';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
