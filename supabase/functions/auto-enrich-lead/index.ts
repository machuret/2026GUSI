// Supabase Edge Function: auto-enrich-lead
// Triggered by INSERT on Lead table.
// For director/hospital/manual sources, calls POST /api/leads/enrich for deep AI enrichment.
// Skips scraped leads (linkedin/webmd/doctolib) as they already have data.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const APP_URL = Deno.env.get("APP_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Sources that benefit from deep AI enrichment
const AI_ENRICH_SOURCES = new Set(["residency_director", "hospital", "manual"]);

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
        status: 405, headers: { "Content-Type": "application/json" },
      });
    }
    if (!APP_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing APP_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Misconfigured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not INSERT" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const id = payload.record?.id as string;
    const source = payload.record?.source as string;

    if (!id) {
      return new Response(JSON.stringify({ error: "No ID" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Only enrich director/hospital/manual leads — scraped leads already have data
    if (!AI_ENRICH_SOURCES.has(source)) {
      console.log(`Skipping enrich for ${id} — source=${source} (scraped data sufficient)`);
      return new Response(JSON.stringify({ skipped: true, reason: `Source ${source} not AI-enrichable` }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-enriching lead: ${id} (${payload.record?.fullName}, source=${source})`);

    const res = await fetch(`${APP_URL}/api/leads/enrich`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ leadIds: [id] }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Enrich failed for lead ${id}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const updated = data.enriched?.[0]?.updated ?? false;
    console.log(`Lead ${id} enriched: ${updated}`);

    return new Response(JSON.stringify({ success: true, id, updated }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-enrich-lead error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
