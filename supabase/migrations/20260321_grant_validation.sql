ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "validationStatus" TEXT CHECK ("validationStatus" IN ('VALIDATED', 'FAILED')),
  ADD COLUMN IF NOT EXISTS "validatedAt"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "validationResult" JSONB;
