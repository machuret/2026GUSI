// Supabase Edge Function: grant-bulk-delete
// Bulk delete grants by IDs.
// Replaces Next.js /api/grants/bulk-delete.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID = "demo";

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
    const ids = body.ids as string[];

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
      return json({ error: "ids must be an array of 1-100 strings" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify ownership
    const { data: owned, error: checkErr } = await db
      .from("Grant")
      .select("id")
      .in("id", ids)
      .eq("companyId", DEMO_COMPANY_ID);

    if (checkErr) throw checkErr;
    const ownedIds = (owned ?? []).map((r: { id: string }) => r.id);

    if (ownedIds.length === 0) {
      return json({ success: false, error: "No matching grants found" }, 404);
    }

    const { error } = await db.from("Grant").delete().in("id", ownedIds);
    if (error) throw error;

    console.log(`[grant-bulk-delete] deleted=${ownedIds.length} of ${ids.length} requested`);
    return json({ success: true, deleted: ownedIds.length });
  } catch (err) {
    console.error("grant-bulk-delete error:", err);
    return json({ error: String(err) }, 500);
  }
});
