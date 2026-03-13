export const runtime = "edge";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// Columns to return in list queries — excludes transcript for performance
const LIST_COLUMNS = "id,companyId,categoryId,vimeoId,title,description,thumbnailUrl,duration,vimeoUrl,embedHtml,width,height,status,tags,publishedAt,createdAt,updatedAt";

// GET /api/videos?page=1&limit=40&search=keyword&categoryId=xxx
// Server-side pagination, search, and filtering. Transcript excluded from list.
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") || "40", 10)));
    const search = params.get("search")?.trim() || "";
    const categoryId = params.get("categoryId");
    const offset = (page - 1) * limit;

    // Build count query (for total)
    let countQuery = db
      .from("Video")
      .select("id", { count: "exact", head: true })
      .eq("companyId", DEMO_COMPANY_ID);

    // Build data query
    let dataQuery = db
      .from("Video")
      .select(LIST_COLUMNS)
      .eq("companyId", DEMO_COMPANY_ID)
      .order("publishedAt", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Category filter
    if (categoryId === "uncategorized") {
      countQuery = countQuery.is("categoryId", null);
      dataQuery = dataQuery.is("categoryId", null);
    } else if (categoryId) {
      countQuery = countQuery.eq("categoryId", categoryId);
      dataQuery = dataQuery.eq("categoryId", categoryId);
    }

    // Search filter (ilike on title or description)
    if (search) {
      const pattern = `%${search}%`;
      countQuery = countQuery.or(`title.ilike.${pattern},description.ilike.${pattern}`);
      dataQuery = dataQuery.or(`title.ilike.${pattern},description.ilike.${pattern}`);
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
    return handleApiError(err, "Videos GET");
  }
}
