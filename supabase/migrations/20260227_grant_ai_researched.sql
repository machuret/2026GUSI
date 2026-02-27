-- Track whether AI Research (autofill) has been run on this grant
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "aiResearched" BOOLEAN DEFAULT FALSE;
