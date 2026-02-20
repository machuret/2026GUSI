export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const saveSchema = z.object({
  grantId:   z.string().min(1),
  grantName: z.string().min(1),
  sections:  z.record(z.string()),
  brief:     z.record(z.unknown()).optional().nullable(),
  tone:      z.enum(["first_person", "third_person"]).default("first_person"),
  length:    z.enum(["concise", "standard", "detailed"]).default("standard"),
});

// GET /api/grants/drafts — list all drafts for this company
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("GrantDraft")
      .select("id, grantId, grantName, tone, length, createdAt, updatedAt")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("updatedAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ drafts: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Grant Drafts GET");
  }
}

// POST /api/grants/drafts — upsert draft (one draft per grant)
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = saveSchema.parse(body);

    // Check if draft already exists for this grant
    const { data: existing } = await db
      .from("GrantDraft")
      .select("id")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("grantId", data.grantId)
      .maybeSingle();

    let draft;
    if (existing) {
      const { data: updated, error } = await db
        .from("GrantDraft")
        .update({
          sections:  data.sections,
          brief:     data.brief ?? null,
          tone:      data.tone,
          length:    data.length,
          grantName: data.grantName,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      draft = updated;
    } else {
      const { data: created, error } = await db
        .from("GrantDraft")
        .insert({
          companyId: DEMO_COMPANY_ID,
          grantId:   data.grantId,
          grantName: data.grantName,
          sections:  data.sections,
          brief:     data.brief ?? null,
          tone:      data.tone,
          length:    data.length,
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      draft = created;
    }

    return NextResponse.json({ success: true, draft });
  } catch (err) {
    return handleApiError(err, "Grant Drafts POST");
  }
}
