import OpenAI from "openai";

// ─── Central model config — change here, applies everywhere ───────────────────
export const MODEL_CONFIG = {
  generate:        "gpt-4o",
  generateBulk:    "gpt-4o",
  generateAB:      "gpt-4o",
  revise:          "gpt-4o",
  voiceAnalyse:    "gpt-4o",
  voiceGenerate:   "gpt-4o",
  styleAnalyse:    "gpt-4o-mini",
  vaultCrawl:      "gpt-4o-mini",
  grantsAnalyse:   "gpt-4o",
  grantsWrite:     "gpt-4o",
  companyResearch: "gpt-4o-mini",
} as const;

export type UsageResult = {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type CallOptions = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Edge-compatible OpenAI chat completion — returns raw string.
 * Works in both edge and Node runtimes (uses fetch, not the Node SDK).
 * Retries up to 2 times on transient errors (429, 5xx) with exponential backoff.
 */
export async function callOpenAI({
  systemPrompt,
  userPrompt,
  model = MODEL_CONFIG.generate,
  maxTokens = 1000,
  temperature = 0.3,
  jsonMode = true,
}: CallOptions): Promise<string> {
  const result = await callOpenAIWithUsage({ systemPrompt, userPrompt, model, maxTokens, temperature, jsonMode });
  return result.content;
}

/**
 * Like callOpenAI but also returns token usage for accurate cost tracking.
 */
export async function callOpenAIWithUsage({
  systemPrompt,
  userPrompt,
  model = MODEL_CONFIG.generate,
  maxTokens = 1000,
  temperature = 0.3,
  jsonMode = true,
}: CallOptions): Promise<UsageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(Math.pow(2, attempt) * 500); // 1s, 2s

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content ?? "{}",
        promptTokens:     data.usage?.prompt_tokens     ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens:      data.usage?.total_tokens      ?? 0,
      };
    }

    const errText = await res.text();
    lastError = new Error(`OpenAI error (${res.status}): ${errText.slice(0, 300)}`);

    if (!RETRYABLE_STATUSES.has(res.status)) break;
  }

  throw lastError ?? new Error("OpenAI request failed");
}

/**
 * Like callOpenAI but parses the response as JSON.
 * Strips markdown code fences if present.
 * Throws a typed error if parsing fails — no need for try/catch in every route.
 */
export async function callOpenAIJson<T = Record<string, unknown>>(
  options: CallOptions
): Promise<T> {
  const raw = await callOpenAI(options);
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to salvage a JSON object from within the response
    const match = cleaned.match(/\{[\s\S]+\}/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    throw new Error("AI returned malformed JSON — please try again");
  }
}


const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

function getOpenAI(): OpenAI {
  if (!globalForOpenAI.openai) {
    globalForOpenAI.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return globalForOpenAI.openai;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
