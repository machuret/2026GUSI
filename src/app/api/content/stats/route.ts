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

    // Fire one COUNT query per table per status — all in parallel
    const statuses = ["PENDING", "APPROVED", "REJECTED", "REVISED", "PUBLISHED"] as const;

    const countResults = await Promise.all(
      CATEGORIES.flatMap((cat) =>
        statuses.map(async (status) => {
          const { count } = await db
            .from(cat.table)
            .select("id", { count: "exact", head: true })
            .eq("companyId", companyId)
            .eq("status", status)
            .then((r) => ({ count: r.count ?? 0 }));
          return { status, count };
        })
      )
    );

    // Aggregate across all tables
    const totals = statuses.reduce(
      (acc, s) => {
        acc[s] = countResults.filter((r) => r.status === s).reduce((sum, r) => sum + r.count, 0);
        return acc;
      },
      {} as Record<string, number>
    );

    const totalGenerated = Object.values(totals).reduce((a, b) => a + b, 0);

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
