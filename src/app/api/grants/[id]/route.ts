export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
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
  aiResearched: z.boolean().optional().nullable(),
});

// PATCH /api/grants/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const data = updateSchema.parse(body);

    const { data: existing, error: fetchError } = await db
      .from("Grant")
      .select("companyId")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: "Grant not found" }, { status: 404 });

    const { data: grant, error } = await db
      .from("Grant")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
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

    const { error } = await db.from("Grant").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Delete Grant");
  }
}
