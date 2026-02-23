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

      const systemPrompt = `You are an Australian healthcare data researcher. Given a hospital name, state, and any existing data, provide enriched information.

Return ONLY valid JSON with these fields (only include fields you are confident about):
{
  "address": "full street address",
  "city": "city/suburb",
  "url": "official website URL",
  "phone": "main phone number",
  "type": "Public" | "Private" | "Public/Teaching",
  "beds": number or null,
  "notes": "brief description: specialties, affiliated university, notable departments"
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
      if (enriched.address && !hospital.address) updates.address = String(enriched.address);
      if (enriched.city && !hospital.city) updates.city = String(enriched.city);
      if (enriched.url && !hospital.url) updates.url = String(enriched.url);
      if (enriched.phone && !hospital.phone) updates.phone = String(enriched.phone);
      if (enriched.type && !hospital.type) updates.type = String(enriched.type);
      if (enriched.beds && !hospital.beds) updates.beds = Number(enriched.beds);
      if (enriched.notes) updates.notes = String(enriched.notes);

      const { data, error } = await db
        .from("HospitalLead")
        .update(updates)
        .eq("id", params.id)
        .eq("companyId", DEMO_COMPANY_ID)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ hospital: data });
    }

    // Normal field update
    const allowed = ["name", "address", "city", "state", "country", "url", "phone", "type", "beds", "notes", "status"];
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
