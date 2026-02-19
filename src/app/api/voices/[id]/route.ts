export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
});

// GET /api/voices/[id] — get single author with posts + style profile
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const [{ data: author }, { data: posts }, { data: style }] = await Promise.all([
      db.from("Author").select("*").eq("id", params.id).maybeSingle(),
      db.from("AuthorPost").select("id, title, contentType, platform, wordCount, createdAt").eq("authorId", params.id).order("createdAt", { ascending: false }),
      db.from("AuthorStyleProfile").select("*").eq("authorId", params.id).maybeSingle(),
    ]);

    if (!author) return NextResponse.json({ error: "Author not found" }, { status: 404 });
    return NextResponse.json({ author, posts: posts ?? [], style });
  } catch (err) {
    return handleApiError(err, "Voice GET");
  }
}

// PATCH /api/voices/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = updateSchema.parse(body);

    const { data: author, error } = await db
      .from("Author")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, author });
  } catch (err) {
    return handleApiError(err, "Voice PATCH");
  }
}

// DELETE /api/voices/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db.from("Author").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Voice DELETE");
  }
}
