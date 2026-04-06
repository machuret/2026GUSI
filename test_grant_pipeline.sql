-- ═══════════════════════════════════════════════════════════════════════════
-- GRANT PIPELINE FIX - AUTOMATED TEST SUITE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Purpose: Comprehensive automated tests for grant pipeline fix
-- Coverage: Triggers, backfill logic, edge cases, error handling
--
-- Usage: Run this after fix_grant_pipeline_v2_PRODUCTION.sql
-- Expected: All tests should PASS
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Test results tracking
CREATE TEMP TABLE test_results (
  test_number INTEGER,
  test_name TEXT,
  status TEXT,  -- PASS or FAIL
  message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'GRANT PIPELINE - AUTOMATED TEST SUITE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 1: Trigger exists and is active
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  insert_trigger_exists BOOLEAN;
  update_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'grant_set_crm_status' AND event_object_table = 'Grant'
  ) INTO insert_trigger_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'grant_update_crm_on_decision' AND event_object_table = 'Grant'
  ) INTO update_trigger_exists;
  
  IF insert_trigger_exists AND update_trigger_exists THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (1, 'Triggers exist', 'PASS', 'Both triggers are active');
    RAISE NOTICE '✓ TEST 1 PASS: Triggers exist';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (1, 'Triggers exist', 'FAIL', format('INSERT trigger: %s, UPDATE trigger: %s', insert_trigger_exists, update_trigger_exists));
    RAISE WARNING '✗ TEST 1 FAIL: Missing triggers';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 2: INSERT with no decision → crmStatus = Researching
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  result_status TEXT;
BEGIN
  test_id := gen_random_uuid()::text;
  
  INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_2__', NOW(), NOW());
  
  SELECT "crmStatus" INTO result_status FROM "Grant" WHERE id = test_id;
  
  IF result_status = 'Researching' THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (2, 'INSERT no decision → Researching', 'PASS', format('Got: %s', result_status));
    RAISE NOTICE '✓ TEST 2 PASS: INSERT no decision → Researching';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (2, 'INSERT no decision → Researching', 'FAIL', format('Expected Researching, got: %s', result_status));
    RAISE WARNING '✗ TEST 2 FAIL: Expected Researching, got: %', result_status;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 3: INSERT with decision=Apply → crmStatus = Pipeline
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  result_status TEXT;
BEGIN
  test_id := gen_random_uuid()::text;
  
  INSERT INTO "Grant" (id, "companyId", name, "decision", "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_3__', 'Apply', NOW(), NOW());
  
  SELECT "crmStatus" INTO result_status FROM "Grant" WHERE id = test_id;
  
  IF result_status = 'Pipeline' THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (3, 'INSERT decision=Apply → Pipeline', 'PASS', format('Got: %s', result_status));
    RAISE NOTICE '✓ TEST 3 PASS: INSERT decision=Apply → Pipeline';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (3, 'INSERT decision=Apply → Pipeline', 'FAIL', format('Expected Pipeline, got: %s', result_status));
    RAISE WARNING '✗ TEST 3 FAIL: Expected Pipeline, got: %', result_status;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 4: INSERT with decision=Maybe → crmStatus = Researching
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  result_status TEXT;
BEGIN
  test_id := gen_random_uuid()::text;
  
  INSERT INTO "Grant" (id, "companyId", name, "decision", "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_4__', 'Maybe', NOW(), NOW());
  
  SELECT "crmStatus" INTO result_status FROM "Grant" WHERE id = test_id;
  
  IF result_status = 'Researching' THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (4, 'INSERT decision=Maybe → Researching', 'PASS', format('Got: %s', result_status));
    RAISE NOTICE '✓ TEST 4 PASS: INSERT decision=Maybe → Researching';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (4, 'INSERT decision=Maybe → Researching', 'FAIL', format('Expected Researching, got: %s', result_status));
    RAISE WARNING '✗ TEST 4 FAIL: Expected Researching, got: %', result_status;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 5: INSERT with decision=No → crmStatus = Lost
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  result_status TEXT;
BEGIN
  test_id := gen_random_uuid()::text;
  
  INSERT INTO "Grant" (id, "companyId", name, "decision", "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_5__', 'No', NOW(), NOW());
  
  SELECT "crmStatus" INTO result_status FROM "Grant" WHERE id = test_id;
  
  IF result_status = 'Lost' THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (5, 'INSERT decision=No → Lost', 'PASS', format('Got: %s', result_status));
    RAISE NOTICE '✓ TEST 5 PASS: INSERT decision=No → Lost';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (5, 'INSERT decision=No → Lost', 'FAIL', format('Expected Lost, got: %s', result_status));
    RAISE WARNING '✗ TEST 5 FAIL: Expected Lost, got: %', result_status;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 6: UPDATE decision from NULL to Apply → crmStatus changes to Pipeline
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  result_status TEXT;
  audit_count INTEGER;
BEGIN
  test_id := gen_random_uuid()::text;
  
  -- Insert with no decision (should be Researching)
  INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_6__', NOW(), NOW());
  
  -- Update decision to Apply
  UPDATE "Grant" SET "decision" = 'Apply' WHERE id = test_id;
  
  SELECT "crmStatus" INTO result_status FROM "Grant" WHERE id = test_id;
  
  -- Check audit log
  SELECT COUNT(*) INTO audit_count 
  FROM "GrantStatusAudit" 
  WHERE "grantId" = test_id AND "changeReason" = 'decision_change';
  
  IF result_status = 'Pipeline' AND audit_count > 0 THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (6, 'UPDATE decision → status changes + audit', 'PASS', format('Status: %s, Audit entries: %s', result_status, audit_count));
    RAISE NOTICE '✓ TEST 6 PASS: UPDATE decision → status changes + audit';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (6, 'UPDATE decision → status changes + audit', 'FAIL', format('Status: %s (expected Pipeline), Audit: %s', result_status, audit_count));
    RAISE WARNING '✗ TEST 6 FAIL: Status: %, Audit: %', result_status, audit_count;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 7: UPDATE decision when crmStatus=Submitted → status unchanged
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  result_status TEXT;
BEGIN
  test_id := gen_random_uuid()::text;
  
  -- Insert with manual crmStatus=Submitted
  INSERT INTO "Grant" (id, "companyId", name, "crmStatus", "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_7__', 'Submitted', NOW(), NOW());
  
  -- Try to change decision (should NOT change status)
  UPDATE "Grant" SET "decision" = 'Apply' WHERE id = test_id;
  
  SELECT "crmStatus" INTO result_status FROM "Grant" WHERE id = test_id;
  
  IF result_status = 'Submitted' THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (7, 'UPDATE decision in late stage → no change', 'PASS', 'Status preserved: Submitted');
    RAISE NOTICE '✓ TEST 7 PASS: Late-stage status preserved';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (7, 'UPDATE decision in late stage → no change', 'FAIL', format('Expected Submitted, got: %s', result_status));
    RAISE WARNING '✗ TEST 7 FAIL: Expected Submitted, got: %', result_status;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 8: Audit log captures all required fields
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  audit_record RECORD;
BEGIN
  test_id := gen_random_uuid()::text;
  
  INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_8__', NOW(), NOW());
  
  UPDATE "Grant" SET "decision" = 'Apply' WHERE id = test_id;
  
  SELECT * INTO audit_record 
  FROM "GrantStatusAudit" 
  WHERE "grantId" = test_id 
  ORDER BY "changedAt" DESC 
  LIMIT 1;
  
  IF audit_record."grantId" IS NOT NULL 
     AND audit_record."toStatus" IS NOT NULL 
     AND audit_record."changedBy" IS NOT NULL 
     AND audit_record."changeReason" IS NOT NULL THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (8, 'Audit log completeness', 'PASS', 'All required fields present');
    RAISE NOTICE '✓ TEST 8 PASS: Audit log complete';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (8, 'Audit log completeness', 'FAIL', 'Missing required fields');
    RAISE WARNING '✗ TEST 8 FAIL: Audit log incomplete';
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 9: No NULL crmStatus in existing grants (backfill worked)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  null_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "Grant" WHERE "crmStatus" IS NULL;
  SELECT COUNT(*) INTO total_count FROM "Grant";
  
  IF null_count = 0 OR total_count = 0 THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (9, 'Backfill completeness', 'PASS', format('0 NULL out of %s grants', total_count));
    RAISE NOTICE '✓ TEST 9 PASS: No NULL crmStatus';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (9, 'Backfill completeness', 'FAIL', format('%s NULL out of %s grants', null_count, total_count));
    RAISE WARNING '✗ TEST 9 FAIL: % grants have NULL crmStatus', null_count;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 10: Idempotency - running fix twice doesn't break anything
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_id TEXT;
  status_before TEXT;
  status_after TEXT;
BEGIN
  test_id := gen_random_uuid()::text;
  
  -- Insert grant
  INSERT INTO "Grant" (id, "companyId", name, "decision", "createdAt", "updatedAt")
  VALUES (test_id, 'test-company', '__TEST_10__', 'Apply', NOW(), NOW());
  
  SELECT "crmStatus" INTO status_before FROM "Grant" WHERE id = test_id;
  
  -- Simulate re-running backfill (should be no-op)
  UPDATE "Grant"
  SET "crmStatus" = CASE
    WHEN "decision" = 'Apply' THEN 'Pipeline'
    WHEN "decision" = 'Maybe' THEN 'Researching'
    WHEN "decision" IN ('Rejected', 'No') THEN 'Lost'
    WHEN "decision" IS NULL THEN 'Researching'
    ELSE "crmStatus"
  END
  WHERE id = test_id;
  
  SELECT "crmStatus" INTO status_after FROM "Grant" WHERE id = test_id;
  
  IF status_before = status_after AND status_after = 'Pipeline' THEN
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (10, 'Idempotency', 'PASS', 'Status unchanged after re-run');
    RAISE NOTICE '✓ TEST 10 PASS: Idempotent';
  ELSE
    INSERT INTO test_results (test_number, test_name, status, message)
    VALUES (10, 'Idempotency', 'FAIL', format('Before: %s, After: %s', status_before, status_after));
    RAISE WARNING '✗ TEST 10 FAIL: Before: %, After: %', status_before, status_after;
  END IF;
  
  DELETE FROM "Grant" WHERE id = test_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST SUMMARY
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  total_tests INTEGER;
  passed_tests INTEGER;
  failed_tests INTEGER;
  pass_rate NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_tests FROM test_results;
  SELECT COUNT(*) INTO passed_tests FROM test_results WHERE status = 'PASS';
  SELECT COUNT(*) INTO failed_tests FROM test_results WHERE status = 'FAIL';
  
  pass_rate := CASE WHEN total_tests > 0 THEN (passed_tests::NUMERIC / total_tests * 100) ELSE 0 END;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TEST SUMMARY';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total Tests: %', total_tests;
  RAISE NOTICE 'Passed: % (%.1f%%)', passed_tests, pass_rate;
  RAISE NOTICE 'Failed: %', failed_tests;
  RAISE NOTICE '';
  
  IF failed_tests > 0 THEN
    RAISE NOTICE 'Failed Tests:';
    FOR rec IN SELECT test_number, test_name, message FROM test_results WHERE status = 'FAIL' ORDER BY test_number LOOP
      RAISE NOTICE '  Test %: % - %', rec.test_number, rec.test_name, rec.message;
    END LOOP;
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
  IF failed_tests = 0 THEN
    RAISE NOTICE '✓ ALL TESTS PASSED - Pipeline fix is working correctly';
  ELSE
    RAISE WARNING '✗ SOME TESTS FAILED - Review failures above';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- Display detailed results
SELECT 
  test_number,
  test_name,
  status,
  message,
  executed_at
FROM test_results
ORDER BY test_number;
