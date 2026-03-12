export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/videos — list all videos (optionally filtered by categoryId)
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const categoryId = req.nextUrl.searchParams.get("categoryId");

    let query = db
      .from("Video")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("publishedAt", { ascending: false, nullsFirst: false });

    if (categoryId === "uncategorized") {
      query = query.is("categoryId", null);
    } else if (categoryId) {
      query = query.eq("categoryId", categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ videos: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Videos GET");
  }
}
