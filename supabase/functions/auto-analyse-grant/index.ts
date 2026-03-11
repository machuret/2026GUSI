// Supabase Edge Function: auto-analyse-grant
// Triggered by a database webhook on INSERT to the Grant table.
// Calls the Next.js /api/grants/analyse endpoint with the new grant's ID.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const APP_URL = Deno.env.get("APP_URL"); // e.g. https://your-app.vercel.app
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
    // Verify this is a POST from Supabase
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

    // Only process INSERTs
    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not an INSERT" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const grantId = payload.record?.id as string;
    if (!grantId) {
      return new Response(JSON.stringify({ error: "No grant ID in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-analysing grant: ${grantId} (${payload.record?.name ?? "unknown"})`);

    // Call the Next.js analyse endpoint with service role key auth
    const res = await fetch(`${APP_URL}/api/grants/analyse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ grantId }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Analysis failed for ${grantId}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200, // Return 200 so webhook doesn't retry endlessly
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Analysis complete for ${grantId}: ${data.analysis?.verdict} (${data.analysis?.score})`);

    return new Response(JSON.stringify({ success: true, grantId, verdict: data.analysis?.verdict }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-analyse-grant error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, // Don't trigger retries
      headers: { "Content-Type": "application/json" },
    });
  }
});
