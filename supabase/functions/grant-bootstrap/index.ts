// Supabase Edge Function: grant-bootstrap
// GET all grants + company info + grant profile in one call.
// Replaces Next.js /api/grants/bootstrap — no caching issues.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("grant-bootstrap");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID = "demo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [
      { data: grants, error: grantsErr },
      { data: company },
      { data: companyInfo },
      { data: profile },
    ] = await Promise.all([
      db.from("Grant")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("deadlineDate", { ascending: true, nullsFirst: false })
        .limit(2000),
      db.from("Company")
        .select("id, name, industry, website")
        .eq("id", DEMO_COMPANY_ID)
        .maybeSingle(),
      db.from("CompanyInfo")
        .select("bulkContent, values, corePhilosophy, founders, achievements, products")
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle(),
      db.from("GrantProfile")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle(),
    ]);

    if (grantsErr) throw grantsErr;

    return json({
      grants: grants ?? [],
      company: company ?? null,
      info: companyInfo ?? null,
      profile: profile ?? null,
    });
  } catch (err) {
    log.error("Unhandled error", { error: String(err) });
    return json({ error: String(err) }, 500);
  }
});
