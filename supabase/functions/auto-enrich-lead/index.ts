// Supabase Edge Function: auto-enrich-lead
// Self-contained — calls OpenAI directly, updates Lead via Supabase REST API.
// Triggered by INSERT on Lead table (for director/hospital/manual sources).
// No dependency on Next.js app / Vercel.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const ENRICH_MODEL = "gpt-4o-mini";
const AI_ENRICH_SOURCES = new Set(["residency_director", "hospital", "manual"]);

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

// ── Supabase REST helper ─────────────────────────────────────────────────────

async function supabaseFetch(path: string, opts: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
}

// ── Mark enrichment status ───────────────────────────────────────────────────

async function setEnrichmentStatus(id: string, status: string) {
  await supabaseFetch(`Lead?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ enrichmentStatus: status, updatedAt: new Date().toISOString() }),
  });
}

// ── Fetch full lead record ───────────────────────────────────────────────────

async function fetchLead(id: string): Promise<Record<string, unknown> | null> {
  const res = await supabaseFetch(`Lead?id=eq.${id}&select=*`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

// ── Deep AI enrichment via OpenAI ────────────────────────────────────────────

async function deepAIEnrich(lead: Record<string, unknown>): Promise<{
  updates: Record<string, unknown>;
  error?: string;
}> {
  const fullName = (lead.fullName as string) ?? "";
  const company  = (lead.company as string) ?? "";
  const jobTitle = (lead.jobTitle as string) ?? "";
  const city     = (lead.city as string) ?? "";
  const state    = (lead.state as string) ?? "";
  const country  = (lead.country as string) ?? "United States";
  const website  = (lead.website as string) ?? "";
  const email    = (lead.email as string) ?? "";
  const phone    = (lead.phone as string) ?? "";
  const notes    = (lead.notes as string) ?? "";
  const linkedin = (lead.linkedinUrl as string) ?? "";

  if (!fullName && !company) return { updates: {}, error: "No name or company to research" };

  const systemPrompt = `You are an elite medical professional research analyst with expertise in US healthcare, academic medicine, and residency programs.

Your mission: Given a person's name and available context, perform DEEP research to find everything possible about this individual.

RESEARCH METHODOLOGY:

1. **IDENTITY VERIFICATION** — Confirm the person exists at the stated institution.
2. **CONTACT INFORMATION** (highest priority)
   - Email: Deduce institutional email from the hospital's email domain pattern
   - Phone: Department phone, direct line, or office number
3. **PROFESSIONAL PROFILE** — Full credentials, board certifications, medical school, residency, fellowship, academic rank.
4. **LINKEDIN & WEB PRESENCE** — LinkedIn URL, Doximity, faculty page, ResearchGate.
5. **PROGRAM DETAILS** (for residency program directors) — Program name, ACGME ID, positions, type.
6. **RESEARCH & PUBLICATIONS** — Key research interests, notable publications topics, society roles.
7. **SPECIALTIES & INTERESTS** — Clinical specialties, teaching interests, administrative roles.

Return ONLY valid JSON:
{
  "fullName": "Full Name with credentials" or null,
  "firstName": "First" or null,
  "lastName": "Last" or null,
  "email": "verified institutional email" or null,
  "phone": "office/department phone" or null,
  "gender": "Male" | "Female" or null,
  "jobTitle": "Complete title" or null,
  "company": "Full institution name" or null,
  "industry": "Healthcare / Academic Medicine / etc." or null,
  "location": "Full address if known" or null,
  "city": "city" or null,
  "state": "state" or null,
  "country": "country" or null,
  "linkedinUrl": "https://linkedin.com/in/..." or null,
  "profileUrl": "faculty page or Doximity URL" or null,
  "website": "department or institution URL" or null,
  "specialties": ["specialty1", "specialty2"] or [],
  "notes": "Comprehensive profile summary",
  "rating": 1-5 based on data completeness,
  "confidence": "high" | "medium" | "low",
  "dataPoints": number of distinct facts found
}

CRITICAL: Do NOT fabricate emails or LinkedIn URLs. Only provide if confident.`;

  const userPrompt = `DEEP ENRICH this person:

Name: ${fullName}
Job Title: ${jobTitle}
Institution: ${company}
Location: ${[city, state, country].filter(Boolean).join(", ") || "unknown"}
Website: ${website || "unknown"}
Current Email: ${email || "unknown"}
Current Phone: ${phone || "unknown"}
Current LinkedIn: ${linkedin || "unknown"}
Existing Notes: ${notes || "none"}

Search thoroughly. Find everything you can about this person in academic medicine / healthcare.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ENRICH_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.15,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { updates: {}, error: `OpenAI error: ${res.status} ${errText.slice(0, 200)}` };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { updates: {}, error: "AI returned invalid JSON" };
  }

  // Build updates — only overwrite empty fields, always overwrite notes/specialties/rating
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const fieldMap = [
    "fullName", "firstName", "lastName", "email", "phone", "gender", "jobTitle", "company",
    "industry", "location", "city", "state", "country", "linkedinUrl", "profileUrl", "website",
  ] as const;
  for (const f of fieldMap) {
    const newVal = parsed[f];
    const oldVal = lead[f];
    if (newVal && newVal !== null && newVal !== "") {
      if (!oldVal || oldVal === "" || oldVal === null) {
        updates[f] = newVal;
      }
    }
  }
  // Always update these enrichment fields
  if (parsed.specialties && Array.isArray(parsed.specialties) && parsed.specialties.length > 0) {
    updates.specialties = parsed.specialties;
  }
  if (parsed.notes && typeof parsed.notes === "string" && parsed.notes.length > 10) {
    updates.notes = String(parsed.notes);
  }
  if (typeof parsed.rating === "number" && parsed.rating >= 1 && parsed.rating <= 5) {
    updates.rating = parsed.rating;
  }
  // Store full AI result as rawData for reference
  updates.rawData = parsed;

  return { updates };
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { "Content-Type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY");
      return new Response(JSON.stringify({ error: "Misconfigured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const payload: WebhookPayload = await req.json();

    // Validate webhook payload shape (basic protection for --no-verify-jwt)
    if (!payload?.type || !payload?.table || !payload?.record) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    if (payload.type !== "INSERT") {
      return new Response(JSON.stringify({ skipped: true, reason: "Not INSERT" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const id = payload.record?.id as string;
    const source = payload.record?.source as string;

    if (!id) {
      return new Response(JSON.stringify({ error: "No ID" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Only enrich director/hospital/manual leads — scraped leads already have data
    if (!AI_ENRICH_SOURCES.has(source)) {
      console.log(`Skipping enrich for ${id} — source=${source} (scraped data sufficient)`);
      return new Response(JSON.stringify({ skipped: true, reason: `Source ${source} not AI-enrichable` }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Auto-enriching lead: ${id} (${payload.record?.fullName}, source=${source})`);

    // Mark as processing
    await setEnrichmentStatus(id, "processing");

    // Fetch full lead record from DB
    const lead = await fetchLead(id);
    if (!lead) {
      await setEnrichmentStatus(id, "failed");
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Deep AI enrichment
    const { updates, error: enrichErr } = await deepAIEnrich(lead);

    if (enrichErr) {
      console.error(`Enrich failed for lead ${id}: ${enrichErr}`);
      await setEnrichmentStatus(id, "failed");
      return new Response(JSON.stringify({ success: false, id, error: enrichErr }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    if (Object.keys(updates).length <= 1) { // only updatedAt
      console.log(`No new data found for lead ${id}`);
      await setEnrichmentStatus(id, "done");
      return new Response(JSON.stringify({ success: true, id, updated: false, reason: "No new data" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Update the lead with enriched data
    updates.enrichmentStatus = "done";
    const updateRes = await supabaseFetch(`Lead?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(updates),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error(`DB update failed for lead ${id}: ${errText}`);
      await setEnrichmentStatus(id, "failed");
      return new Response(JSON.stringify({ success: false, id, error: "DB update failed" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const fieldCount = Object.keys(updates).length - 2; // minus updatedAt and enrichmentStatus
    console.log(`Lead ${id} enriched successfully: ${fieldCount} fields updated`);

    return new Response(JSON.stringify({ success: true, id, updated: true, fieldsUpdated: fieldCount }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-enrich-lead error:", err);

    // Try to mark as failed
    try {
      const body = await req.clone().text().catch(() => "");
      const parsed = body ? JSON.parse(body) : null;
      if (parsed?.record?.id) {
        await setEnrichmentStatus(parsed.record.id, "failed");
      }
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
