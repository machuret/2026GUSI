export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { fetchVimeoPage, extractVimeoId, getBestThumbnail } from "@/lib/vimeo";

// POST /api/videos/sync?page=1 — sync one page of videos from Vimeo (100 per page)
// Uses batch upsert: 1 Vimeo API call + 2 DB calls per page (was 200+).
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
    const { videos: vimeoVideos, total, totalPages, hasMore } = await fetchVimeoPage(page);

    const now = new Date().toISOString();

    // Build rows for upsert
    const rows = vimeoVideos.map((v) => ({
      companyId: DEMO_COMPANY_ID,
      vimeoId: extractVimeoId(v.uri),
      title: v.name || "Untitled",
      description: v.description || "",
      thumbnailUrl: getBestThumbnail(v.pictures),
      duration: v.duration || 0,
      vimeoUrl: v.link || "",
      embedHtml: v.embed?.html || "",
      width: v.width || 0,
      height: v.height || 0,
      status: v.status || "available",
      tags: (v.tags || []).map((t: { name: string }) => t.name),
      publishedAt: v.created_time || null,
      updatedAt: now,
    }));

    // Check which vimeoIds already exist (1 DB call)
    const vimeoIds = rows.map((r) => r.vimeoId);
    const { data: existing } = await db
      .from("Video")
      .select("vimeoId")
      .eq("companyId", DEMO_COMPANY_ID)
      .in("vimeoId", vimeoIds);

    const existingSet = new Set((existing ?? []).map((e) => e.vimeoId));
    const synced = rows.filter((r) => !existingSet.has(r.vimeoId)).length;
    const updated = rows.filter((r) => existingSet.has(r.vimeoId)).length;

    // Batch upsert — single DB call for the whole page
    // ignoreDuplicates: false means it will update on conflict
    // onConflict targets the unique constraint (companyId, vimeoId)
    const { error } = await db
      .from("Video")
      .upsert(rows, {
        onConflict: "companyId,vimeoId",
        ignoreDuplicates: false,
      });

    if (error) throw error;

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
