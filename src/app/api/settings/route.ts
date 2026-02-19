export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/settings?key=xxx
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

    const { data, error } = await db
      .from("Setting")
      .select("value")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("key", key)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return NextResponse.json({ value: data?.value ?? null });
  } catch (err) {
    return handleApiError(err, "Settings GET");
  }
}

// PUT /api/settings — upsert { key, value }
export async function PUT(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

    const { error } = await db
      .from("Setting")
      .upsert(
        { companyId: DEMO_COMPANY_ID, key, value: value ?? "", updatedAt: new Date().toISOString() },
        { onConflict: "companyId,key" }
      );

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Settings PUT");
  }
}
