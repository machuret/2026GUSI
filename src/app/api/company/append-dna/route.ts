export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logActivity } from "@/lib/activity";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const schema = z.object({
  appendText: z.string().min(1).max(10000),
});

// POST /api/company/append-dna — append compiled lessons to Writing DNA
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { appendText } = schema.parse(body);

    // Fetch current CompanyInfo
    const { data: info } = await db
      .from("CompanyInfo")
      .select("bulkContent")
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();

    const currentDna = info?.bulkContent ?? "";
    const updatedDna = currentDna + appendText;

    await db
      .from("CompanyInfo")
      .upsert({
        companyId: DEMO_COMPANY_ID,
        bulkContent: updatedDna,
      }, { onConflict: "companyId" });

    await logActivity(
      authUser.id,
      authUser.email || "",
      "company.append_dna",
      `Appended ${appendText.length} chars to Writing DNA from compiled lessons`
    );

    return NextResponse.json({ success: true, newLength: updatedDna.length });
  } catch (error) {
    return handleApiError(error, "Append DNA");
  }
}
