export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

// GET /api/content/stats?companyId=xxx
// Returns status counts using DB COUNT queries — never transfers content bodies.
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // One query per table — fetch status column only, count client-side (9 queries instead of 45)
    const statuses = ["PENDING", "APPROVED", "REJECTED", "REVISED", "PUBLISHED"] as const;

    const allRows = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const { data: rows } = await db
          .from(cat.table)
          .select("status")
          .eq("companyId", companyId)
          .is("deletedAt", null);
        return rows ?? [];
      })
    );

    const flat = allRows.flat();
    const totals = statuses.reduce(
      (acc, s) => {
        acc[s] = flat.filter((r) => r.status === s).length;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalGenerated = flat.length;

    return NextResponse.json({
      totalGenerated,
      pendingReview: totals.PENDING,
      approved: totals.APPROVED,
      rejected: totals.REJECTED,
      revised: totals.REVISED,
      published: totals.PUBLISHED,
    });
  } catch (error) {
    return handleApiError(error, "Stats");
  }
}
