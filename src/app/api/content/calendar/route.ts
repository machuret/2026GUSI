export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

// GET /api/content/calendar?companyId=xxx&from=ISO&to=ISO
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = req.nextUrl.searchParams.get("companyId");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }

    // Fetch approved + scheduled content from all 9 tables in parallel
    const results = await Promise.all(
      CATEGORIES.map(async (cat) => {
        let query = db
          .from(cat.table)
          .select("id, companyId, prompt, output, status, scheduledAt, publishedAt, createdAt")
          .eq("companyId", companyId)
          .in("status", ["APPROVED", "PUBLISHED"]);

        if (from) query = query.gte("scheduledAt", from);
        if (to) query = query.lte("scheduledAt", to);

        const { data: items } = await query.order("scheduledAt", { ascending: true, nullsFirst: false });

        return (items ?? []).map((item) => ({
          ...item,
          category: cat.key,
          categoryLabel: cat.label,
        }));
      })
    );

    const all = results.flat().sort((a, b) => {
      const aDate = a.scheduledAt ?? a.createdAt;
      const bDate = b.scheduledAt ?? b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    return NextResponse.json({ items: all });
  } catch (error) {
    return handleApiError(error, "Calendar");
  }
}
