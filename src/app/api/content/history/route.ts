import { NextRequest, NextResponse } from "next/server";
import { getAllHistory } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId query parameter is required" }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    const { items, total } = await getAllHistory(companyId, { page, limit });

    return NextResponse.json({ history: items, total, page, limit });
  } catch (error) {
    return handleApiError(error, "History");
  }
}
