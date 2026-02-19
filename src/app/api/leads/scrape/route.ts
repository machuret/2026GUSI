export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { SCRAPE_SOURCES } from "@/lib/leadSources";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const APIFY_BASE = "https://api.apify.com/v2";

// ─── Normalise raw Apify results into Lead shape ───────────────────────────────
function normaliseLinkedIn(item: Record<string, unknown>) {
  return {
    source: "linkedin",
    fullName: (item.fullName ?? item.name ?? "") as string,
    firstName: (item.firstName ?? "") as string,
    lastName: (item.lastName ?? "") as string,
    jobTitle: (item.headline ?? item.jobTitle ?? "") as string,
    company: (item.currentCompany ?? item.company ?? "") as string,
    location: (item.location ?? "") as string,
    linkedinUrl: (item.profileUrl ?? item.url ?? "") as string,
    profileUrl: (item.profileUrl ?? item.url ?? "") as string,
    rawData: item,
  };
}

function normaliseDoctolib(item: Record<string, unknown>) {
  const name = (item.name ?? item.fullName ?? "") as string;
  const parts = name.split(" ");
  return {
    source: "doctolib",
    fullName: name,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    jobTitle: (item.specialty ?? item.speciality ?? "") as string,
    company: (item.practiceName ?? item.clinic ?? "") as string,
    location: (item.address ?? item.location ?? "") as string,
    city: (item.city ?? "") as string,
    country: "France",
    profileUrl: (item.url ?? item.profileUrl ?? "") as string,
    specialties: Array.isArray(item.specialties) ? item.specialties as string[] : [],
    rawData: item,
  };
}

function normaliseWebMD(item: Record<string, unknown>) {
  const nameObj = item.name as Record<string, string> | undefined;
  const locationObj = item.location as Record<string, string> | undefined;
  const urlsObj = item.urls as Record<string, string> | undefined;
  return {
    source: "webmd",
    fullName: nameObj?.full ?? "",
    firstName: nameObj?.first ?? "",
    lastName: nameObj?.last ?? "",
    gender: (item.gender ?? "") as string,
    jobTitle: Array.isArray(item.specialties) ? (item.specialties as string[])[0] ?? "" : "",
    specialties: Array.isArray(item.specialties) ? item.specialties as string[] : [],
    company: locationObj?.name ?? "",
    location: locationObj ? `${locationObj.address ?? ""}, ${locationObj.city ?? ""}, ${locationObj.state ?? ""}`.trim().replace(/^,\s*/, "") : "",
    city: locationObj?.city ?? "",
    state: locationObj?.state ?? "",
    country: "United States",
    profileUrl: urlsObj?.profile ?? "",
    website: urlsObj?.website ?? "",
    rawData: item,
  };
}

function normalise(sourceId: string, item: Record<string, unknown>) {
  switch (sourceId) {
    case "linkedin": return normaliseLinkedIn(item);
    case "doctolib": return normaliseDoctolib(item);
    case "webmd":    return normaliseWebMD(item);
    default:         return { source: sourceId, fullName: "", rawData: item };
  }
}

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
