// Supabase Edge Function: auto-qualify-lead
// Triggered by UPDATE on Lead table when enrichment data changes.
// Scores lead data completeness and auto-promotes to "qualified" if score >= 60.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const QUALIFY_THRESHOLD = 60;

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

function scoreCompleteness(record: Record<string, unknown>): number {
  let score = 0;
  const str = (key: string) => {
    const v = record[key];
    return typeof v === "string" && v.trim().length > 0;
  };
  if (str("email"))       score += 25;
  if (str("phone"))       score += 15;
  if (str("fullName"))    score += 10;
  if (str("jobTitle"))    score += 10;
  if (str("company"))     score += 10;
  if (str("linkedinUrl")) score += 10;
  if (Array.isArray(record.specialties) && (record.specialties as string[]).length > 0) score += 5;
  if (str("city") && str("state")) score += 5;
  if (str("notes") && (record.notes as string).length > 50) score += 5;
  if (typeof record.rating === "number" && (record.rating as number) >= 3) score += 5;
  return score;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { "Content-Type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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
    const currentStatus = payload.record?.status as string;

    if (!id) {
      return new Response(JSON.stringify({ error: "No ID" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Don't auto-qualify if already qualified, contacted, or manually set
    const skipStatuses = new Set(["qualified", "contacted", "converted", "archived"]);
    if (skipStatuses.has(currentStatus)) {
      return new Response(JSON.stringify({ skipped: true, reason: `Status=${currentStatus}` }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Check if enrichment data actually changed (email or notes)
    const oldEmail = payload.old_record?.email as string | null;
    const newEmail = payload.record?.email as string | null;
    const oldNotes = payload.old_record?.notes as string | null;
    const newNotes = payload.record?.notes as string | null;
    const oldRating = payload.old_record?.rating as number | null;
    const newRating = payload.record?.rating as number | null;

    const enrichmentChanged =
      (newEmail !== oldEmail) ||
      (newNotes !== oldNotes) ||
      (newRating !== oldRating);

    if (!enrichmentChanged) {
      return new Response(JSON.stringify({ skipped: true, reason: "No enrichment change" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const score = scoreCompleteness(payload.record);
    console.log(`Lead ${id} completeness score: ${score}/100 (threshold: ${QUALIFY_THRESHOLD})`);

    if (score < QUALIFY_THRESHOLD) {
      return new Response(JSON.stringify({ skipped: true, score, reason: "Below threshold" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Auto-qualify via Supabase REST API
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Lead?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "qualified",
          updatedAt: new Date().toISOString(),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to qualify lead ${id}:`, err);
      return new Response(JSON.stringify({ success: false, error: err }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Lead ${id} auto-qualified with score ${score}`);

    return new Response(JSON.stringify({ success: true, id, score, status: "qualified" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-qualify-lead error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
