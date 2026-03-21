// Supabase Edge Function: grant-crud
// PATCH (update) and DELETE a single grant by ID.
// Replaces Next.js /api/grants/[id] — direct DB access, no caching.
// Pass grant ID as ?id=UUID query param.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-crud");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID = "demo";

const VALID_CRM = ["Researching", "Pipeline", "Active", "Submitted", "Won", "Lost"];
const VALID_DECISION = ["Apply", "Maybe", "No", "Rejected"];
const VALID_EFFORT = ["Low", "Medium", "High"];
const VALID_COMPLEXITY = ["Low", "Medium", "High", "Very High"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
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

// Lightweight validation (replaces Zod in Deno context)
function validateUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const allowed: Record<string, (v: unknown) => boolean> = {
    name: (v) => typeof v === "string" && v.length > 0,
    founder: (v) => v === null || typeof v === "string",
    url: (v) => v === null || typeof v === "string",
    deadlineDate: (v) => v === null || typeof v === "string",
    howToApply: (v) => v === null || typeof v === "string",
    geographicScope: (v) => v === null || typeof v === "string",
    eligibility: (v) => v === null || typeof v === "string",
    amount: (v) => v === null || typeof v === "string",
    projectDuration: (v) => v === null || typeof v === "string",
    fitScore: (v) => v === null || (typeof v === "number" && v >= 1 && v <= 5),
    submissionEffort: (v) => v === null || VALID_EFFORT.includes(v as string),
    decision: (v) => v === null || VALID_DECISION.includes(v as string),
    notes: (v) => v === null || typeof v === "string",
    matchScore: (v) => v === null || (typeof v === "number" && v >= 0 && v <= 100),
    complexityScore: (v) => v === null || (typeof v === "number" && v >= 0 && v <= 100),
    complexityLabel: (v) => v === null || VALID_COMPLEXITY.includes(v as string),
    complexityNotes: (v) => v === null || typeof v === "string",
    crmStatus: (v) => v === null || VALID_CRM.includes(v as string),
    crmNotes: (v) => v === null || typeof v === "string",
    aiAnalysis: (v) => v === null || typeof v === "object",
    aiBrief: (v) => v === null || typeof v === "object",
    aiResearched: (v) => v === null || typeof v === "boolean",
    validationStatus: (v) => v === null || v === "VALIDATED" || v === "FAILED",
    validatedAt: (v) => v === null || typeof v === "string",
    validationResult: (v) => v === null || typeof v === "object",
  };

  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    if (key in allowed && allowed[key](val)) {
      clean[key] = val;
    }
  }
  return clean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Missing ?id= param" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify ownership
    const { data: existing, error: fetchErr } = await db
      .from("Grant")
      .select("companyId")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return json({ error: "Grant not found" }, 404);
    if (existing.companyId !== DEMO_COMPANY_ID) return json({ error: "Forbidden" }, 403);

    // PATCH — update grant
    if (req.method === "PATCH") {
      const body = await req.json();
      const data = validateUpdateData(body);
      if (Object.keys(data).length === 0) return json({ error: "No valid fields" }, 400);

      const { data: grant, error } = await db
        .from("Grant")
        .update({ ...data, updatedAt: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      log.info("PATCH OK", { id: id.slice(0, 8), crmStatus: grant?.crmStatus });
      return json({ success: true, grant });
    }

    // DELETE — remove grant
    if (req.method === "DELETE") {
      const { error } = await db.from("Grant").delete().eq("id", id);
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
