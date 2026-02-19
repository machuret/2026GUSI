import { db } from "./db";
import { DEMO_COMPANY_ID } from "./constants";

// GPT-4o pricing (per 1M tokens, as of Feb 2026)
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o":       { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":  { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":  { input: 10.00, output: 30.00 },
  "gpt-4":        { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo":{ input: 0.50,  output: 1.50  },
};

export function calcCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = COST_PER_1M[model] ?? COST_PER_1M["gpt-4o"];
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
}

export interface UsageData {
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  userId?: string;
}

/**
 * Fire-and-forget AI usage logger. Never throws — logging failure must not break the request.
 */
export function logAiUsage(data: UsageData): void {
  const totalTokens = data.promptTokens + data.completionTokens;
  const costUsd = calcCostUsd(data.model, data.promptTokens, data.completionTokens);

  void (async () => {
    try {
      await db.from("AiUsageLog").insert({
        companyId: DEMO_COMPANY_ID,
        userId: data.userId ?? null,
        model: data.model,
        feature: data.feature,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens,
        costUsd,
      });
    } catch { /* intentionally silent — logging must never break a request */ }
  })();
}
