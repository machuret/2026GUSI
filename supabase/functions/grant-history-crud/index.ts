// Supabase Edge Function: grant-history-crud
// GET  — list all GrantHistory rows for the company (optionally filtered by funderName)
// POST — insert a new GrantHistory row
// DELETE — remove a row by ?id= query param
//
// Used by:
//   - /grants/history UI page (read + import)
//   - /api/grants/history/check (duplicate detection)
//   - /api/grants/analyse (AI context injection)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-history-crud");

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID   = "demo";

// Module-level service-role client — safe to share since it carries no user state.
// Avoids re-allocating a new client on every request.
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const VALID_OUTCOMES = [
  "Won", "Submitted", "Rejected", "Shortlisted",
  "NotSubmitted", "Exploratory", "Active", "Pending",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Validate and sanitise fields for a new GrantHistory row. */
function validateRow(body: Record<string, unknown>): { data: Record<string, unknown>; error: string | null } {
  if (!body.funderName || typeof body.funderName !== "string" || !body.funderName.trim()) {
    return { data: {}, error: "funderName is required" };
  }
  if (body.outcome && !VALID_OUTCOMES.includes(body.outcome as typeof VALID_OUTCOMES[number])) {
    return { data: {}, error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` };
  }

  return {
    error: null,
    data: {
      companyId:       DEMO_COMPANY_ID,
      funderName:      String(body.funderName).trim(),
      grantName:       body.grantName      ? String(body.grantName).trim()      : null,
      partnerOrg:      body.partnerOrg     ? String(body.partnerOrg).trim()     : null,
      region:          body.region         ? String(body.region).trim()         : null,
      outcome:         body.outcome        ?? null,
      amount:          body.amount         ? String(body.amount).trim()         : null,
      rejectionReason: body.rejectionReason ? String(body.rejectionReason).trim() : null,
      notes:           body.notes          ? String(body.notes).trim()          : null,
      submittedAt:     body.submittedAt    ? String(body.submittedAt)           : null,
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);

    // ── GET — list history rows, optionally filtered by funderName ─────────
    if (req.method === "GET") {
      const funderFilter = url.searchParams.get("funderName");
      let query = db
        .from("GrantHistory")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("submittedAt", { ascending: false, nullsFirst: false });

      if (funderFilter) {
        // Case-insensitive partial match for CRM duplicate detection
        query = query.ilike("funderName", `%${funderFilter}%`);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      log.info("GET OK", { count: data?.length ?? 0, funderFilter: funderFilter ?? "all" });
      return json({ history: data ?? [] });
    }

    // ── POST — insert one or more new rows ────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();

      // Accept a single row object OR an array (bulk import from AI parser)
      const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : [body];

      // Validate all rows first — collect every error before touching the DB.
      const toInsert: Record<string, unknown>[] = [];
      const validationErrors: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const { data, error } = validateRow(rows[i]);
        if (error) validationErrors.push(`Row ${i + 1}: ${error}`);
        else toInsert.push(data);
      }
      if (validationErrors.length > 0) {
        return json({ error: validationErrors.join("; ") }, 400);
      }

      const { data: inserted, error: insertErr } = await db
        .from("GrantHistory")
        .insert(toInsert)
        .select();

      if (insertErr) throw insertErr;
      log.info("POST OK", { count: inserted?.length ?? 0 });
      return json({ success: true, inserted });
    }

    // ── DELETE — remove a row by ?id= ─────────────────────────────────────
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing ?id= param" }, 400);

      // Verify ownership before deletion
      const { data: existing } = await db
        .from("GrantHistory")
        .select("companyId")
        .eq("id", id)
        .maybeSingle();


      if (!existing) return json({ error: "Record not found" }, 404);
      if (existing.companyId !== DEMO_COMPANY_ID) return json({ error: "Forbidden" }, 403);

      const { error } = await db.from("GrantHistory").delete().eq("id", id);
      if (error) throw error;
      log.info("DELETE OK", { id: id.slice(0, 8) });
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    log.error("Unhandled error", { error: String(err) });
    return json({ error: String(err) }, 500);
  }
});
