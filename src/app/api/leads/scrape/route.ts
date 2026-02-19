export const runtime = 'nodejs';
export const maxDuration = 120; // 2 min — Apify actors can be slow
import { NextRequest, NextResponse } from "next/server";
import { SCRAPE_SOURCES } from "@/lib/leadSources";
import { normalise } from "@/lib/leadNormalisers";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const APIFY_BASE = "https://api.apify.com/v2";

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { sourceId, inputFields } = await req.json();

    const source = SCRAPE_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: `Unknown source: ${sourceId}` }, { status: 400 });
    }

    const actorInput = source.buildInput(inputFields ?? {});

    // 1. Start the Apify actor run
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(source.actorId)}/runs?token=${APIFY_TOKEN}`,
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

    // 2. Poll for completion (max 90s, 3s intervals)
    let status = "RUNNING";
    let attempts = 0;
    while (status === "RUNNING" || status === "READY" || status === "CREATED") {
      if (attempts++ > 30) {
        return NextResponse.json({
          error: "Apify run timed out after 90s. Try with fewer results.",
          runId,
          datasetId,
          timedOut: true,
        }, { status: 202 });
      }
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      const statusData = await statusRes.json();
      status = statusData.data?.status ?? "FAILED";
    }

    if (status !== "SUCCEEDED") {
      return NextResponse.json({ error: `Apify run ${status}`, runId }, { status: 500 });
    }

    // 3. Fetch dataset results
    const dataRes = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json`
    );
    const rawItems: Record<string, unknown>[] = await dataRes.json();

    // 4. Normalise into Lead shape
    const leads = rawItems.map((item) => normalise(sourceId, item));

    return NextResponse.json({
      success: true,
      leads,
      total: leads.length,
      runId,
      sourceId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

// GET — return source definitions for the UI
export async function GET() {
  return NextResponse.json({ sources: SCRAPE_SOURCES });
}
