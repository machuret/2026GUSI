export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/partners/[id] — get single partner by id or slug
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await db
      .from("Partner")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .or(`slug.eq.${params.id},id.eq.${params.id}`)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    return NextResponse.json({ partner: data });
  } catch (error) {
    return handleApiError(error, "Partner GET");
  }
}

// PATCH /api/partners/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.logoUrl !== undefined) patch.logoUrl = body.logoUrl || null;
    if (body.url !== undefined) patch.url = body.url || null;
    if (body.slug !== undefined) {
      const { data: existing } = await db
        .from("Partner")
        .select("id")
        .eq("companyId", DEMO_COMPANY_ID)
        .eq("slug", body.slug)
        .neq("id", params.id)
        .maybeSingle();
      if (existing) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      patch.slug = body.slug;
    }
    if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
    if (typeof body.active === "boolean") patch.active = body.active;

    const { data, error } = await db
      .from("Partner")
      .update(patch)
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, partner: data });
  } catch (error) {
    return handleApiError(error, "Partner PATCH");
  }
}

// DELETE /api/partners/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const { error } = await db
      .from("Partner")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Partner DELETE");
  }
}
