export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// PATCH /api/faq/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.question !== undefined) patch.question = body.question;
    if (body.answer !== undefined) patch.answer = body.answer;
    if (body.category !== undefined) patch.category = body.category || null;
    if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
    if (typeof body.active === "boolean") patch.active = body.active;

    const { data, error } = await db
      .from("Faq")
      .update(patch)
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, faq: data });
  } catch (error) {
    return handleApiError(error, "FAQ PATCH");
  }
}

// DELETE /api/faq/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const { error } = await db
      .from("Faq")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "FAQ DELETE");
  }
}
