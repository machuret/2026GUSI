// Supabase Edge Function: grant-create
// POST to create a new grant.
// Replaces Next.js POST /api/grants.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID = "demo";

const VALID_EFFORT = ["Low", "Medium", "High"];
const VALID_DECISION = ["Apply", "Maybe", "No", "Rejected"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();

    // Validate required fields
    const name = body.name as string | undefined;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return json({ error: "Grant name is required" }, 400);
    }

    // Build clean insert object — only allow known fields, coerce empty strings to null
    const str = (v: unknown) => (typeof v === "string" && v.trim() !== "") ? v : null;
    const numRange = (v: unknown, min: number, max: number) =>
      typeof v === "number" && v >= min && v <= max ? v : null;
    const enumVal = (v: unknown, valid: string[]) =>
      typeof v === "string" && valid.includes(v) ? v : null;

    const insert: Record<string, unknown> = {
      companyId: DEMO_COMPANY_ID,
      name: name.trim(),
      founder: str(body.founder),
      url: str(body.url),
      deadlineDate: str(body.deadlineDate),
      howToApply: str(body.howToApply),
      geographicScope: str(body.geographicScope),
      eligibility: str(body.eligibility),
      amount: str(body.amount),
      projectDuration: str(body.projectDuration),
      fitScore: numRange(body.fitScore, 1, 5),
      submissionEffort: enumVal(body.submissionEffort, VALID_EFFORT),
      decision: enumVal(body.decision, VALID_DECISION),
      notes: str(body.notes),
      updatedAt: new Date().toISOString(),
    };

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: grant, error } = await db
      .from("Grant")
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error("[grant-create] DB error:", error);
      throw error;
    }

    console.log(`[grant-create] Created ${grant.id.slice(0, 8)} "${name.slice(0, 40)}"`);
    return json({ success: true, grant });
  } catch (err) {
    console.error("grant-create error:", err);
    return json({ error: String(err) }, 500);
  }
});
