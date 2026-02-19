export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { db } from "@/lib/db";

// GET /api/activity — list activity logs with pagination
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const rawLimit = parseInt(p.get("limit") ?? "100", 10);
    const rawOffset = parseInt(p.get("offset") ?? "0", 10);
    const limit = Math.min(500, Math.max(1, isNaN(rawLimit) ? 100 : rawLimit));
    const offset = Math.max(0, isNaN(rawOffset) ? 0 : rawOffset);

    const { data: logs, count } = await db
      .from("ActivityLog")
      .select("*, user:User(name, email, role)", { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    return NextResponse.json({ logs: logs ?? [], total: count ?? 0, limit, offset });
  } catch (error) {
    return handleApiError(error, "Activity GET");
  }
}
