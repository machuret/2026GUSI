export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/compliance/results — list past audit results
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || DEMO_COMPANY_ID;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const { data: results, error } = await db
      .from("AuditResult")
      .select("*")
      .eq("companyId", companyId)
      .order("scannedAt", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return NextResponse.json({ results: results ?? [] });
  } catch (error) {
    return handleApiError(error, "Compliance Results GET");
  }
}
