export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleApiError } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";

/**
 * GET /api/grants/history/check?funderName=<name>
 *
 * Returns all GrantHistory rows whose funderName is a case-insensitive
 * partial match of the query. Used by:
 *   - CRM card duplicate alert banner
 *   - Grant analyse route (AI context injection)
 *
 * Response: { matches: GrantHistoryRow[] }
 */
export async function GET(req: NextRequest) {
  try {
    const { error: authError } = requireEdgeAuth(req);
    if (authError) return authError;

    const funderName = req.nextUrl.searchParams.get("funderName")?.trim();
    if (!funderName) {
      return NextResponse.json({ error: "Missing funderName query param" }, { status: 400 });
    }

    const { data, error } = await db
      .from("GrantHistory")
      .select("id, funderName, grantName, partnerOrg, region, outcome, amount, rejectionReason, notes, submittedAt")
      .eq("companyId", DEMO_COMPANY_ID)
      .ilike("funderName", `%${funderName}%`)
      .order("submittedAt", { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ matches: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Grant History Check");
  }
}
