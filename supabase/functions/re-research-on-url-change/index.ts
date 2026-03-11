// Supabase Edge Function: re-research-on-url-change
// Triggered by UPDATE on Grant table when the URL field changes.
// Re-crawls the new URL and fills missing fields.

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
    const newUrl = payload.record?.url as string | null;
    const oldUrl = payload.old_record?.url as string | null;

    if (!grantId) {
      return new Response(JSON.stringify({ error: "No grant ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only run if URL actually changed and new URL is non-empty
    const urlChanged = newUrl && newUrl.trim() !== "" && newUrl !== oldUrl;

    if (!urlChanged) {
      return new Response(JSON.stringify({ skipped: true, reason: "URL unchanged" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`URL changed for grant ${grantId}: ${oldUrl ?? "none"} → ${newUrl}`);

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
      console.error(`Re-research failed for ${grantId}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const filledCount = Object.keys(data.filled ?? {}).length;
    console.log(`Re-research complete for ${grantId}: filled ${filledCount} fields from new URL`);

    return new Response(JSON.stringify({ success: true, grantId, filledCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("re-research-on-url-change error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
