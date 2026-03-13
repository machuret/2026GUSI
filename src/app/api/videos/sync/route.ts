export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { fetchVimeoPage, extractVimeoId, getBestThumbnail } from "@/lib/vimeo";

// POST /api/videos/sync?page=1 — sync one page of videos from Vimeo (100 per page)
// Frontend loops page by page until done, preventing Vercel timeout.
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);

    const { videos: vimeoVideos, total, totalPages, hasMore } = await fetchVimeoPage(page);

    let synced = 0;
    let updated = 0;

    for (const v of vimeoVideos) {
      const vimeoId = extractVimeoId(v.uri);
      const thumbnail = getBestThumbnail(v.pictures);

      const row = {
        companyId: DEMO_COMPANY_ID,
        vimeoId,
        title: v.name || "Untitled",
        description: v.description || "",
        thumbnailUrl: thumbnail,
        duration: v.duration || 0,
        vimeoUrl: v.link || "",
        embedHtml: v.embed?.html || "",
        width: v.width || 0,
        height: v.height || 0,
        status: v.status || "available",
        tags: (v.tags || []).map((t) => t.name),
        publishedAt: v.created_time || null,
        updatedAt: new Date().toISOString(),
      };

      const { data: existing } = await db
        .from("Video")
        .select("id")
        .eq("companyId", DEMO_COMPANY_ID)
        .eq("vimeoId", vimeoId)
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from("Video")
          .update({
            title: row.title,
            description: row.description,
            thumbnailUrl: row.thumbnailUrl,
            duration: row.duration,
            vimeoUrl: row.vimeoUrl,
            embedHtml: row.embedHtml,
            width: row.width,
            height: row.height,
            status: row.status,
            tags: row.tags,
            publishedAt: row.publishedAt,
            updatedAt: row.updatedAt,
          })
          .eq("id", existing.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await db
          .from("Video")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      page,
      totalPages,
      total,
      hasMore,
      synced,
      updated,
      pageSize: vimeoVideos.length,
    });
  } catch (err) {
    return handleApiError(err, "Videos Sync");
  }
}
