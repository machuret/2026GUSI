export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  founder: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  deadlineDate: z.string().optional().nullable(),
  howToApply: z.string().optional().nullable(),
  geographicScope: z.string().optional().nullable(),
  eligibility: z.string().optional().nullable(),
  amount: z.string().optional().nullable(),
  projectDuration: z.string().optional().nullable(),
  fitScore: z.number().int().min(1).max(5).optional().nullable(),
  submissionEffort: z.enum(["Low", "Medium", "High"]).optional().nullable(),
  decision: z.enum(["Apply", "Maybe", "No", "Rejected"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  complexityScore: z.number().int().min(0).max(100).optional().nullable(),
  complexityLabel: z.enum(["Low", "Medium", "High", "Very High"]).optional().nullable(),
  complexityNotes: z.string().optional().nullable(),
  crmStatus: z.enum(["Researching", "Pipeline", "Active", "Submitted", "Won", "Lost"]).optional().nullable(),
  crmNotes: z.string().optional().nullable(),
  aiAnalysis: z.record(z.unknown()).optional().nullable(),
  aiBrief: z.record(z.unknown()).optional().nullable(),
  aiResearched: z.boolean().optional().nullable(),
  validationStatus: z.enum(["VALIDATED", "FAILED"]).optional().nullable(),
  validatedAt: z.string().optional().nullable(),
  validationResult: z.record(z.unknown()).optional().nullable(),
});

// PATCH /api/grants/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();
    console.log(`[PATCH /api/grants/${id.slice(0,8)}] body:`, JSON.stringify(body));
    const data = updateSchema.parse(body);

    const { data: existing, error: fetchError } = await db
      .from("Grant")
      .select("companyId")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) { console.error(`[PATCH] fetchError:`, fetchError); throw fetchError; }
    if (!existing) { console.error(`[PATCH] Grant not found: ${id}`); return NextResponse.json({ error: "Grant not found" }, { status: 404 }); }
    if (existing.companyId !== DEMO_COMPANY_ID) { console.error(`[PATCH] Forbidden: companyId=${existing.companyId}`); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

    const { data: grant, error } = await db
      .from("Grant")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) { console.error(`[PATCH] DB update error:`, error); throw error; }
    console.log(`[PATCH /api/grants/${id.slice(0,8)}] SUCCESS crmStatus=${grant?.crmStatus}`);
    return NextResponse.json({ success: true, grant });
  } catch (error) {
    return handleApiError(error, "Update Grant");
  }
}

// DELETE /api/grants/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const { data: existing, error: fetchError } = await db
      .from("Grant")
      .select("companyId")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    if (existing.companyId !== DEMO_COMPANY_ID) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await db.from("Grant").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Delete Grant");
  }
}
