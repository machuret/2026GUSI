/**
 * _shared/db.ts
 * Database utility helpers shared across grant edge functions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODEL } from "./openai.ts";

// ── AI usage logging ──────────────────────────────────────────────────────────

export function logUsage(
  db: ReturnType<typeof createClient>,
  companyId: string,
  feature: string,
  promptTokens: number,
  completionTokens: number,
) {
  const pricing = { input: 0.15, output: 0.60 }; // gpt-4o-mini per 1M tokens
  const costUsd  = (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
  void db.from("AiUsageLog").insert({
    companyId, model: MODEL, feature,
    promptTokens, completionTokens,
    totalTokens: promptTokens + completionTokens, costUsd,
  });
}
