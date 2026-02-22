export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getLibrary } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const category = searchParams.get("category") ?? undefined;
    const status   = searchParams.get("status")   ?? undefined;
    const search   = searchParams.get("search")   ?? undefined;

    const { items, total } = await getLibrary(companyId, { page, limit, category, status, search });

    // Enrich items with their latest audit result (passed/failed/not-scanned)
    if (items.length > 0) {
      const contentIds = items.map((i) => i.id);
      const { data: auditRows } = await db
        .from("AuditResult")
        .select("contentId, passed, scannedAt")
        .in("contentId", contentIds)
        .order("scannedAt", { ascending: false });

      // Build a map: contentId → latest passed value
      const auditMap = new Map<string, boolean>();
      if (auditRows) {
        for (const row of auditRows) {
          if (!auditMap.has(row.contentId)) {
            auditMap.set(row.contentId, row.passed);
          }
        }
      }

      const enriched = items.map((item) => ({
        ...item,
        auditPassed: auditMap.has(item.id) ? auditMap.get(item.id) : null,
      }));

      return NextResponse.json({ items: enriched, total, page, limit });
    }

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    return handleApiError(error, "Library");
  }
}
