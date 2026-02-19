export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const MAX_BODY_CHARS = 500_000; // ~500KB per post sample

const postSchema = z.object({
  title: z.string().max(500).optional(),
  body: z.string().min(1).max(MAX_BODY_CHARS, `Post body must be under ${MAX_BODY_CHARS / 1000}KB`),
  contentType: z.string().default("blog"),
  platform: z.string().default("website"),
});

const bulkSchema = z.object({
  posts: z.array(postSchema).min(1),
});

// POST /api/voices/[id]/posts — upload content samples for an author
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: author } = await db.from("Author").select("id").eq("id", params.id).maybeSingle();
    if (!author) return NextResponse.json({ error: "Author not found" }, { status: 404 });

    const body = await req.json();
    const { posts } = bulkSchema.parse(body);

    const rows = posts.map((p) => ({
      authorId: params.id,
      companyId: DEMO_COMPANY_ID,
      title: p.title ?? null,
      body: p.body,
      contentType: p.contentType,
      platform: p.platform,
      wordCount: p.body.trim().split(/\s+/).length,
    }));

    const { data: created, error } = await db.from("AuthorPost").insert(rows).select();
    if (error) throw error;

    // Update author aggregate counts
    const { data: allPosts } = await db
      .from("AuthorPost")
      .select("wordCount")
      .eq("authorId", params.id);

    const totalWords = (allPosts ?? []).reduce((s, p) => s + (p.wordCount ?? 0), 0);
    await db.from("Author").update({
      postCount: (allPosts ?? []).length,
      wordCount: totalWords,
      updatedAt: new Date().toISOString(),
    }).eq("id", params.id);

    return NextResponse.json({ success: true, created: created?.length ?? 0 });
  } catch (err) {
    return handleApiError(err, "Voice posts POST");
  }
}

// DELETE /api/voices/[id]/posts?postId=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const postId = req.nextUrl.searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

    const { error } = await db.from("AuthorPost").delete().eq("id", postId).eq("authorId", params.id);
    if (error) throw error;

    // Recompute counts
    const { data: allPosts } = await db.from("AuthorPost").select("wordCount").eq("authorId", params.id);
    const totalWords = (allPosts ?? []).reduce((s, p) => s + (p.wordCount ?? 0), 0);
    await db.from("Author").update({
      postCount: (allPosts ?? []).length,
      wordCount: totalWords,
      updatedAt: new Date().toISOString(),
    }).eq("id", params.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Voice posts DELETE");
  }
}
