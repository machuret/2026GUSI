export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/grants/drafts/[id] — load full draft (with sections)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("GrantDraft")
      .select("*")
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    return NextResponse.json({ draft: data });
  } catch (err) {
    return handleApiError(err, "Grant Draft GET");
  }
}

// DELETE /api/grants/drafts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db
      .from("GrantDraft")
      .delete()
      .eq("id", params.id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Grant Draft DELETE");
  }
}
