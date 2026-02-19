export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const companyInfoSchema = z.object({
  values: z.string().optional(),
  corePhilosophy: z.string().optional(),
  founders: z.string().optional(),
  history: z.string().optional(),
  achievements: z.string().optional(),
  bulkContent: z.string().optional(),
});

// GET /api/company
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const [{ data: company }, { data: info }] = await Promise.all([
      db.from("Company").select("*").eq("id", DEMO_COMPANY_ID).maybeSingle(),
      db.from("CompanyInfo").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
    ]);

    return NextResponse.json({ company, info });
  } catch (error) {
    return handleApiError(error, "Company GET");
  }
}

// PUT /api/company — upsert company info
export async function PUT(req: NextRequest) {
  try {
    const { user, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = companyInfoSchema.parse(body);

    // Ensure company exists
    await db.from("Company").upsert({ id: DEMO_COMPANY_ID, name: "My Company" }, { onConflict: "id" });

    const { data: info } = await db
      .from("CompanyInfo")
      .upsert({ companyId: DEMO_COMPANY_ID, ...data }, { onConflict: "companyId" })
      .select()
      .single();

    await logActivity(user.id, user.email || "", "company.update", "Updated company info");

    return NextResponse.json({ success: true, info });
  } catch (error) {
    return handleApiError(error, "Company PUT");
  }
}
