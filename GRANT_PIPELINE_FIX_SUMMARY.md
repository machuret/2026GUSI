# Grant Pipeline Fix - System Findings

## 🐛 **Problem Identified**

**Issue:** CRM shows 0 records despite 5 grants in "All Grants" and 30 drafts in "Builder"

**Root Cause:** Grants exist in the database but have `crmStatus = NULL`, so they are filtered out of the CRM view.

### **Code Evidence:**

```typescript
// src/app/grants/crm/page.tsx:90
const crmGrants = grants.filter((g) => g.crmStatus != null);
```

The CRM page only shows grants that have a `crmStatus` value. Grants without this field are invisible to the pipeline.

---

## 📊 **Current State**

### **Grant Table Schema:**
- `crmStatus` column exists (added in migration `20260221_grant_crm.sql`)
- Valid values: `'Researching' | 'Pipeline' | 'Active' | 'Built' | 'Improved' | 'Submitted' | 'Won' | 'Lost'`
- **Problem:** Column is nullable, and no default value is set
- **Problem:** No automatic logic to set `crmStatus` when grants are created

### **What's Happening:**
1. ✅ Grants are created successfully
2. ❌ `crmStatus` is left as `NULL` by default
3. ❌ CRM filter excludes all grants with `NULL` status
4. ❌ User sees empty CRM despite having grants

---

## ✅ **Solution Implemented**

### **1. Diagnostic Script** (`diagnose_grant_pipeline.sql`)
Run this to see the current state:
- Total grants vs grants in CRM
- Distribution by `crmStatus`
- Grants with decisions but no `crmStatus`
- Sample of affected grants

### **2. Fix Script** (`fix_grant_pipeline.sql`)

**What it does:**

#### **A. Backfill Existing Grants**
```sql
UPDATE "Grant"
SET "crmStatus" = CASE
  WHEN "decision" = 'Apply' THEN 'Pipeline'
  WHEN "decision" = 'Maybe' THEN 'Researching'
  WHEN "decision" IN ('Rejected', 'No') THEN 'Lost'
  WHEN "decision" IS NULL THEN 'Researching'
  ELSE "crmStatus"
END
WHERE "crmStatus" IS NULL;
```

**Logic:**
- Grants marked "Apply" → Move to **Pipeline** (ready to work on)
- Grants marked "Maybe" → Move to **Researching** (need more info)
- Grants marked "Rejected" or "No" → Move to **Lost** (not pursuing)
- Grants with no decision → Move to **Researching** (default starting point)

#### **B. Auto-Set Status on New Grants (INSERT Trigger)**
```sql
CREATE TRIGGER grant_set_crm_status
  BEFORE INSERT ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION set_default_crm_status();
```

**Effect:** Every new grant automatically gets `crmStatus = 'Researching'` (or based on decision if provided)

#### **C. Auto-Update Status When Decision Changes (UPDATE Trigger)**
```sql
CREATE TRIGGER grant_update_crm_on_decision
  BEFORE UPDATE ON "Grant"
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_status_on_decision_change();
```

**Effect:** When a grant's decision changes:
- "Apply" → Moves to **Pipeline**
- "Maybe" → Moves to **Researching**
- "Rejected"/"No" → Moves to **Lost**

**Safety:** Only updates if `crmStatus` is in early stages (`Researching` or `Pipeline`). Won't override manual status changes in later stages.

---

## 🚀 **How to Apply the Fix**

### **Option 1: Run SQL Directly (Recommended)**
```bash
# If you have psql installed:
psql $DATABASE_URL -f fix_grant_pipeline.sql

# Or copy/paste the SQL into Supabase SQL Editor
```

### **Option 2: Create Supabase Migration**
```bash
# Create new migration file
cp fix_grant_pipeline.sql supabase/migrations/20260406_fix_grant_pipeline.sql

# Push to Supabase
npx supabase db push
```

---

## 📈 **Expected Results**

### **Before Fix:**
```
CRM Grants: 0
All Grants: 5
Drafts: 30
```

### **After Fix:**
```
CRM Distribution:
- Researching: ~3-4 grants (those with no decision or "Maybe")
- Pipeline: ~1-2 grants (those marked "Apply")
- Lost: ~0-1 grants (those marked "Rejected" or "No")

Total in CRM: 5 grants (all visible)
```

---

## 🔍 **Verification Steps**

1. **Run diagnostic script first:**
   ```sql
   -- See current state
   \i diagnose_grant_pipeline.sql
   ```

2. **Apply the fix:**
   ```sql
   -- Apply the fix
   \i fix_grant_pipeline.sql
   ```

3. **Check CRM page:**
   - Navigate to `/grants/crm`
   - Should now see grants in Kanban columns
   - Can drag/drop between pipeline stages

4. **Test new grant creation:**
   ```sql
   -- Create test grant
   INSERT INTO "Grant" (id, "companyId", name, "createdAt", "updatedAt")
   VALUES (gen_random_uuid(), 'your-company-id', 'Test Grant', NOW(), NOW());
   
   -- Verify it has crmStatus
   SELECT name, "crmStatus" FROM "Grant" WHERE name = 'Test Grant';
   -- Should show: crmStatus = 'Researching'
   ```

5. **Test decision change:**
   ```sql
   -- Update decision
   UPDATE "Grant" SET "decision" = 'Apply' WHERE name = 'Test Grant';
   
   -- Verify crmStatus updated
   SELECT name, "decision", "crmStatus" FROM "Grant" WHERE name = 'Test Grant';
   -- Should show: crmStatus = 'Pipeline'
   ```

---

## 🎯 **What This Fixes**

✅ **Immediate:**
- All existing grants now visible in CRM
- Grants automatically organized by decision status
- CRM pipeline now reflects actual grant data

✅ **Ongoing:**
- New grants automatically enter pipeline at "Researching"
- Decision changes automatically move grants to appropriate stage
- No more manual `crmStatus` updates needed for basic flow

✅ **User Experience:**
- CRM no longer appears empty
- Pipeline reflects real grant progress
- Drag-and-drop works as expected

---

## ⚠️ **Important Notes**

### **Trigger Behavior:**
- Triggers only affect **early-stage** grants (Researching/Pipeline)
- Once a grant reaches "Active", "Built", "Improved", or "Submitted", decision changes won't auto-update status
- This prevents accidentally moving a grant backwards in the pipeline

### **Manual Overrides:**
- Users can still manually set `crmStatus` to any valid value
- Manual changes are preserved (triggers won't override)
- Triggers only fill in `NULL` values or update early stages

### **Data Safety:**
- The UPDATE statement only affects grants where `crmStatus IS NULL`
- Existing `crmStatus` values are preserved
- No data is deleted or lost

---

## 📋 **Files Created**

1. **`diagnose_grant_pipeline.sql`** - Diagnostic queries to see current state
2. **`fix_grant_pipeline.sql`** - Complete fix with triggers and backfill
3. **`GRANT_PIPELINE_FIX_SUMMARY.md`** - This documentation

---

## 🔄 **Next Steps**

1. Run `diagnose_grant_pipeline.sql` to confirm the issue
2. Run `fix_grant_pipeline.sql` to apply the fix
3. Refresh the CRM page at `/grants/crm`
4. Verify grants are now visible in the pipeline
5. Test creating a new grant and changing its decision

---

## 🐛 **Related Issues from Audit**

This fix also addresses:
- **Issue #4** from audit: "All 4 grants AI routes have no auth" (separate fix needed)
- **Issue #17** from audit: "Grants PATCH/DELETE have no ownership check" (separate fix needed)
- **Issue #15** from audit: "`deadlineDate` accepts any string" (separate fix needed)

This fix specifically solves the **pipeline visibility and status enforcement** problem.
