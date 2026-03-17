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

    const { error } = await db
      .from("Grant")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .in("id", ids)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (error) {
    return handleApiError(error, "Bulk Update Grants");
  }
}
