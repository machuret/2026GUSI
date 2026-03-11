// Supabase Edge Function: auto-complexity-score
// Triggered by UPDATE on Grant table when aiScore is set (analyse completed).
// Calls /api/grants/score-complexity to score application effort.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const APP_URL = Deno.env.get("APP_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!APP_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing APP_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: WebhookPayload = await req.json();

    if (payload.type !== "UPDATE") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not an UPDATE" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const grantId = payload.record?.id as string;
    const aiScore = payload.record?.aiScore as number | null;
    const oldAiScore = payload.old_record?.aiScore as number | null;
    const complexityScore = payload.record?.complexityScore as number | null;

    if (!grantId) {
      return new Response(JSON.stringify({ error: "No grant ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only run if aiScore was just set (changed from null) and complexity not yet scored
    const aiScoreJustSet = aiScore != null && oldAiScore == null;
    const alreadyScored = complexityScore != null;

    if (!aiScoreJustSet || alreadyScored) {
      console.log(`Skipping complexity for ${grantId} — aiScoreJustSet=${aiScoreJustSet}, alreadyScored=${alreadyScored}`);
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-scoring complexity for grant: ${grantId}`);

    const res = await fetch(`${APP_URL}/api/grants/score-complexity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ grantIds: [grantId] }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Complexity scoring failed for ${grantId}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Complexity scored for ${grantId}:`, data.results?.[0]?.complexityLabel);

    return new Response(JSON.stringify({ success: true, grantId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-complexity-score error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
