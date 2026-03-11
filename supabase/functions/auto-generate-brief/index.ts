// Supabase Edge Function: auto-generate-brief
// Triggered by UPDATE on Grant table when aiScore is set and aiResearched is true.
// Pre-generates the strategic writing brief so it's ready when the user opens the Builder.
// Calls /api/grants/write with mode: "brief".

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
    const aiBrief = payload.record?.aiBrief as Record<string, unknown> | null;
    const decision = payload.record?.decision as string | null;

    if (!grantId) {
      return new Response(JSON.stringify({ error: "No grant ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only generate brief if:
    // 1. aiScore was just set (analyse completed)
    // 2. Brief not already generated
    // 3. Grant is not rejected (no point generating brief for rejected grants)
    const aiScoreJustSet = aiScore != null && oldAiScore == null;
    const alreadyHasBrief = aiBrief != null;
    const isRejected = decision === "No" || decision === "Rejected";

    if (!aiScoreJustSet || alreadyHasBrief || isRejected) {
      console.log(`Skipping brief for ${grantId} — aiScoreJustSet=${aiScoreJustSet}, hasBrief=${alreadyHasBrief}, rejected=${isRejected}`);
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Skip if score is very low (not worth generating a brief)
    if (aiScore != null && aiScore < 20) {
      console.log(`Skipping brief for ${grantId} — score too low (${aiScore})`);
      return new Response(JSON.stringify({ skipped: true, reason: "Score too low" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-generating brief for grant: ${grantId} (score: ${aiScore})`);

    const res = await fetch(`${APP_URL}/api/grants/write`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ grantId, mode: "brief" }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Brief generation failed for ${grantId}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Brief generated for ${grantId}: ${data.brief?.winningAngle?.slice(0, 80) ?? "ok"}`);

    return new Response(JSON.stringify({ success: true, grantId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-generate-brief error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
