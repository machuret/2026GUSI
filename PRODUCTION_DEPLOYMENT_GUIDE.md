# Grant System - Production Deployment Guide

## 🎯 **Overview**

This guide covers deploying the production-grade fixes for:
1. **Pipeline Status Issue** - CRM showing 0 records
2. **AI Fit Score vs Decision Conflation** - Identical scores getting different decisions

**Target Grade:** A- (93/100)

---

## 📋 **Pre-Deployment Checklist**

### **1. Backup Database**
```bash
# Full backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Grant table only
pg_dump -t "Grant" $DATABASE_URL > grant_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh *.sql
```

### **2. Review Changes**
- [ ] Read `GRANT_SYSTEM_ISSUES_COMPREHENSIVE.md`
- [ ] Review SQL scripts in order
- [ ] Understand rollback procedure
- [ ] Notify team of deployment window

### **3. Environment Check**
```bash
# Verify database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Grant\";"

# Check current state
psql $DATABASE_URL -f diagnose_grant_pipeline.sql
```

---

## 🚀 **Deployment Steps**

### **Phase 1: Database Migrations (15-20 minutes)**

#### **Step 1: AI Recommendation Separation**
```bash
# Run migration to add aiRecommendation, decisionReason, decisionAt
psql $DATABASE_URL -f supabase/migrations/20260406_separate_ai_recommendation_from_decision.sql
```

**Expected Output:**
- ✓ Added 3 new columns
- ✓ Backfilled aiRecommendation from aiVerdict
- ✓ Created indexes
- ✓ Verification shows counts

**Verification:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT("aiRecommendation") as has_recommendation,
  COUNT("decision") as has_decision
FROM "Grant";
```

#### **Step 2: Pipeline Status Fix**
```bash
# Run production-grade pipeline fix
psql $DATABASE_URL -f fix_grant_pipeline_v2_PRODUCTION.sql
```

**Expected Output:**
- ✓ Pre-flight validation passed
- ✓ GrantStatusAudit table created
- ✓ Grants backfilled with crmStatus
- ✓ Triggers created
- ✓ Tests passed
- ✓ Verification shows distribution

**Verification:**
```sql
SELECT 
  "crmStatus",
  COUNT(*) as count
FROM "Grant"
GROUP BY "crmStatus"
ORDER BY count DESC;
```

#### **Step 3: Run Test Suite**
```bash
# Run automated tests
psql $DATABASE_URL -f test_grant_pipeline.sql
```

**Expected Output:**
- ✓ 10/10 tests passed (100%)
- All triggers working correctly
- Audit logging functional

**If Tests Fail:**
```bash
# Rollback immediately
psql $DATABASE_URL -f rollback_grant_pipeline.sql

# Review test output
# Fix issues
# Re-run from Step 2
```

---

### **Phase 2: Application Code Deployment (10-15 minutes)**

#### **Step 1: Deploy API Changes**
```bash
# Commit changes
git add src/app/api/grants/analyse/route.ts
git add src/hooks/GrantsContext.tsx
git commit -m "fix: Separate AI recommendation from user decision"

# Push to production
git push origin main
```

**Files Changed:**
- `src/app/api/grants/analyse/route.ts` - No longer auto-sets decision
- `src/hooks/GrantsContext.tsx` - Added new fields to Grant interface

#### **Step 2: Deploy UI Components**
```bash
# Commit new component
git add src/components/grants/GrantDecisionBadge.tsx
git commit -m "feat: Add GrantDecisionBadge component for AI vs user decision"

git push origin main
```

#### **Step 3: Verify Deployment**
```bash
# Check Vercel deployment status
vercel --prod

# Monitor logs
vercel logs --prod
```

---

### **Phase 3: Verification & Monitoring (5-10 minutes)**

#### **Step 1: Functional Testing**

**Test 1: CRM Visibility**
1. Navigate to `/grants/crm`
2. **Expected:** All grants visible in pipeline
3. **Expected:** Grants distributed across Researching/Pipeline/Lost

**Test 2: New Grant Creation**
1. Create new grant via UI or API
2. **Expected:** Grant auto-enters "Researching" status
3. **Expected:** Visible in CRM immediately

**Test 3: Decision Change**
1. Change grant decision from "Maybe" to "Apply"
2. **Expected:** crmStatus updates to "Pipeline"
3. **Expected:** Audit log entry created

**Test 4: AI Analysis**
1. Run AI analysis on a grant
2. **Expected:** aiRecommendation field populated
3. **Expected:** decision field NOT auto-set
4. **Expected:** UI shows AI recommendation separately

**Test 5: Decision Override**
1. Grant with aiRecommendation="Apply"
2. User sets decision="Maybe"
3. Add decisionReason="Timeline too tight"
4. **Expected:** Override warning shown in UI
5. **Expected:** Re-analysis preserves user decision

#### **Step 2: Database Monitoring**
```sql
-- Check pipeline health
SELECT 
  "crmStatus",
  COUNT(*) as count,
  AVG("aiScore") as avg_score
FROM "Grant"
GROUP BY "crmStatus";

-- Check override rate
SELECT 
  COUNT(*) FILTER (WHERE "decision" IS DISTINCT FROM "aiRecommendation") * 100.0 / COUNT(*) as override_rate
FROM "Grant"
WHERE "aiRecommendation" IS NOT NULL;

-- Recent audit entries
SELECT * FROM "GrantStatusAudit" 
ORDER BY "changedAt" DESC 
LIMIT 10;
```

#### **Step 3: Performance Check**
```sql
-- Check trigger overhead (should be < 5ms)
EXPLAIN ANALYZE
INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'test', 'perf-test', NOW(), NOW());

-- Rollback test insert
ROLLBACK;
```

---

## 🔄 **Rollback Procedure**

### **If Issues Detected:**

#### **Option 1: Rollback Database Only**
```bash
# Remove triggers and functions (keeps data)
psql $DATABASE_URL -f rollback_grant_pipeline.sql
```

#### **Option 2: Full Rollback (Database + Code)**
```bash
# 1. Rollback database
psql $DATABASE_URL -f rollback_grant_pipeline.sql

# 2. Revert code changes
git revert HEAD~2..HEAD  # Revert last 2 commits
git push origin main

# 3. Restore from backup if needed
psql $DATABASE_URL < grant_backup_YYYYMMDD_HHMMSS.sql
```

#### **Option 3: Emergency Restore**
```bash
# Drop and restore entire Grant table
psql $DATABASE_URL -c "DROP TABLE \"Grant\" CASCADE;"
psql $DATABASE_URL < grant_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📊 **Success Criteria**

### **Database:**
- ✅ All grants have crmStatus set (0 NULL values)
- ✅ GrantStatusAudit table exists and logging
- ✅ Triggers active and tested
- ✅ All automated tests passing (10/10)

### **Application:**
- ✅ CRM page shows all grants
- ✅ New grants auto-enter pipeline
- ✅ Decision changes update status
- ✅ AI analysis populates aiRecommendation
- ✅ User decision separate from AI recommendation

### **User Experience:**
- ✅ No more empty CRM
- ✅ Clear separation of AI vs user decision
- ✅ Override warnings visible
- ✅ Decision reasons tracked
- ✅ Audit trail available

---

## 🐛 **Troubleshooting**

### **Issue: Triggers Not Firing**
```sql
-- Check if triggers exist
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'Grant';

-- Re-create triggers
\i fix_grant_pipeline_v2_PRODUCTION.sql
```

### **Issue: Grants Still Have NULL crmStatus**
```sql
-- Find affected grants
SELECT id, name, "decision", "crmStatus" 
FROM "Grant" 
WHERE "crmStatus" IS NULL;

-- Manual fix
UPDATE "Grant"
SET "crmStatus" = 'Researching'
WHERE "crmStatus" IS NULL;
```

### **Issue: Audit Log Not Recording**
```sql
-- Check table exists
SELECT COUNT(*) FROM "GrantStatusAudit";

-- Check recent entries
SELECT * FROM "GrantStatusAudit" 
ORDER BY "changedAt" DESC 
LIMIT 5;

-- Test manually
INSERT INTO "GrantStatusAudit" ("grantId", "toStatus", "changedBy", "changeReason")
VALUES ('test-id', 'Pipeline', 'system', 'test');
```

### **Issue: UI Not Showing New Fields**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
npm run start

# Check TypeScript compilation
npm run typecheck
```

---

## 📈 **Post-Deployment Monitoring**

### **Week 1: Daily Checks**
```sql
-- Daily health check
SELECT 
  DATE("changedAt") as date,
  COUNT(*) as status_changes,
  COUNT(DISTINCT "grantId") as unique_grants
FROM "GrantStatusAudit"
WHERE "changedAt" > NOW() - INTERVAL '1 day'
GROUP BY DATE("changedAt");

-- Override patterns
SELECT 
  "aiRecommendation",
  "decision",
  COUNT(*) as count
FROM "Grant"
WHERE "decision" IS DISTINCT FROM "aiRecommendation"
GROUP BY "aiRecommendation", "decision"
ORDER BY count DESC;
```

### **Week 2-4: Weekly Review**
- Review override reasons for patterns
- Check for any NULL crmStatus (should be 0)
- Analyze audit log for unexpected transitions
- Gather user feedback on new UI

---

## 🎓 **Training & Documentation**

### **For Users:**
1. **CRM Pipeline** - Grants now automatically enter pipeline
2. **AI Recommendations** - AI suggests Apply/Maybe/No
3. **User Decisions** - You make final decision
4. **Override Warnings** - UI shows when you override AI
5. **Decision Reasons** - Explain why you override

### **For Developers:**
1. **Never auto-set decision** - Only AI sets aiRecommendation
2. **Triggers handle crmStatus** - Don't manually set in code
3. **Audit log is automatic** - Triggers handle logging
4. **Test with test_grant_pipeline.sql** - Before any schema changes

---

## ✅ **Deployment Checklist**

- [ ] Backup created and verified
- [ ] Team notified of deployment
- [ ] Ran diagnose_grant_pipeline.sql
- [ ] Deployed AI recommendation migration
- [ ] Deployed pipeline status fix
- [ ] All automated tests passed (10/10)
- [ ] Code deployed to production
- [ ] Functional tests passed
- [ ] Database monitoring queries run
- [ ] Performance acceptable
- [ ] User acceptance testing complete
- [ ] Documentation updated
- [ ] Team trained on new features

---

## 📞 **Support**

**If Issues Arise:**
1. Check troubleshooting section above
2. Review audit logs: `SELECT * FROM "GrantStatusAudit" ORDER BY "changedAt" DESC LIMIT 50;`
3. Run diagnostic: `psql $DATABASE_URL -f diagnose_grant_pipeline.sql`
4. Rollback if critical: `psql $DATABASE_URL -f rollback_grant_pipeline.sql`

**Rollback Decision Matrix:**
- **Minor UI issue** → Fix forward, no rollback
- **Incorrect status transitions** → Rollback triggers, fix, redeploy
- **Data corruption** → Emergency restore from backup
- **Performance degradation** → Rollback triggers, investigate

---

**Deployment Owner:** [Your Name]  
**Deployment Date:** [Date]  
**Rollback Tested:** [Yes/No]  
**Success:** [Yes/No]
