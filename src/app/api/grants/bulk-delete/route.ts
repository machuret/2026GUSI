export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

// POST /api/grants/bulk-delete
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { ids } = schema.parse(body);

    // Verify ownership first
    const { data: owned, error: checkErr } = await db
      .from("Grant")
      .select("id")
      .in("id", ids)
      .eq("companyId", DEMO_COMPANY_ID);

    if (checkErr) throw checkErr;

    const ownedIds = (owned ?? []).map((r: { id: string }) => r.id);

    if (ownedIds.length === 0) {
      return NextResponse.json({ success: false, error: "No matching grants found for this company" }, { status: 404 });
    }

    const { error } = await db
      .from("Grant")
      .delete()
      .in("id", ownedIds);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: ownedIds.length });
  } catch (error) {
    return handleApiError(error, "Bulk Delete Grants");
  }
}
