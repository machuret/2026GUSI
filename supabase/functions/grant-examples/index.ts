// Supabase Edge Function: grant-examples
// GET list, POST create, PUT update, DELETE — all for GrantExample table.
// Replaces Next.js /api/grants/examples and /api/grants/examples/[id].
// Pass ?id=UUID for single-item operations (PUT, DELETE, GET single).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_COMPANY_ID = "demo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

const STRING_FIELDS = ["title", "grantName", "funder", "amount", "outcome", "section", "content", "notes"];

function cleanExampleData(body: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) {
    if (k in body) clean[k] = typeof body[k] === "string" ? body[k] : "";
  }
  if ("tags" in body) {
    clean.tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];
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
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // GET — list all or get single
    if (req.method === "GET") {
      if (id) {
        const { data, error } = await db
          .from("GrantExample")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Not found" }, 404);
        return json({ example: data });
      }
      const { data, error } = await db
        .from("GrantExample")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("updatedAt", { ascending: false });
      if (error) throw error;
      return json({ examples: data ?? [] });
    }

    // POST — create
    if (req.method === "POST") {
      const body = await req.json();
      const data = cleanExampleData(body);
      if (!data.content || (data.content as string).trim().length === 0) {
        return json({ error: "Content is required" }, 400);
      }
      if (!data.title || (data.title as string).trim().length === 0) {
        data.title = (data.content as string).trim().replace(/\s+/g, " ").slice(0, 60);
      }
      const { data: example, error } = await db
        .from("GrantExample")
        .insert({ ...data, companyId: DEMO_COMPANY_ID })
        .select()
        .single();
      if (error) throw error;
      return json({ success: true, example });
    }

    // PUT — update by ?id=
    if (req.method === "PUT") {
      if (!id) return json({ error: "Missing ?id= param" }, 400);
      const body = await req.json();
      const data = cleanExampleData(body);
      if (Object.keys(data).length === 0) return json({ error: "No valid fields" }, 400);
      const { data: example, error } = await db
        .from("GrantExample")
        .update({ ...data, updatedAt: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json({ success: true, example });
    }

    // DELETE — delete by ?id=
    if (req.method === "DELETE") {
      if (!id) return json({ error: "Missing ?id= param" }, 400);
      const { error } = await db.from("GrantExample").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("grant-examples error:", err);
    return json({ error: String(err) }, 500);
  }
});
