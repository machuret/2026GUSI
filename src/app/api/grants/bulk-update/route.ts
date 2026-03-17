export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  data: z.object({
    crmStatus: z.enum(["Researching", "Pipeline", "Active", "Submitted", "Won", "Lost"]).optional().nullable(),
    decision: z.enum(["Apply", "Maybe", "No", "Rejected"]).optional().nullable(),
  }),
});

// POST /api/grants/bulk-update
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { ids, data } = bulkUpdateSchema.parse(body);

    // Verify all IDs belong to this company first
    const { data: owned, error: checkErr } = await db
      .from("Grant")
      .select("id")
      .in("id", ids)
      .eq("companyId", DEMO_COMPANY_ID);

    if (checkErr) throw checkErr;

    const ownedIds = (owned ?? []).map((r: { id: string }) => r.id);

    if (ownedIds.length === 0) {
      console.error(`[bulk-update] 0 of ${ids.length} IDs matched companyId=${DEMO_COMPANY_ID}`);
      return NextResponse.json({ success: false, error: "No matching grants found for this company" }, { status: 404 });
    }

    // Update only the verified IDs (by id alone — service role bypasses RLS)
    const { data: updated, error } = await db
      .from("Grant")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .in("id", ownedIds)
      .select("id, crmStatus");

    if (error) {
      console.error("[bulk-update] DB error:", error);
      throw error;
    }

    console.log(`[bulk-update] requested=${ids.length} owned=${ownedIds.length} actuallyUpdated=${updated?.length ?? 0} crmStatus=${data.crmStatus}`);

    return NextResponse.json({ success: true, updated: updated?.length ?? 0, requested: ids.length, owned: ownedIds.length });
  } catch (error) {
    return handleApiError(error, "Bulk Update Grants");
  }
}
