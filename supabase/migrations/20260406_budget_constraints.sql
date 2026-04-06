-- ═══════════════════════════════════════════════════════════════════════════
-- BUDGET TEMPLATE - ADD MISSING CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Purpose: Add critical constraints identified in quality audit
-- Issues Fixed:
--   1. Missing FK constraint on companyId
--   2. No unique constraint (allows duplicates)
--   3. No validation on unitCost (can be negative/zero)
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add Foreign Key Constraint ──────────────────────────────────────────
-- Note: Only add if Company table exists, otherwise skip
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Company') THEN
    ALTER TABLE "BudgetLineItem" 
      ADD CONSTRAINT "BudgetLineItem_companyId_fkey" 
      FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE;
    RAISE NOTICE '✓ Added FK constraint on BudgetLineItem.companyId';
  ELSE
    RAISE NOTICE '⚠ Company table not found - skipping FK constraint';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ FK constraint already exists - skipping';
END $$;

-- ── 2. Add Unique Constraint ───────────────────────────────────────────────
-- Prevent duplicate line items (same company, category, name)
DO $$
BEGIN
  ALTER TABLE "BudgetLineItem"
    ADD CONSTRAINT "BudgetLineItem_unique" 
    UNIQUE ("companyId", category, name);
  RAISE NOTICE '✓ Added unique constraint on (companyId, category, name)';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ Unique constraint already exists - skipping';
END $$;

-- ── 3. Add Cost Validation ─────────────────────────────────────────────────
-- Ensure unitCost is always positive
DO $$
BEGIN
  ALTER TABLE "BudgetLineItem"
    ADD CONSTRAINT "BudgetLineItem_unitCost_positive"
    CHECK ("unitCost" > 0);
  RAISE NOTICE '✓ Added check constraint: unitCost must be > 0';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ Cost validation constraint already exists - skipping';
END $$;

-- ── 4. Add Quantity Validation ─────────────────────────────────────────────
-- Ensure defaultQuantity is positive if specified
DO $$
BEGIN
  ALTER TABLE "BudgetLineItem"
    ADD CONSTRAINT "BudgetLineItem_defaultQuantity_positive"
    CHECK ("defaultQuantity" IS NULL OR "defaultQuantity" > 0);
  RAISE NOTICE '✓ Added check constraint: defaultQuantity must be > 0 or NULL';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ Quantity validation constraint already exists - skipping';
END $$;

-- ── 5. Add Template FK Constraint ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Company') THEN
    ALTER TABLE "BudgetTemplate" 
      ADD CONSTRAINT "BudgetTemplate_companyId_fkey" 
      FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE;
    RAISE NOTICE '✓ Added FK constraint on BudgetTemplate.companyId';
  ELSE
    RAISE NOTICE '⚠ Company table not found - skipping FK constraint';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ FK constraint already exists - skipping';
END $$;

-- ── 6. Add Template Overhead Validation ────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE "BudgetTemplate"
    ADD CONSTRAINT "BudgetTemplate_overheadRate_valid"
    CHECK ("overheadRate" IS NULL OR ("overheadRate" >= 0 AND "overheadRate" <= 100));
  RAISE NOTICE '✓ Added check constraint: overheadRate must be 0-100%';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠ Overhead validation constraint already exists - skipping';
END $$;

-- ── Verification ───────────────────────────────────────────────────────────
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  CASE contype
    WHEN 'f' THEN 'Foreign Key'
    WHEN 'u' THEN 'Unique'
    WHEN 'c' THEN 'Check'
    WHEN 'p' THEN 'Primary Key'
  END as type_description
FROM pg_constraint
WHERE conrelid IN (
  'BudgetLineItem'::regclass,
  'BudgetTemplate'::regclass
)
ORDER BY conrelid, contype;
