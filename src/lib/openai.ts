import OpenAI from "openai";

type CallOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
};

/**
 * Edge-compatible OpenAI chat completion — returns raw string.
 * Works in both edge and Node runtimes (uses fetch, not the Node SDK).
 */
export async function callOpenAI({
  systemPrompt,
  userPrompt,
  maxTokens = 1000,
  temperature = 0.3,
  jsonMode = true,
}: CallOptions): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
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
