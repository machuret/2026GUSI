export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireAuth, requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const companyInfoSchema = z.object({
  companyName:  z.string().optional(),
  website:      z.string().optional(),
  linkedinUrl:  z.string().optional(),
  youtubeUrl:   z.string().optional(),
  facebookUrl:  z.string().optional(),
  hashtags:     z.string().optional(),
  products:     z.string().optional(),
  values:       z.string().optional(),
  corePhilosophy: z.string().optional(),
  founders:     z.string().optional(),
  history:      z.string().optional(),
  achievements: z.string().optional(),
  bulkContent:  z.string().optional(),
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

// PUT /api/company — upsert company info (ADMIN+ only)
export async function PUT(req: NextRequest) {
  try {
    const { user, response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = companyInfoSchema.parse(body);

    // Upsert Company row (name + website from form)
    const companyPatch: Record<string, string> = { id: DEMO_COMPANY_ID, name: data.companyName || "My Company" };
    if (data.website) companyPatch.website = data.website;
    const { error: companyError } = await db
      .from("Company")
      .upsert(companyPatch, { onConflict: "id" });
    if (companyError) throw new Error(`Company upsert failed: ${companyError.message}`);

    // Upsert CompanyInfo (all fields)
    const { companyName: _n, ...infoData } = data;
    const { data: info, error: upsertError } = await db
      .from("CompanyInfo")
      .upsert({ companyId: DEMO_COMPANY_ID, ...infoData }, { onConflict: "companyId" })
      .select()
      .single();

    if (upsertError) throw new Error(`CompanyInfo upsert failed: ${upsertError.message}`);

    await logActivity(user.id, user.email || "", "company.update", "Updated company info");

    return NextResponse.json({ success: true, info });
  } catch (error) {
    return handleApiError(error, "Company PUT");
  }
}
