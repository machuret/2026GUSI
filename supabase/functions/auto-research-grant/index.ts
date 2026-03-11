// Supabase Edge Function: auto-research-grant
// Triggered by a database webhook on INSERT to the Grant table.
// Only runs if the grant has a URL and is missing key fields.
// Calls the Next.js /api/grants/research endpoint to crawl + fill fields.

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

    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not an INSERT" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const grantId = payload.record?.id as string;
    const grantUrl = payload.record?.url as string | null;
    const grantName = payload.record?.name as string | null;

    if (!grantId) {
      return new Response(JSON.stringify({ error: "No grant ID in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only research if the grant has a URL and is missing key fields
    const hasUrl = grantUrl && grantUrl.trim().length > 0;
    const missingFields = !payload.record?.eligibility && !payload.record?.howToApply;

    if (!hasUrl || !missingFields) {
      console.log(`Skipping research for ${grantId} (${grantName}) — ${!hasUrl ? "no URL" : "fields already filled"}`);
      return new Response(JSON.stringify({ skipped: true, reason: hasUrl ? "Fields already filled" : "No URL" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-researching grant: ${grantId} (${grantName ?? "unknown"}) — URL: ${grantUrl}`);

    const res = await fetch(`${APP_URL}/api/grants/research`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ grantId }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Research failed for ${grantId}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const filledCount = Object.keys(data.filled ?? {}).length;
    console.log(`Research complete for ${grantId}: filled ${filledCount} fields`);

    return new Response(JSON.stringify({ success: true, grantId, filledCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-research-grant error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
