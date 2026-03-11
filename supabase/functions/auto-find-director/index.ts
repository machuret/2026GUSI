// Supabase Edge Function: auto-find-director
// Triggered by UPDATE on HospitalLead when enriched changes to true.
// Calls PATCH /api/hospitals/[id] with { findDirector: true } to find the residency PD.

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

    if (payload.type !== "UPDATE") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not UPDATE" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const id = payload.record?.id as string;
    const enriched = payload.record?.enriched as boolean | null;
    const oldEnriched = payload.old_record?.enriched as boolean | null;
    const directorName = payload.record?.directorName as string | null;

    if (!id) {
      return new Response(JSON.stringify({ error: "No ID" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Only fire when enriched changes from false/null to true AND no director yet
    const justEnriched = enriched === true && (oldEnriched === false || oldEnriched == null);
    const alreadyHasDirector = directorName != null && directorName.trim() !== "";

    if (!justEnriched || alreadyHasDirector) {
      console.log(`Skipping findDirector for ${id} — justEnriched=${justEnriched}, hasDirector=${alreadyHasDirector}`);
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-finding director for hospital: ${id} (${payload.record?.name})`);

    const res = await fetch(`${APP_URL}/api/hospitals/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ findDirector: true }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`FindDirector failed for ${id}:`, data.error);
      return new Response(JSON.stringify({ success: false, error: data.error }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const fields = (data.fieldsUpdated as string[]) ?? [];
    console.log(`Director found for ${id}: ${fields.join(", ") || "none"} (confidence: ${data.confidence}, lead: ${data.leadCreated})`);

    return new Response(JSON.stringify({
      success: true, id,
      fieldsUpdated: fields,
      leadCreated: data.leadCreated,
      confidence: data.confidence,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-find-director error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
