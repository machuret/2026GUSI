export const runtime = "edge";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// PUT /api/videos/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;
    const { id } = await params;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { data, error } = await db
      .from("VideoCategory")
      .update({ ...parsed.data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (err) {
    return handleApiError(err, "VideoCategory PUT");
  }
}

// DELETE /api/videos/categories/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;
    const { id } = await params;

    // Unset categoryId on videos in this category
    await db.from("Video").update({ categoryId: null }).eq("categoryId", id).eq("companyId", DEMO_COMPANY_ID);

    const { error } = await db.from("VideoCategory").delete().eq("id", id).eq("companyId", DEMO_COMPANY_ID);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "VideoCategory DELETE");
  }
}
