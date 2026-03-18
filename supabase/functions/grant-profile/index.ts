// Supabase Edge Function: grant-profile
// GET + PUT for the GrantProfile table.
// Replaces Next.js /api/grant-profile.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID = "demo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
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

// Allow-list of valid profile columns
const STRING_FIELDS = [
  "contactName", "contactRole", "contactEmail", "contactPhone", "contactAddress",
  "orgType", "orgType2", "sector", "subSector", "location", "country",
  "stage", "teamSize", "annualRevenue", "yearFounded",
  "preferredDuration", "missionStatement", "keyActivities",
  "pastGrantsWon", "uniqueStrengths",
];
const BOOL_FIELDS = [
  "isRegisteredCharity", "hasEIN",
  "indigenousOwned", "womanOwned", "regionalOrRural",
];
const NUM_FIELDS = ["targetFundingMin", "targetFundingMax"];

function cleanProfileData(body: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const k of STRING_FIELDS) {
    if (k in body) clean[k] = typeof body[k] === "string" ? body[k] : null;
  }
  for (const k of BOOL_FIELDS) {
    if (k in body) clean[k] = typeof body[k] === "boolean" ? body[k] : false;
  }
  for (const k of NUM_FIELDS) {
    if (k in body) {
      const v = body[k];
      clean[k] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
    }
  }
  if ("focusAreas" in body) {
    clean.focusAreas = Array.isArray(body.focusAreas) ? body.focusAreas.filter((a: unknown) => typeof a === "string") : [];
  }
  if ("extraDocs" in body) {
    clean.extraDocs = Array.isArray(body.extraDocs)
      ? body.extraDocs.filter((d: unknown) =>
          d && typeof d === "object" && typeof (d as Record<string,unknown>).title === "string" && typeof (d as Record<string,unknown>).content === "string"
        )
      : [];
  }

  return clean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await verifyAuth(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // GET — return current profile
    if (req.method === "GET") {
      const { data } = await db
        .from("GrantProfile")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle();

      return json({ profile: data ?? null });
    }

    // PUT — upsert profile
    if (req.method === "PUT") {
      const body = await req.json();
      const data = cleanProfileData(body);

      const { data: saved, error } = await db
        .from("GrantProfile")
        .upsert(
          { ...data, companyId: DEMO_COMPANY_ID, updatedAt: new Date().toISOString() },
          { onConflict: "companyId" }
        )
        .select()
        .single();

      if (error) {
        console.error("[grant-profile] DB error:", error);
        throw error;
      }

      console.log(`[grant-profile] Saved profile for ${DEMO_COMPANY_ID}`);
      return json({ success: true, profile: saved });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("grant-profile error:", err);
    return json({ error: String(err) }, 500);
  }
});
