export const runtime = "edge";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/translations/transcripts?search=keyword&page=1&limit=50
// Returns videos that have a non-empty transcript, with search + pagination.
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const search = params.get("search")?.trim() || "";
    const offset = (page - 1) * limit;

    // Count query — videos with non-empty transcripts
    let countQuery = db
      .from("Video")
      .select("id", { count: "exact", head: true })
      .eq("companyId", DEMO_COMPANY_ID)
      .not("transcript", "is", null)
      .neq("transcript", "")
      .neq("transcript", "__no_captions__");

    // Data query — select fields needed for the transcript library
    let dataQuery = db
      .from("Video")
      .select("id, vimeoId, title, description, thumbnailUrl, duration, transcript, categoryId, publishedAt, createdAt")
      .eq("companyId", DEMO_COMPANY_ID)
      .not("transcript", "is", null)
      .neq("transcript", "")
      .neq("transcript", "__no_captions__")
      .order("publishedAt", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Search filter — search in title, description, and transcript content
    if (search) {
      const safe = search.replace(/[%_\\,.()"']/g, "");
      if (safe) {
        const pattern = `%${safe}%`;
        countQuery = countQuery.or(`title.ilike.${pattern},description.ilike.${pattern},transcript.ilike.${pattern}`);
        dataQuery = dataQuery.or(`title.ilike.${pattern},description.ilike.${pattern},transcript.ilike.${pattern}`);
      }
    }

    const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);
    if (error) throw error;

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      videos: data ?? [],
      pagination: { page, limit, totalCount, totalPages, hasMore: page < totalPages },
    });
  } catch (err) {
    return handleApiError(err, "Translations Transcripts GET");
  }
}
