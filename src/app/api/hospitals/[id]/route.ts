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

      const systemPrompt = `You are a US medical education researcher. Given a hospital name and location, find the Residency Program Director or Graduate Medical Education (GME) leader.

Search for:
1. The name of the Residency Program Director (or DIO - Designated Institutional Official)
2. Their professional email address (must be a real institutional email, not fabricated)
3. Their phone number if available
4. Their exact title/role

Return ONLY valid JSON:
{
  "directorName": "Full Name, MD" or null,
  "directorEmail": "email@hospital.edu" or null,
  "directorPhone": "phone number" or null,
  "directorTitle": "exact title e.g. Program Director, Internal Medicine Residency" or null,
  "confidence": "high" | "medium" | "low",
  "source": "brief note on where this info would be found"
}

IMPORTANT: Only include information you are reasonably confident about. Return null for fields you cannot verify. Do NOT fabricate email addresses.`;

      const userPrompt = `Find the Residency Program Director for:\nHospital: ${hospital.name}\nCity: ${hospital.city || "unknown"}, ${hospital.state}\nWebsite: ${hospital.url || "unknown"}\nType: ${hospital.type || "unknown"}`;

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
      if (directorInfo.directorTitle) { dirUpdates.directorTitle = String(directorInfo.directorTitle); fieldsUpdated.push("directorTitle"); }

      const { data, error } = await db
        .from("HospitalLead")
        .update(dirUpdates)
        .eq("id", params.id)
        .eq("companyId", DEMO_COMPANY_ID)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({
        hospital: data,
        fieldsUpdated,
        confidence: directorInfo.confidence ?? "unknown",
        source: directorInfo.source ?? "",
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
