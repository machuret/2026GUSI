export const runtime = 'nodejs';
export const maxDuration = 30; // Only needs to start the run now — no polling
import { NextRequest, NextResponse } from "next/server";
import { SCRAPE_SOURCES } from "@/lib/leadSources";
import { normalise } from "@/lib/leadNormalisers";
import { requireAuth } from "@/lib/apiHelpers";
import { getEnv } from "@/lib/env";

const APIFY_BASE = "https://api.apify.com/v2";

// ─── POST — start Apify run, return runId immediately ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { APIFY_API_TOKEN } = getEnv();
    if (!APIFY_API_TOKEN) return NextResponse.json({ error: "Apify token not configured" }, { status: 500 });

    const { sourceId, inputFields } = await req.json();

    const source = SCRAPE_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: `Unknown source: ${sourceId}` }, { status: 400 });
    }

    const actorInput = source.buildInput(inputFields ?? {});

    const runRes = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(source.actorId)}/runs?token=${APIFY_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actorInput),
      }
    );

    if (!runRes.ok) {
      const err = await runRes.text();
      return NextResponse.json({ error: `Apify start failed: ${err}` }, { status: 500 });
    }

    const runData = await runRes.json();
    const runId: string = runData.data?.id;
    const datasetId: string = runData.data?.defaultDatasetId;

    if (!runId) {
      return NextResponse.json({ error: "Apify did not return a run ID" }, { status: 500 });
    }

    // Return immediately — client polls GET /api/leads/scrape?runId=xxx
    return NextResponse.json({ started: true, runId, datasetId, sourceId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

// ─── GET — poll run status OR return source list ──────────────────────────────
export async function GET(req: NextRequest) {
  const { response: authError } = await requireAuth();
  if (authError) return authError;

  const runId = req.nextUrl.searchParams.get("runId");
  const datasetId = req.nextUrl.searchParams.get("datasetId");
  const sourceId = req.nextUrl.searchParams.get("sourceId");

  // No runId = return source definitions for the scraper modal
  if (!runId) {
    return NextResponse.json({ sources: SCRAPE_SOURCES });
  }

  try {
    const { APIFY_API_TOKEN } = getEnv();
    if (!APIFY_API_TOKEN) return NextResponse.json({ error: "Apify token not configured" }, { status: 500 });

    // Check run status
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
    if (!statusRes.ok) {
      return NextResponse.json({ error: "Failed to check run status" }, { status: 500 });
    }
    const statusData = await statusRes.json();
    const status: string = statusData.data?.status ?? "UNKNOWN";
    const resolvedDatasetId: string = datasetId ?? statusData.data?.defaultDatasetId ?? "";

    // Still running — client should poll again
    if (status === "RUNNING" || status === "READY" || status === "CREATED") {
      return NextResponse.json({ status, running: true, runId });
    }

    if (status !== "SUCCEEDED") {
      return NextResponse.json({ error: `Apify run ${status}`, status, runId }, { status: 500 });
    }

    // Fetch results from dataset
    const dataRes = await fetch(
      `${APIFY_BASE}/datasets/${resolvedDatasetId}/items?token=${APIFY_API_TOKEN}&clean=true&format=json`
    );
    if (!dataRes.ok) {
      return NextResponse.json({ error: "Failed to fetch dataset results" }, { status: 500 });
    }
    const rawItems: Record<string, unknown>[] = await dataRes.json();
    const leads = rawItems.map((item) => normalise(sourceId ?? "", item));

    return NextResponse.json({ status: "SUCCEEDED", running: false, leads, total: leads.length, runId, sourceId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
