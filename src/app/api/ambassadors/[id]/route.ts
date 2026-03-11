export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/ambassadors/[id] — get single ambassador by id or slug
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Try by slug first, then by id
    const { data, error } = await db
      .from("Ambassador")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .or(`slug.eq.${params.id},id.eq.${params.id}`)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Ambassador not found" }, { status: 404 });
    }
    return NextResponse.json({ ambassador: data });
  } catch (error) {
    return handleApiError(error, "Ambassador GET");
  }
}

// PATCH /api/ambassadors/[id] — update (admin only)
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
    if (body.title !== undefined) patch.title = body.title;
    if (body.bio !== undefined) patch.bio = body.bio;
    if (body.photoUrl !== undefined) patch.photoUrl = body.photoUrl || null;
    if (body.slug !== undefined) {
      // Check slug uniqueness
      const { data: existing } = await db
        .from("Ambassador")
        .select("id")
        .eq("companyId", DEMO_COMPANY_ID)
        .eq("slug", body.slug)
        .neq("id", params.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      }
      patch.slug = body.slug;
    }
    if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.linkedinUrl !== undefined) patch.linkedinUrl = body.linkedinUrl || null;
    if (body.websiteUrl !== undefined) patch.websiteUrl = body.websiteUrl || null;

    const { data, error } = await db
      .from("Ambassador")
      .update(patch)
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, ambassador: data });
  } catch (error) {
    return handleApiError(error, "Ambassador PATCH");
  }
}

// DELETE /api/ambassadors/[id] — delete (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const { error } = await db
      .from("Ambassador")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Ambassador DELETE");
  }
}
