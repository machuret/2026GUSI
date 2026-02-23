export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalise } from "@/lib/leadNormalisers";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { getEnv } from "@/lib/env";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";

const APIFY_BASE = "https://api.apify.com/v2";

// Source → actor ID mapping (mirrors leadSources.ts)
const SOURCE_ACTORS: Record<string, string> = {
  webmd:    "easyapi/webmd-doctor-scraper",
  doctolib: "giovannibiancia/doctolib-scraper",
  linkedin: "od6RadQV98FOARtrp",
};

// Sources that should use the deep OpenAI enricher instead of Apify
const AI_ENRICH_SOURCES = new Set(["residency_director", "hospital", "manual"]);

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

// ── Deep AI Enrichment (OpenAI) ─────────────────────────────────────────────
// Used for residency_director, hospital, and manual leads that don't have Apify actors
async function deepAIEnrich(
  lead: Record<string, unknown>,
  userId?: string,
): Promise<{ updates: Record<string, unknown>; error?: string }> {
  const fullName  = (lead.fullName as string) ?? "";
  const company   = (lead.company as string) ?? "";
  const jobTitle  = (lead.jobTitle as string) ?? "";
  const city      = (lead.city as string) ?? "";
  const state     = (lead.state as string) ?? "";
  const country   = (lead.country as string) ?? "United States";
  const website   = (lead.website as string) ?? "";
  const email     = (lead.email as string) ?? "";
  const phone     = (lead.phone as string) ?? "";
  const notes     = (lead.notes as string) ?? "";
  const linkedin  = (lead.linkedinUrl as string) ?? "";

  if (!fullName && !company) return { updates: {}, error: "No name or company to research" };

  const systemPrompt = `You are an elite medical professional research analyst with expertise in US healthcare, academic medicine, and residency programs.

Your mission: Given a person's name and available context, perform DEEP research to find everything possible about this individual. Think like an investigative researcher — cross-reference multiple data points to build a comprehensive profile.

RESEARCH METHODOLOGY — follow this step by step:

1. **IDENTITY VERIFICATION**
   - Confirm the person exists at the stated institution
   - Cross-reference name + institution + specialty to ensure correct match
   - Note any name variations (e.g., middle initial, credentials listed differently)

2. **CONTACT INFORMATION** (highest priority)
   - Email: Deduce institutional email from the hospital's email domain pattern
     Common patterns: firstname.lastname@hospital.edu, flastname@hospital.org, first.last@healthsystem.edu
     Look at the hospital website domain to infer the email domain
   - Phone: Department phone, direct line, or office number
   - Fax: Academic department fax if available

3. **PROFESSIONAL PROFILE**
   - Full credentials (MD, DO, PhD, MBA, MPH, FACP, FACEP, etc.)
   - Board certifications
   - Medical school and graduation year
   - Residency training location and year
   - Fellowship training if applicable
   - Current academic rank (Assistant/Associate/Full Professor)

4. **LINKEDIN & WEB PRESENCE**
   - LinkedIn URL: Search pattern "firstname lastname MD [institution] site:linkedin.com"
   - Doximity profile URL
   - Hospital/department faculty page URL
   - ResearchGate or Google Scholar profile

5. **PROGRAM DETAILS** (for residency program directors)
   - Program name and ACGME ID
   - Number of residency positions
   - Program type (categorical, preliminary, combined)
   - Associated medical school affiliation

6. **RESEARCH & PUBLICATIONS**
   - Key research interests / focus areas
   - Notable publications (just topics, not full citations)
   - Any leadership roles in professional societies

7. **SPECIALTIES & INTERESTS**
   - Clinical specialties
   - Teaching interests
   - Administrative roles

Return ONLY valid JSON:
{
  "fullName": "Full Name with all credentials (e.g., John Smith, MD, FACP)" or null,
  "firstName": "First" or null,
  "lastName": "Last" or null,
  "email": "verified institutional email" or null,
  "phone": "office/department phone" or null,
  "gender": "Male" | "Female" or null,
  "jobTitle": "Complete title including all roles" or null,
  "company": "Full institution name" or null,
  "industry": "Healthcare / Academic Medicine / etc." or null,
  "location": "Full address if known" or null,
  "city": "city" or null,
  "state": "state" or null,
  "country": "country" or null,
  "linkedinUrl": "https://linkedin.com/in/..." or null,
  "profileUrl": "faculty page or Doximity URL" or null,
  "website": "department or institution URL" or null,
  "specialties": ["specialty1", "specialty2", ...] or [],
  "notes": "Comprehensive profile summary: credentials, education, training, research interests, program details, board certs, academic rank, society memberships. Be thorough — include everything relevant.",
  "rating": 1-5 based on data completeness (5 = very complete, 1 = minimal data found),
  "confidence": "high" | "medium" | "low",
  "dataPoints": number of distinct facts found
}

CRITICAL RULES:
- Do NOT fabricate emails. Only provide an email if you can deduce it from a known institutional domain pattern.
- Do NOT invent LinkedIn URLs. Only provide if you're confident the profile exists.
- Be thorough in the notes field — this is the most valuable part. Include education, training timeline, research areas, publications topics, society memberships, administrative roles.
- Rate confidence based on how much you actually know vs. inferred.`;

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

  try {
    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.generate,
      maxTokens: 2000,
      temperature: 0.15,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.generate,
      feature: "leads.deepEnrich",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(aiResult.content);
    } catch {
      return { updates: {}, error: "AI returned invalid JSON" };
    }

    // Build updates — only overwrite empty fields, always overwrite notes/specialties/rating
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const fieldMap = [
      "fullName","firstName","lastName","email","phone","gender","jobTitle","company",
      "industry","location","city","state","country","linkedinUrl","profileUrl","website",
    ] as const;
    for (const f of fieldMap) {
      const newVal = parsed[f];
      const oldVal = lead[f];
      // Only fill empty fields for basic contact info, but always update if AI has better data
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
  } catch (err) {
    return { updates: {}, error: err instanceof Error ? err.message : "AI enrichment failed" };
  }
}

// POST /api/leads/enrich
// Body: { leadIds: string[] }
// Re-fetches each lead's profile URL via its source actor (Apify) or deep AI enrichment (OpenAI).
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

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

    // Separate leads into AI-enrichable and Apify-enrichable
    const aiLeads: typeof leads = [];
    const apifyBySource: Record<string, typeof leads> = {};
    for (const lead of leads) {
      const src = lead.source as string;
      if (AI_ENRICH_SOURCES.has(src)) {
        aiLeads.push(lead);
      } else {
        if (!apifyBySource[src]) apifyBySource[src] = [];
        apifyBySource[src].push(lead);
      }
    }

    // ── Deep AI enrichment for residency_director / hospital / manual leads ──
    for (const lead of aiLeads) {
      const { updates, error: aiErr } = await deepAIEnrich(lead, authUser?.id);
      if (aiErr) {
        enriched.push({ id: lead.id, updated: false, error: aiErr });
        continue;
      }
      if (Object.keys(updates).length <= 1) { // only updatedAt
        enriched.push({ id: lead.id, updated: false, error: "No new data found" });
        continue;
      }
      const { error: updateErr } = await db.from("Lead").update(updates).eq("id", lead.id);
      enriched.push({ id: lead.id, updated: !updateErr, error: updateErr?.message });
    }

    // ── Apify enrichment for linkedin/webmd/doctolib leads ──
    const { APIFY_API_TOKEN } = getEnv();

    for (const [source, group] of Object.entries(apifyBySource)) {
      const actorId = SOURCE_ACTORS[source];
      if (!actorId) {
        for (const l of group) enriched.push({ id: l.id, updated: false, error: `No actor for source "${source}"` });
        continue;
      }

      if (!APIFY_API_TOKEN) {
        for (const l of group) enriched.push({ id: l.id, updated: false, error: "Apify token not configured" });
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
