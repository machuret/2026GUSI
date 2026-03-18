export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

/**
 * GET /api/grants/bootstrap
 * Returns grants + company info + grant profile in a single round-trip.
 * Replaces the 3 parallel fetches in useGrants (grants, company, grant-profile).
 */
export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireEdgeAuth(req);
    if (authError) return authError;

    const [
      { data: grants, error: grantsErr },
      { data: company },
      { data: companyInfo },
      { data: profile },
    ] = await Promise.all([
      db.from("Grant")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("deadlineDate", { ascending: true, nullsFirst: false }),
      db.from("Company")
        .select("id, name, industry, website, email")
        .eq("id", DEMO_COMPANY_ID)
        .maybeSingle(),
      db.from("CompanyInfo")
        .select("bulkContent, values, corePhilosophy, founders, achievements, products")
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle(),
      db.from("GrantProfile")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .maybeSingle(),
    ]);

    if (grantsErr) throw grantsErr;

    return NextResponse.json({
      grants: grants ?? [],
      company: company ?? null,
      info: companyInfo ?? null,
      profile: profile ?? null,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err, "Grants Bootstrap");
  }
}
