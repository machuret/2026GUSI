export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/grants/draft-history/[id] — load a specific snapshot
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("GrantDraftHistory")
      .select("*")
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .single();

    if (error || !data) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    return NextResponse.json({ snapshot: data });
  } catch (err) {
    return handleApiError(err, "Draft History GET by ID");
  }
}

// DELETE /api/grants/draft-history/[id] — delete a snapshot
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db
      .from("GrantDraftHistory")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Draft History DELETE");
  }
}
