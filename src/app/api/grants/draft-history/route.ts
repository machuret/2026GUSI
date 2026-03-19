export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiHelpers";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/grants/draft-history?draftId=xxx — list snapshots for a draft
export async function GET(req: NextRequest) {
  try {
    const { error: authError } = requireEdgeAuth(req);
    if (authError) return authError;

    const draftId = req.nextUrl.searchParams.get("draftId");
    if (!draftId) return NextResponse.json({ error: "draftId required" }, { status: 400 });

    const { data, error } = await db
      .from("GrantDraftHistory")
      .select("id, draftId, grantName, tone, length, snapshotAt, label")
      .eq("draftId", draftId)
      .eq("companyId", DEMO_COMPANY_ID)
      .order("snapshotAt", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ history: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Draft History GET");
  }
}

// POST /api/grants/draft-history — create a snapshot
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { draftId, grantId, grantName, sections, brief, tone, length, label } = body;
    if (!draftId || !grantId || !sections) {
      return NextResponse.json({ error: "draftId, grantId, sections required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("GrantDraftHistory")
      .insert({
        draftId,
        companyId: DEMO_COMPANY_ID,
        grantId,
        grantName,
        sections,
        brief: brief ?? null,
        tone: tone ?? "first_person",
        length: length ?? "standard",
        label: label ?? null,
      })
      .select("id, snapshotAt")
      .single();

    if (error) throw error;

    // Keep only the last 10 snapshots per draft to avoid unbounded growth
    const { data: all } = await db
      .from("GrantDraftHistory")
      .select("id, snapshotAt")
      .eq("draftId", draftId)
      .eq("companyId", DEMO_COMPANY_ID)
      .order("snapshotAt", { ascending: false });

    if (all && all.length > 10) {
      const toDelete = all.slice(10).map((r: { id: string }) => r.id);
      await db.from("GrantDraftHistory").delete().in("id", toDelete);
    }

    return NextResponse.json({ snapshot: data });
  } catch (err) {
    return handleApiError(err, "Draft History POST");
  }
}
