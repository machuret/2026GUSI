/**
 * _shared/openai.ts
 * OpenAI API helpers shared across grant edge functions.
 *
 * Exports:
 *  - MODEL              — canonical model name (single source of truth)
 *  - callOpenAIJson     — non-streaming JSON completion with retry
 *  - callOpenAIStream   — streaming SSE completion as a ReadableStream
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

/** Canonical OpenAI model used by all grant functions. */
export const MODEL = "gpt-4o-mini";

// ── JSON completion ────────────────────────────────────────────────────────────

/**
 * Calls the OpenAI Chat Completions API and returns the full JSON response.
 * Retries up to 2 times with exponential back-off on rate-limit / server errors.
 *
 * @param systemPrompt  The system instruction message.
 * @param userPrompt    The user content message.
 * @param maxTokens     Maximum output tokens.
 * @param temperature   Sampling temperature (0 = deterministic).
 * @returns Parsed content string plus token usage counts.
 * @throws  If all retries are exhausted or a non-retryable HTTP error occurs.
 */
export async function callOpenAIJson(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const MAX_RETRIES = 2;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        content:          data.choices?.[0]?.message?.content ?? "{}",
        promptTokens:     data.usage?.prompt_tokens     ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    }
    const errText = await res.text();
    lastErr = new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
    if (![429, 500, 502, 503, 504].includes(res.status)) break;
  }
  throw lastErr ?? new Error("OpenAI request failed");
}

// ── Streaming completion ───────────────────────────────────────────────────────

/**
 * Calls the OpenAI Chat Completions API with `stream: true` and returns a
 * `ReadableStream<Uint8Array>` of raw UTF-8 text chunks for the caller to
 * pipe directly as an HTTP response body.
 *
 * @param systemPrompt  The system instruction message.
 * @param userPrompt    The user content message.
 * @param maxTokens     Maximum output tokens.
 * @param temperature   Sampling temperature.
 */
export function callOpenAIStream(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => { if (!closed) { closed = true; controller.close(); } };
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature,
            max_tokens: maxTokens,
            stream: true,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          controller.error(new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`));
          return;
        }
        const reader  = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const chunk = trimmed.slice(6).trim();
            if (chunk === "[DONE]") { close(); return; }
            try {
              const parsed = JSON.parse(chunk);
              const delta  = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch { /* skip malformed SSE chunk */ }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        close();
      }
    },
  });
}
