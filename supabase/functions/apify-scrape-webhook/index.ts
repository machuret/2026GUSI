// Supabase Edge Function: apify-scrape-webhook
// Called by Apify when an actor run completes (via webhook config).
// Fetches the dataset, normalises leads, bulk-inserts into Lead table.
// DB INSERT triggers then fire auto-enrich-lead and auto-qualify-lead.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const APIFY_BASE = "https://api.apify.com/v2";

// ── Inline normalisers (mirrors src/lib/leadNormalisers.ts) ─────────────────

type NormalisedLead = Record<string, unknown>;

function normaliseLinkedIn(item: Record<string, unknown>): NormalisedLead {
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
  };
}

function normaliseDoctolib(item: Record<string, unknown>): NormalisedLead {
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
  };
}

function normaliseWebMD(item: Record<string, unknown>): NormalisedLead {
  const nameObj = (typeof item.name === "object" && item.name !== null) ? item.name as Record<string, string> : undefined;
  const locationObj = (typeof item.location === "object" && item.location !== null) ? item.location as Record<string, unknown> : undefined;
  const urlsObj = (typeof item.urls === "object" && item.urls !== null) ? item.urls as Record<string, string> : undefined;
  const ratingsObj = (typeof item.ratings === "object" && item.ratings !== null) ? item.ratings as Record<string, unknown> : undefined;

  const fullName = nameObj?.full ?? (item.fullName as string) ?? "";
  const firstName = nameObj?.first ?? (item.firstName as string) ?? "";
  const lastName = nameObj?.last ?? (item.lastName as string) ?? "";
  const specialties: string[] = Array.isArray(item.specialties) ? item.specialties as string[] : typeof item.specialty === "string" ? [item.specialty] : [];
  const company = (locationObj?.name as string) ?? (item.company as string) ?? "";
  const city = (locationObj?.city as string) ?? (item.city as string) ?? "";
  const state = (locationObj?.state as string) ?? (item.state as string) ?? "";
  const addr = (locationObj?.address as string) ?? (item.address as string) ?? "";
  const zipcode = (locationObj?.zipcode as string) ?? "";
  const rawLocation = [addr, city, state, zipcode].filter(Boolean).join(", ");
  const rating = typeof ratingsObj?.averageRating === "number" ? ratingsObj.averageRating as number : null;
  const email = (item.email as string) ?? "";
  const genderRaw = (item.gender as string) ?? "";
  const gender = genderRaw === "M" ? "Male" : genderRaw === "F" ? "Female" : genderRaw;
  const bioRaw = (item.bio as string) ?? "";
  const notes = bioRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) || undefined;

  return {
    source: "webmd",
    fullName, firstName, lastName, email, gender,
    jobTitle: specialties[0] ?? "",
    specialties, company,
    location: rawLocation, city, state, country: "United States",
    profileUrl: urlsObj?.profile ?? (item.profileUrl as string) ?? "",
    website: urlsObj?.website ?? "",
    rating, notes,
  };
}

function normalise(sourceId: string, item: Record<string, unknown>): NormalisedLead {
  switch (sourceId) {
    case "linkedin": return normaliseLinkedIn(item);
    case "doctolib": return normaliseDoctolib(item);
    case "webmd":    return normaliseWebMD(item);
    default:         return { source: sourceId, fullName: "", rawData: item };
  }
}

// Map Apify actor IDs back to our source IDs
const ACTOR_TO_SOURCE: Record<string, string> = {
  "od6RadQV98FOARtrp": "linkedin",
  "giovannibiancia/doctolib-scraper": "doctolib",
  "easyapi/webmd-doctor-scraper": "webmd",
};

// ── Webhook handler ─────────────────────────────────────────────────────────

interface ApifyWebhookPayload {
  eventType: string;
  resource: {
    id: string;
    actId: string;
    defaultDatasetId: string;
    status: string;
  };
  // Our custom fields from payloadTemplate
  sourceId?: string;
  companyId?: string;
  apifyToken?: string;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { "Content-Type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Misconfigured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const payload: ApifyWebhookPayload = await req.json();
    console.log("Apify webhook received:", JSON.stringify(payload).slice(0, 500));

    const datasetId = payload.resource?.defaultDatasetId;
    const apifyToken = payload.apifyToken;
    const companyId = payload.companyId;

    if (!datasetId || !apifyToken) {
      return new Response(JSON.stringify({ error: "Missing datasetId or apifyToken" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Determine source from actId or explicit sourceId
    const sourceId = payload.sourceId
      ?? ACTOR_TO_SOURCE[payload.resource?.actId ?? ""]
      ?? "unknown";

    // Fetch results from Apify dataset
    const dataRes = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken}&clean=true&format=json`
    );
    if (!dataRes.ok) {
      const err = await dataRes.text();
      console.error("Failed to fetch Apify dataset:", err);
      return new Response(JSON.stringify({ error: "Failed to fetch dataset" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const rawItems: Record<string, unknown>[] = await dataRes.json();
    console.log(`Fetched ${rawItems.length} items from dataset ${datasetId}`);

    if (rawItems.length === 0) {
      return new Response(JSON.stringify({ success: true, imported: 0, message: "No items in dataset" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Normalise
    const leads = rawItems.map((item) => {
      const normalised = normalise(sourceId, item);
      return {
        ...normalised,
        companyId: companyId ?? null,
        status: "new",
        rawData: item,
        updatedAt: new Date().toISOString(),
      };
    }).filter((l) => {
      const name = (l.fullName as string) ?? "";
      return name.trim().length > 0;
    });

    if (leads.length === 0) {
      return new Response(JSON.stringify({ success: true, imported: 0, message: "No valid leads after normalisation" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Dedup: fetch existing fullName+source pairs
    let existingSet = new Set<string>();
    if (companyId) {
      const dedupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/Lead?companyId=eq.${companyId}&source=eq.${sourceId}&select=fullName,source`,
        {
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (dedupRes.ok) {
        const existing: { fullName: string | null; source: string }[] = await dedupRes.json();
        existingSet = new Set(
          existing.map((l) => `${(l.fullName ?? "").toLowerCase().trim()}|||${l.source}`)
        );
      }
    }

    const unique = leads.filter((l) => {
      const key = `${((l.fullName as string) ?? "").toLowerCase().trim()}|||${l.source}`;
      if (existingSet.has(key)) return false;
      existingSet.add(key);
      return true;
    });

    if (unique.length === 0) {
      console.log("All leads already exist — skipped");
      return new Response(JSON.stringify({ success: true, imported: 0, skipped: leads.length }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Bulk insert via Supabase REST
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/Lead`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(unique),
      }
    );

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error("Failed to insert leads:", err);
      return new Response(JSON.stringify({ error: "Insert failed", details: err }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const inserted = await insertRes.json();
    const count = Array.isArray(inserted) ? inserted.length : 0;
    console.log(`Imported ${count} leads (${leads.length - unique.length} duplicates skipped)`);

    return new Response(JSON.stringify({
      success: true,
      imported: count,
      skipped: leads.length - unique.length,
      sourceId,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("apify-scrape-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
