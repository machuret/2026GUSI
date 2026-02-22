export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const patchSchema = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  severity:    z.enum(["critical", "high", "medium", "low"]).optional(),
  active:      z.boolean().optional(),
});

// PATCH /api/compliance/rules/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const patch = patchSchema.parse(body);

    const { data: rule, error } = await db
      .from("ComplianceRule")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    return handleApiError(error, "Compliance Rules PATCH");
  }
}

// DELETE /api/compliance/rules/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const { error } = await db
      .from("ComplianceRule")
      .delete()
      .eq("id", params.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Compliance Rules DELETE");
  }
}
