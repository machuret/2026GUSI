export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("FunderTemplate")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("funderName", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Funder Templates GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { funderName, preferences, patterns, avoid, notes } = body;
    if (!funderName?.trim()) return NextResponse.json({ error: "funderName required" }, { status: 400 });

    const { data: existing } = await db
      .from("FunderTemplate")
      .select("id")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("funderName", funderName.trim())
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await db
        .from("FunderTemplate")
        .update({ preferences, patterns, avoid, notes, updatedAt: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await db
        .from("FunderTemplate")
        .insert({ companyId: DEMO_COMPANY_ID, funderName: funderName.trim(), preferences, patterns, avoid, notes })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ template: result });
  } catch (err) {
    return handleApiError(err, "Funder Templates POST");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await db
      .from("FunderTemplate")
      .delete()
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Funder Templates DELETE");
  }
}
