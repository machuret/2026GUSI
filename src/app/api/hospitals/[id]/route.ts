export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// PATCH /api/hospitals/[id] — update hospital fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

    // Enrich via AI
    if (body.enrich === true) {
      const { data: hospital } = await db
        .from("HospitalLead")
        .select("*")
        .eq("id", params.id)
        .eq("companyId", DEMO_COMPANY_ID)
        .single();

      if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { user: authUser } = await requireAuth();

      const systemPrompt = `You are a US healthcare data researcher. Given a hospital name, state, and any existing data, provide enriched information.

Return ONLY valid JSON with these fields (only include fields you are confident about):
{
  "address": "full street address",
  "city": "city name",
  "url": "official hospital website URL",
  "phone": "main phone number",
  "type": "Academic Medical Center" | "Teaching Hospital" | "Community Hospital" | "VA Hospital" | "Private",
  "beds": number or null,
  "notes": "brief description: specialties, affiliated university, notable departments, US News ranking if applicable"
}

Be accurate — do not fabricate information.`;

      const userPrompt = `Enrich this hospital:\nName: ${hospital.name}\nState: ${hospital.state}\nExisting address: ${hospital.address || "unknown"}\nExisting URL: ${hospital.url || "unknown"}`;

      const aiResult = await callOpenAIWithUsage({
        systemPrompt,
        userPrompt,
        model: MODEL_CONFIG.generate,
        maxTokens: 500,
        temperature: 0.2,
        jsonMode: true,
      });

      logAiUsage({
        model: MODEL_CONFIG.generate,
        feature: "hospitals.enrich",
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        userId: authUser?.id,
      });

      let enriched: Record<string, unknown>;
      try {
        enriched = JSON.parse(aiResult.content);
      } catch {
        return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
      }

      const updates: Record<string, unknown> = { enriched: true, updatedAt: new Date().toISOString() };
      const fieldsUpdated: string[] = [];
      if (enriched.address && !hospital.address) { updates.address = String(enriched.address); fieldsUpdated.push("address"); }
      if (enriched.city && !hospital.city) { updates.city = String(enriched.city); fieldsUpdated.push("city"); }
      if (enriched.url && !hospital.url) { updates.url = String(enriched.url); fieldsUpdated.push("url"); }
      if (enriched.phone && !hospital.phone) { updates.phone = String(enriched.phone); fieldsUpdated.push("phone"); }
      if (enriched.type && !hospital.type) { updates.type = String(enriched.type); fieldsUpdated.push("type"); }
      if (enriched.beds && !hospital.beds) { updates.beds = Number(enriched.beds); fieldsUpdated.push("beds"); }
      if (enriched.notes) { updates.notes = String(enriched.notes); fieldsUpdated.push("notes"); }

      const { data, error } = await db
        .from("HospitalLead")
        .update(updates)
        .eq("id", params.id)
        .eq("companyId", DEMO_COMPANY_ID)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ hospital: data, fieldsUpdated });
    }

    // Find Residency Program Director via AI
    if (body.findDirector === true) {
      const { data: hospital } = await db
        .from("HospitalLead")
        .select("*")
        .eq("id", params.id)
        .eq("companyId", DEMO_COMPANY_ID)
        .single();

      if (!hospital) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { user: authUser } = await requireAuth();

      // Optional residency specialty category
      const category: string = body.residencyCategory ?? "";

      const CATEGORY_LABELS: Record<string, string> = {
        family:        "Family Medicine",
        internal:      "Internal Medicine",
        ob:            "Obstetrics & Gynecology (OB/GYN)",
        pediatrics:    "Pediatrics",
        emergency:     "Emergency Medicine",
        critical_care: "Critical Care / Pulmonary Critical Care",
      };

      const categoryLabel = CATEGORY_LABELS[category] ?? "";
      const categoryClause = categoryLabel
        ? `Specifically search for the **${categoryLabel} Residency Program Director**.`
        : "Search for the overall Residency Program Director or DIO (Designated Institutional Official).";

      const systemPrompt = `You are an expert US medical education researcher with deep knowledge of ACGME-accredited residency programs, GME leadership structures, and academic medical centers.

Your task: Given a hospital, find the Residency Program Director.
${categoryClause}

Search strategy — think step by step:
1. Identify whether this hospital has an ACGME-accredited ${categoryLabel || "residency"} program.
2. Find the Program Director's full name with credentials (MD, DO, PhD, FACP, etc.)
3. Find their institutional email — use the hospital's known email domain (e.g. @hospital.edu, @health.org). NEVER fabricate an email — if unsure, return null.
4. Find their direct phone number or department phone.
5. Determine their exact title and any additional roles (e.g. Vice Chair of Education, Associate Professor).
6. Note the program's ACGME ID if known.
7. List any associate program directors if the main PD is found.

Return ONLY valid JSON:
{
  "directorName": "Full Name, MD/DO + credentials" or null,
  "directorEmail": "email@institution.edu" or null,
  "directorPhone": "phone number" or null,
  "directorTitle": "exact title e.g. Program Director, Internal Medicine Residency" or null,
  "department": "Department of Internal Medicine" or null,
  "associateDirectors": ["Name, MD", ...] or [],
  "programId": "ACGME program ID" or null,
  "residencyCategory": "${categoryLabel || "General/DIO"}",
  "confidence": "high" | "medium" | "low",
  "source": "where this info would typically be found (e.g. department website, ACGME directory, Doximity)",
  "reasoning": "brief explanation of how you identified this person"
}

CRITICAL: Only include information you are confident about. Return null for any fields you cannot verify. Do NOT guess email addresses — institutional emails follow patterns like firstname.lastname@domain.edu.`;

      const userPrompt = `Find the ${categoryLabel || "Residency"} Program Director for:
Hospital: ${hospital.name}
City: ${hospital.city || "unknown"}, ${hospital.state}
Website: ${hospital.url || "unknown"}
Type: ${hospital.type || "unknown"}
Existing notes: ${hospital.notes || "none"}`;

      const aiResult = await callOpenAIWithUsage({
        systemPrompt,
        userPrompt,
        model: MODEL_CONFIG.generate,
        maxTokens: 1000,
        temperature: 0.2,
        jsonMode: true,
      });

      logAiUsage({
        model: MODEL_CONFIG.generate,
        feature: "hospitals.findDirector",
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        userId: authUser?.id,
      });

      let directorInfo: Record<string, unknown>;
      try {
        directorInfo = JSON.parse(aiResult.content);
      } catch {
        return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
      }

      const dirUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      const fieldsUpdated: string[] = [];
      if (directorInfo.directorName) { dirUpdates.directorName = String(directorInfo.directorName); fieldsUpdated.push("directorName"); }
      if (directorInfo.directorEmail) { dirUpdates.directorEmail = String(directorInfo.directorEmail); fieldsUpdated.push("directorEmail"); }
      if (directorInfo.directorPhone) { dirUpdates.directorPhone = String(directorInfo.directorPhone); fieldsUpdated.push("directorPhone"); }
      // Build a rich title that includes category + department
      const titleParts = [directorInfo.directorTitle, directorInfo.department].filter(Boolean);
      if (titleParts.length > 0) { dirUpdates.directorTitle = titleParts.join(" — "); fieldsUpdated.push("directorTitle"); }

      const { data, error } = await db
        .from("HospitalLead")
        .update(dirUpdates)
        .eq("id", params.id)
        .eq("companyId", DEMO_COMPANY_ID)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // ── Auto-create a lead so multiple directors per hospital are preserved ──
      let leadCreated = false;
      if (directorInfo.directorName) {
        const dirName = String(directorInfo.directorName);
        const dirTitle = titleParts.join(" — ") || "Residency Program Director";
        // Dedup: check if this exact director already exists as a lead
        const { data: existing } = await db
          .from("Lead")
          .select("id")
          .eq("companyId", DEMO_COMPANY_ID)
          .eq("source", "residency_director")
          .ilike("fullName", dirName)
          .eq("company", hospital.name)
          .limit(1);

        if (!existing || existing.length === 0) {
          await db.from("Lead").insert({
            companyId: DEMO_COMPANY_ID,
            source: "residency_director",
            fullName: dirName,
            email: directorInfo.directorEmail ? String(directorInfo.directorEmail) : null,
            phone: directorInfo.directorPhone ? String(directorInfo.directorPhone) : null,
            jobTitle: dirTitle,
            company: hospital.name,
            city: hospital.city || null,
            state: hospital.state,
            country: hospital.country,
            website: hospital.url || null,
            specialties: categoryLabel ? [categoryLabel] : [],
            notes: [
              `Category: ${categoryLabel || "General/DIO"}`,
              directorInfo.reasoning ? `Found via: ${directorInfo.reasoning}` : "",
              `Confidence: ${directorInfo.confidence ?? "unknown"}`,
              `Hospital: ${hospital.name}, ${hospital.city ?? ""} ${hospital.state}`,
            ].filter(Boolean).join("\n"),
            status: "new",
            updatedAt: new Date().toISOString(),
          });
          leadCreated = true;
        }
      }

      return NextResponse.json({
        hospital: data,
        fieldsUpdated,
        leadCreated,
        confidence: directorInfo.confidence ?? "unknown",
        source: directorInfo.source ?? "",
        residencyCategory: directorInfo.residencyCategory ?? categoryLabel,
        associateDirectors: directorInfo.associateDirectors ?? [],
        reasoning: directorInfo.reasoning ?? "",
      });
    }

    // Normal field update
    const allowed = ["name", "address", "city", "state", "country", "url", "phone", "type", "beds", "notes", "status", "directorName", "directorEmail", "directorPhone", "directorTitle"];
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await db
      .from("HospitalLead")
      .update(updates)
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ hospital: data });
  } catch (err) {
    return handleApiError(err, "Hospitals PATCH");
  }
}

// DELETE /api/hospitals/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db
      .from("HospitalLead")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Hospitals DELETE");
  }
}
