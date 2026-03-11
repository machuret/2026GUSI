// Supabase Edge Function: re-analyse-on-profile-change
// Triggered by a database webhook on UPDATE to the GrantProfile table.
// Fetches all active (non-expired) grants for the company and re-runs fit analysis.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const APP_URL = Deno.env.get("APP_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

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
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!APP_URL || !SERVICE_ROLE_KEY || !SUPABASE_URL) {
      console.error("Missing APP_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY env vars");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: WebhookPayload = await req.json();

    if (payload.type !== "UPDATE") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not an UPDATE" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const companyId = payload.record?.companyId as string;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No companyId in payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Profile updated for company ${companyId} — fetching active grants to re-analyse`);

    // Fetch all active (non-expired) grants for this company
    const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const grantsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/Grant?companyId=eq.${companyId}&select=id,name,deadlineDate&or=(deadlineDate.is.null,deadlineDate.gte.${now})`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!grantsRes.ok) {
      const errText = await grantsRes.text();
      console.error("Failed to fetch grants:", errText);
      return new Response(JSON.stringify({ error: "Failed to fetch grants" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const grants: { id: string; name: string; deadlineDate: string | null }[] = await grantsRes.json();

    if (grants.length === 0) {
      console.log("No active grants to re-analyse");
      return new Response(JSON.stringify({ success: true, reanalysed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Re-analysing ${grants.length} active grants...`);

    let ok = 0;
    let errors = 0;

    for (const grant of grants) {
      try {
        const res = await fetch(`${APP_URL}/api/grants/analyse`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ grantId: grant.id }),
        });

        if (res.ok) {
          ok++;
          console.log(`  ✓ ${grant.name} (${grant.id})`);
        } else {
          errors++;
          const data = await res.json().catch(() => ({}));
          console.error(`  ✗ ${grant.name}: ${data.error ?? res.status}`);
        }
      } catch (err) {
        errors++;
        console.error(`  ✗ ${grant.name}: ${err}`);
      }
    }

    console.log(`Re-analysis complete: ${ok} succeeded, ${errors} failed out of ${grants.length}`);

    return new Response(
      JSON.stringify({ success: true, total: grants.length, reanalysed: ok, errors }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("re-analyse-on-profile-change error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
