// Supabase Edge Function: auto-enrich-hospital
// Triggered by INSERT on HospitalLead.
// Calls PATCH /api/hospitals/[id] with { enrich: true } to fill missing fields.

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

    // Validate webhook payload shape (basic protection for --no-verify-jwt)
    if (!payload?.type || !payload?.table || !payload?.record) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not INSERT" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const id = payload.record?.id as string;
    const enriched = payload.record?.enriched as boolean | null;

    if (!id) {
      return new Response(JSON.stringify({ error: "No ID" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Skip if already enriched
    if (enriched === true) {
      return new Response(JSON.stringify({ skipped: true, reason: "Already enriched" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-enriching hospital: ${id} (${payload.record?.name})`);

    const res = await fetch(`${APP_URL}/api/hospitals/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ enrich: true }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Enrich failed for ${id}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const fields = (data.fieldsUpdated as string[]) ?? [];
    console.log(`Enriched hospital ${id}: ${fields.join(", ") || "no new fields"}`);

    return new Response(JSON.stringify({ success: true, id, fieldsUpdated: fields }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-enrich-hospital error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
