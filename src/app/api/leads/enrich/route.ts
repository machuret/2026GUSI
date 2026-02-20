export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalise } from "@/lib/leadNormalisers";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { getEnv } from "@/lib/env";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const APIFY_BASE = "https://api.apify.com/v2";

// Source → actor ID mapping (mirrors leadSources.ts)
const SOURCE_ACTORS: Record<string, string> = {
  webmd:    "easyapi/webmd-doctor-scraper",
  doctolib: "giovannibiancia/doctolib-scraper",
  linkedin: "od6RadQV98FOARtrp",
};

async function pollUntilDone(runId: string, token: string, maxWaitMs = 55000): Promise<string> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    if (!res.ok) throw new Error("Failed to poll run status");
    const data = await res.json();
    const status: string = data.data?.status ?? "UNKNOWN";
    if (status === "SUCCEEDED") return data.data?.defaultDatasetId ?? "";
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) throw new Error(`Apify run ${status}`);
  }
  throw new Error("Enrichment timed out — run is still in progress");
}

// POST /api/leads/enrich
// Body: { leadIds: string[] }
// Re-fetches each lead's profile URL via its source actor and merges new data.
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { APIFY_API_TOKEN } = getEnv();
    if (!APIFY_API_TOKEN) {
      return NextResponse.json({ error: "Apify token not configured" }, { status: 500 });
    }

    const body = await req.json();
    const leadIds: string[] = Array.isArray(body.leadIds) ? body.leadIds : [];
    if (leadIds.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }
    if (leadIds.length > 50) {
      return NextResponse.json({ error: "Max 50 leads per enrichment batch" }, { status: 400 });
    }

    // Fetch the leads from DB
    const { data: leads, error: fetchErr } = await db
      .from("Lead")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .in("id", leadIds);

    if (fetchErr) throw fetchErr;
    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: "No matching leads found" }, { status: 404 });
    }

    const enriched: { id: string; updated: boolean; error?: string }[] = [];

    // Group leads by source so we can batch per actor
    const bySource: Record<string, typeof leads> = {};
    for (const lead of leads) {
      const src = lead.source as string;
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push(lead);
    }

    for (const [source, group] of Object.entries(bySource)) {
      const actorId = SOURCE_ACTORS[source];
      if (!actorId) {
        // Can't re-enrich manual leads via Apify
        for (const l of group) enriched.push({ id: l.id, updated: false, error: `No actor for source "${source}"` });
        continue;
      }

      // Build per-source input using profile URLs
      let actorInput: Record<string, unknown>;
      if (source === "webmd") {
        const urls = group.map((l) => l.profileUrl).filter(Boolean);
        if (urls.length === 0) {
          for (const l of group) enriched.push({ id: l.id, updated: false, error: "No profile URL" });
          continue;
        }
        actorInput = {
          searchUrls: urls,
          maxItems: urls.length * 2,
          proxyConfiguration: { useApifyProxy: true },
        };
      } else if (source === "doctolib") {
        const urls = group.map((l) => l.profileUrl).filter(Boolean);
        actorInput = { startUrls: urls.map((u) => ({ url: u })), maxItems: urls.length * 2, nation: "fr" };
      } else if (source === "linkedin") {
        const urls = group.map((l) => l.linkedinUrl ?? l.profileUrl).filter(Boolean);
        actorInput = { action: "get-profiles", keywords: urls, isUrl: true, isName: false, limit: urls.length };
      } else {
        for (const l of group) enriched.push({ id: l.id, updated: false, error: `Unsupported source "${source}"` });
        continue;
      }

      // Start Apify run
      let runId: string;
      let datasetId: string;
      try {
        const runRes = await fetch(
          `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_API_TOKEN}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(actorInput) }
        );
        if (!runRes.ok) throw new Error(`Apify start failed: ${await runRes.text()}`);
        const runData = await runRes.json();
        runId = runData.data?.id;
        datasetId = runData.data?.defaultDatasetId;
        if (!runId) throw new Error("No run ID returned");
      } catch (err) {
        for (const l of group) enriched.push({ id: l.id, updated: false, error: err instanceof Error ? err.message : "Start failed" });
        continue;
      }

      // Poll until done (max ~55s)
      try {
        datasetId = await pollUntilDone(runId, APIFY_API_TOKEN) || datasetId;
      } catch (err) {
        for (const l of group) enriched.push({ id: l.id, updated: false, error: err instanceof Error ? err.message : "Poll failed" });
        continue;
      }

      // Fetch results
      const dataRes = await fetch(
        `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&clean=true&format=json`
      );
      if (!dataRes.ok) {
        for (const l of group) enriched.push({ id: l.id, updated: false, error: "Failed to fetch dataset" });
        continue;
      }
      const rawItems: Record<string, unknown>[] = await dataRes.json();

      // Match results back to leads by profile URL or name
      for (const lead of group) {
        const profileUrl = (lead.profileUrl as string) ?? "";
        const fullName   = ((lead.fullName as string) ?? "").toLowerCase();

        const match = rawItems.find((item) => {
          const itemUrl  = (item.profileUrl as string) ?? ((item.urls as Record<string,string>)?.profile ?? "");
          const itemName = ((item.name as Record<string,string>)?.full ?? (item.fullName as string) ?? "").toLowerCase();
          return (profileUrl && itemUrl && itemUrl.includes(profileUrl.split("/").pop() ?? "___"))
            || (fullName && itemName && itemName === fullName);
        }) ?? rawItems[0]; // fallback: take first result if only one lead in group

        if (!match) {
          enriched.push({ id: lead.id, updated: false, error: "No matching result found" });
          continue;
        }

        const normalised = normalise(source, match);
        // Strip source/rawData — keep existing values for fields that come back empty
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString(), rawData: match };
        const fields = ["fullName","firstName","lastName","email","phone","gender","jobTitle","company",
          "industry","location","city","state","country","linkedinUrl","profileUrl","website","specialties","notes","rating"] as const;
        for (const f of fields) {
          const v = normalised[f];
          if (v !== undefined && v !== null && v !== "") updates[f] = v;
        }

        const { error: updateErr } = await db.from("Lead").update(updates).eq("id", lead.id);
        enriched.push({ id: lead.id, updated: !updateErr, error: updateErr?.message });
      }
    }

    const updatedCount = enriched.filter((e) => e.updated).length;
    return NextResponse.json({ success: true, enriched, updatedCount, total: leads.length });
  } catch (err) {
    return handleApiError(err, "Enrich Leads");
  }
}
