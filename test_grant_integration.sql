-- ═══════════════════════════════════════════════════════════════════════════
-- GRANT PIPELINE - INTEGRATION TEST
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Purpose: Test full grant lifecycle from creation to CRM
-- Coverage: Database triggers + API logic + CRM filtering
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Test results tracking
CREATE TEMP TABLE integration_test_results (
  test_number INTEGER,
  test_name TEXT,
  status TEXT,
  message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'GRANT PIPELINE - INTEGRATION TEST SUITE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- INTEGRATION TEST 1: Full Grant Lifecycle
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_grant_id TEXT;
  crm_status TEXT;
  ai_recommendation TEXT;
  user_decision TEXT;
  audit_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Integration Test 1: Full Grant Lifecycle ──';
  
  -- Step 1: Create grant (should auto-enter Researching)
  INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'test-company', '__INTEGRATION_TEST_1__', NOW(), NOW())
  RETURNING id INTO test_grant_id;
  
  SELECT "crmStatus" INTO crm_status FROM "Grant" WHERE id = test_grant_id;
  
  IF crm_status = 'Researching' THEN
    RAISE NOTICE '  ✓ Step 1: Grant created with crmStatus = Researching';
  ELSE
    RAISE WARNING '  ✗ Step 1 FAILED: Expected Researching, got %', crm_status;
  END IF;
  
  -- Step 2: Simulate AI analysis (set aiRecommendation)
  UPDATE "Grant" 
  SET "aiRecommendation" = 'Apply',
      "aiScore" = 85,
      "aiVerdict" = 'Strong Fit'
  WHERE id = test_grant_id;
  
  SELECT "aiRecommendation" INTO ai_recommendation FROM "Grant" WHERE id = test_grant_id;
  
  IF ai_recommendation = 'Apply' THEN
    RAISE NOTICE '  ✓ Step 2: AI recommendation set to Apply';
  ELSE
    RAISE WARNING '  ✗ Step 2 FAILED: AI recommendation not set';
  END IF;
  
  -- Step 3: User sets decision (should update crmStatus to Pipeline)
  UPDATE "Grant" 
  SET "decision" = 'Apply',
      "decisionAt" = NOW()
  WHERE id = test_grant_id;
  
  SELECT "crmStatus", "decision" 
  INTO crm_status, user_decision 
  FROM "Grant" WHERE id = test_grant_id;
  
  IF crm_status = 'Pipeline' AND user_decision = 'Apply' THEN
    RAISE NOTICE '  ✓ Step 3: Decision set to Apply, crmStatus updated to Pipeline';
  ELSE
    RAISE WARNING '  ✗ Step 3 FAILED: crmStatus = %, decision = %', crm_status, user_decision;
  END IF;
  
  -- Step 4: Check audit log
  SELECT COUNT(*) INTO audit_count 
  FROM "GrantStatusAudit" 
  WHERE "grantId" = test_grant_id;
  
  IF audit_count >= 1 THEN
    RAISE NOTICE '  ✓ Step 4: Audit log has % entries', audit_count;
  ELSE
    RAISE WARNING '  ✗ Step 4 FAILED: No audit entries found';
  END IF;
  
  -- Step 5: Verify grant visible in CRM (crmStatus NOT NULL)
  IF crm_status IS NOT NULL THEN
    RAISE NOTICE '  ✓ Step 5: Grant is visible in CRM';
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (1, 'Full Grant Lifecycle', 'PASS', 'All steps completed successfully');
  ELSE
    RAISE WARNING '  ✗ Step 5 FAILED: Grant not visible in CRM';
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (1, 'Full Grant Lifecycle', 'FAIL', 'Grant not visible in CRM');
  END IF;
  
  -- Cleanup
  DELETE FROM "Grant" WHERE id = test_grant_id;
  
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- INTEGRATION TEST 2: AI Recommendation vs User Decision Override
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_grant_id TEXT;
  ai_rec TEXT;
  user_dec TEXT;
  dec_reason TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Integration Test 2: Override Scenario ──';
  
  -- Create grant
  INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'test-company', '__INTEGRATION_TEST_2__', NOW(), NOW())
  RETURNING id INTO test_grant_id;
  
  -- AI recommends Apply
  UPDATE "Grant" 
  SET "aiRecommendation" = 'Apply',
      "aiScore" = 95,
      "aiVerdict" = 'Strong Fit'
  WHERE id = test_grant_id;
  
  -- User overrides to Maybe
  UPDATE "Grant" 
  SET "decision" = 'Maybe',
      "decisionReason" = 'Timeline too tight',
      "decisionAt" = NOW()
  WHERE id = test_grant_id;
  
  SELECT "aiRecommendation", "decision", "decisionReason"
  INTO ai_rec, user_dec, dec_reason
  FROM "Grant" WHERE id = test_grant_id;
  
  IF ai_rec = 'Apply' AND user_dec = 'Maybe' AND dec_reason = 'Timeline too tight' THEN
    RAISE NOTICE '  ✓ Override recorded: AI=%s, User=%s, Reason=%s', ai_rec, user_dec, dec_reason;
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (2, 'AI Override Scenario', 'PASS', 'Override correctly recorded');
  ELSE
    RAISE WARNING '  ✗ Override FAILED: AI=%s, User=%s, Reason=%s', ai_rec, user_dec, dec_reason;
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (2, 'AI Override Scenario', 'FAIL', format('AI=%s, User=%s', ai_rec, user_dec));
  END IF;
  
  -- Cleanup
  DELETE FROM "Grant" WHERE id = test_grant_id;
  
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- INTEGRATION TEST 3: Re-analysis Preserves User Decision
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  test_grant_id TEXT;
  decision_before TEXT;
  decision_after TEXT;
  ai_rec_after TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Integration Test 3: Re-analysis Preserves Decision ──';
  
  -- Create grant with user decision
  INSERT INTO "Grant" (id, "companyId", name, "decision", "decisionAt", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'test-company', '__INTEGRATION_TEST_3__', 'Maybe', NOW(), NOW(), NOW())
  RETURNING id INTO test_grant_id;
  
  SELECT "decision" INTO decision_before FROM "Grant" WHERE id = test_grant_id;
  
  -- Simulate re-analysis (update aiRecommendation but NOT decision)
  UPDATE "Grant" 
  SET "aiRecommendation" = 'Apply',
      "aiScore" = 90,
      "aiVerdict" = 'Strong Fit'
  WHERE id = test_grant_id;
  
  SELECT "decision", "aiRecommendation" 
  INTO decision_after, ai_rec_after
  FROM "Grant" WHERE id = test_grant_id;
  
  IF decision_before = decision_after AND decision_after = 'Maybe' AND ai_rec_after = 'Apply' THEN
    RAISE NOTICE '  ✓ Re-analysis preserved user decision (Maybe) despite AI recommending Apply';
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (3, 'Re-analysis Preserves Decision', 'PASS', 'User decision preserved');
  ELSE
    RAISE WARNING '  ✗ FAILED: Before=%s, After=%s, AI=%s', decision_before, decision_after, ai_rec_after;
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (3, 'Re-analysis Preserves Decision', 'FAIL', 'Decision was changed');
  END IF;
  
  -- Cleanup
  DELETE FROM "Grant" WHERE id = test_grant_id;
  
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- INTEGRATION TEST 4: CRM Filtering Works Correctly
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  grant_with_status TEXT;
  grant_without_status TEXT;
  crm_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── Integration Test 4: CRM Filtering ──';
  
  -- Create grant WITH crmStatus
  INSERT INTO "Grant" (id, "companyId", name, "crmStatus", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'test-company', '__CRM_TEST_WITH__', 'Pipeline', NOW(), NOW())
  RETURNING id INTO grant_with_status;
  
  -- Create grant WITHOUT crmStatus
  INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'test-company', '__CRM_TEST_WITHOUT__', NOW(), NOW())
  RETURNING id INTO grant_without_status;
  
  -- Manually set crmStatus to NULL (bypass trigger)
  UPDATE "Grant" SET "crmStatus" = NULL WHERE id = grant_without_status;
  
  -- Count grants visible in CRM (crmStatus NOT NULL)
  SELECT COUNT(*) INTO crm_count
  FROM "Grant"
  WHERE id IN (grant_with_status, grant_without_status)
    AND "crmStatus" IS NOT NULL;
  
  IF crm_count = 1 THEN
    RAISE NOTICE '  ✓ CRM filter works: 1 grant visible (with status), 1 hidden (without status)';
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (4, 'CRM Filtering', 'PASS', '1 visible, 1 hidden as expected');
  ELSE
    RAISE WARNING '  ✗ CRM filter FAILED: Expected 1 visible, got %', crm_count;
    INSERT INTO integration_test_results (test_number, test_name, status, message)
    VALUES (4, 'CRM Filtering', 'FAIL', format('Expected 1, got %s', crm_count));
  END IF;
  
  -- Cleanup
  DELETE FROM "Grant" WHERE id IN (grant_with_status, grant_without_status);
  
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
  SELECT COUNT(*) INTO total_tests FROM integration_test_results;
  SELECT COUNT(*) INTO passed_tests FROM integration_test_results WHERE status = 'PASS';
  SELECT COUNT(*) INTO failed_tests FROM integration_test_results WHERE status = 'FAIL';
  
  pass_rate := CASE WHEN total_tests > 0 THEN (passed_tests::NUMERIC / total_tests * 100) ELSE 0 END;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'INTEGRATION TEST SUMMARY';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total Tests: %', total_tests;
  RAISE NOTICE 'Passed: % (%.1f%%)', passed_tests, pass_rate;
  RAISE NOTICE 'Failed: %', failed_tests;
  RAISE NOTICE '';
  
  IF failed_tests > 0 THEN
    RAISE NOTICE 'Failed Tests:';
    FOR rec IN SELECT test_number, test_name, message FROM integration_test_results WHERE status = 'FAIL' ORDER BY test_number LOOP
      RAISE NOTICE '  Test %: % - %', rec.test_number, rec.test_name, rec.message;
    END LOOP;
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  
  IF failed_tests = 0 THEN
    RAISE NOTICE '✓ ALL INTEGRATION TESTS PASSED';
  ELSE
    RAISE WARNING '✗ SOME INTEGRATION TESTS FAILED';
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
FROM integration_test_results
ORDER BY test_number;
