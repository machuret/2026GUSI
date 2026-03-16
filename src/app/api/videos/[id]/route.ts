export const runtime = "edge";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const updateSchema = z.object({
  categoryId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  transcript: z.string().optional(),
});

// GET /api/videos/[id] — single video with all fields including transcript
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;
    const { id } = await params;

    const { data, error } = await db
      .from("Video")
      .select("*")
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ video: data });
  } catch (err) {
    return handleApiError(err, "Video GET");
  }
}

// PATCH /api/videos/[id] — update video metadata (category, title, description, tags)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      .from("Video")
      .update({ ...parsed.data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ video: data });
  } catch (err) {
    return handleApiError(err, "Video PATCH");
  }
}

// DELETE /api/videos/[id] — remove a video from our database (does not delete from Vimeo)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;
    const { id } = await params;

    const { error } = await db.from("Video").delete().eq("id", id).eq("companyId", DEMO_COMPANY_ID);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Video DELETE");
  }
}
