export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logActivity } from "@/lib/activity";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(200),
  updates: z.object({
    status: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.number().int().min(1).max(5).optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

// POST /api/leads/bulk-update — update multiple leads in one call
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { leadIds, updates } = bulkUpdateSchema.parse(body);

    const { data, error } = await db
      .from("Lead")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("companyId", DEMO_COMPANY_ID)
      .in("id", leadIds)
      .select("id");

    if (error) throw error;
    const statusLabel = updates.status ? ` → ${updates.status}` : "";
    await logActivity(authUser.id, authUser.email || "", "leads.bulk_update", `Bulk updated ${data?.length ?? 0} leads${statusLabel}`);
    return NextResponse.json({ success: true, updatedCount: data?.length ?? 0 });
  } catch (error) {
    return handleApiError(error, "Bulk Update Leads");
  }
}
