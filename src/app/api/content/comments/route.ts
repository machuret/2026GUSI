export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const addSchema = z.object({
  contentId: z.string().min(1),
  contentTable: z.string().min(1),
  companyId: z.string().min(1),
  text: z.string().min(1).max(2000),
  authorName: z.string().optional(),
});

// GET /api/content/comments?contentId=xxx
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const contentId = req.nextUrl.searchParams.get("contentId");
    if (!contentId) {
      return NextResponse.json({ error: "contentId required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("ContentComment")
      .select("*")
      .eq("contentId", contentId)
      .order("createdAt", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Get Comments");
  }
}

// POST /api/content/comments
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = addSchema.parse(body);

    const { data: comment, error } = await db
      .from("ContentComment")
      .insert({
        contentId: data.contentId,
        contentTable: data.contentTable,
        companyId: data.companyId,
        text: data.text,
        authorName: data.authorName || authUser.email || "Team",
        authorId: authUser.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    return handleApiError(error, "Add Comment");
  }
}

// DELETE /api/content/comments?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: comment, error: fetchError } = await db
      .from("ContentComment")
      .select("authorId")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    if (comment.authorId !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await db.from("ContentComment").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Delete Comment");
  }
}
