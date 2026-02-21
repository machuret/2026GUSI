export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getLibrary } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const category = searchParams.get("category") ?? undefined;
    const status   = searchParams.get("status")   ?? undefined;
    const search   = searchParams.get("search")   ?? undefined;

    const { items, total } = await getLibrary(companyId, { page, limit, category, status, search });

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    return handleApiError(error, "Library");
  }
}
