-- Store full AI fit analysis as JSON so results persist across page reloads
ALTER TABLE "Grant"
  ADD COLUMN IF NOT EXISTS "aiAnalysis" JSONB;
