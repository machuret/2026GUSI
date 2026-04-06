/**
 * _shared/db.ts
 * Database utility helpers shared across grant edge functions.
 *
 * Exports:
 *  - logUsage — fire-and-forget AI token usage insert into AiUsageLog
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODEL } from "./openai.ts";

// ── Per-model pricing (USD per 1M tokens) ────────────────────────────────────
// Update this map when adding new models so cost calculations stay accurate.

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":  { input: 0.15,  output: 0.60  },
  "gpt-4o":       { input: 2.50,  output: 10.00 },
  "gpt-4-turbo":  { input: 10.00, output: 30.00 },
};

/** Fallback pricing when the model is not in MODEL_PRICING. */
const FALLBACK_PRICING = { input: 0.15, output: 0.60 };

// ── AI usage logging ──────────────────────────────────────────────────────────

/**
 * Fire-and-forget insert of AI token usage into the AiUsageLog table.
 * Errors are intentionally swallowed — a logging failure must never break
 * a user-facing response.
 *
 * @param db              Service-role Supabase client.
 * @param companyId       Company ID for the request.
 * @param feature         Feature identifier (e.g. "grants_write_section").
 * @param promptTokens    Tokens used in the prompt.
 * @param completionTokens Tokens in the completion.
 */
export function logUsage(
  db: ReturnType<typeof createClient>,
  companyId: string,
  feature: string,
  promptTokens: number,
  completionTokens: number,
): void {
  const pricing = MODEL_PRICING[MODEL] ?? FALLBACK_PRICING;
  const costUsd = (promptTokens / 1_000_000) * pricing.input
                + (completionTokens / 1_000_000) * pricing.output;
  void db.from("AiUsageLog").insert({
    companyId, model: MODEL, feature,
    promptTokens, completionTokens,
    totalTokens: promptTokens + completionTokens, costUsd,
  });
}
