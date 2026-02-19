import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const postSchema = z.object({
  title: z.string().optional(),
  body: z.string().min(1),
  contentType: z.string().min(1),
  platform: z.string().min(1),
  tags: z.array(z.string()).default([]),
  style: z.string().optional(),
  mustDo: z.string().optional(),
  mustNot: z.string().optional(),
  wordCount: z.union([z.number(), z.string()]).optional(),
  brandRules: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
});

const documentSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  fileType: z.string().min(1),
});

const ingestSchema = z.object({
  companyId: z.string().min(1),
  posts: z.array(postSchema).default([]),
  documents: z.array(documentSchema).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = ingestSchema.parse(body);

    // Auto-create company if it doesn't exist
    await db.from("Company").upsert({ id: data.companyId, name: "My Company" }, { onConflict: "id" });

    const results = { postsCreated: 0, documentsCreated: 0 };

    if (data.posts.length > 0) {
      const { data: created } = await db.from("ContentPost").insert(
        data.posts.map((p) => ({
          companyId: data.companyId,
          title: p.title || null,
          body: p.body,
          contentType: p.contentType,
          platform: p.platform,
          tags: p.tags,
          style: p.style || null,
          mustDo: p.mustDo || null,
          mustNot: p.mustNot || null,
          wordCount: p.wordCount ? Number(p.wordCount) : null,
          brandRules: p.brandRules || null,
          publishedAt: p.publishedAt || null,
        }))
      ).select();
      results.postsCreated = created?.length ?? 0;
    }

    if (data.documents.length > 0) {
      const { data: created } = await db.from("Document").insert(
        data.documents.map((d) => ({
          companyId: data.companyId,
          filename: d.filename,
          content: d.content,
          fileType: d.fileType,
        }))
      ).select();
      results.documentsCreated = created?.length ?? 0;
    }

    await logActivity(
      authUser.id,
      authUser.email || "",
      "content.ingest",
      `${results.postsCreated} posts, ${results.documentsCreated} docs`
    );

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    return handleApiError(error, "Ingest");
  }
}
