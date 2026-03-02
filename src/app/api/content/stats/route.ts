export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { statsCache } from "@/lib/cache";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "REVISED", "PUBLISHED"] as const;

// GET /api/content/stats?companyId=xxx
// Uses DB-level COUNT per (table × status) — no row bodies transferred.
// Results cached for 30s to avoid hammering the DB on every dashboard load.
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const cacheKey = `stats:${companyId}`;
    const cached = statsCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 9 tables × 5 statuses = 45 COUNT queries in parallel.
    // Each query transfers ZERO rows — only a count integer comes back.
    const countMatrix = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const counts = await Promise.all(
          STATUSES.map(async (status) => {
            const { count } = await db
              .from(cat.table)
              .select("id", { count: "exact", head: true })
              .eq("companyId", companyId)
              .eq("status", status)
              .is("deletedAt", null);
            return { status, count: count ?? 0 };
          })
        );
        return counts;
      })
    );

    const totals: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    let totalGenerated = 0;
    for (const tableCounts of countMatrix) {
      for (const { status, count } of tableCounts) {
        totals[status] = (totals[status] ?? 0) + count;
        totalGenerated += count;
      }
    }

    const result = {
      totalGenerated,
      pendingReview: totals.PENDING,
      approved: totals.APPROVED,
      rejected: totals.REJECTED,
      revised: totals.REVISED,
      published: totals.PUBLISHED,
    };

    statsCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Stats");
  }
}
