export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeCompanyStyle } from "@/lib/styleAnalyzer";
import { logActivity } from "@/lib/activity";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const analyzeSchema = z.object({
  companyId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { companyId } = analyzeSchema.parse(body);

    const { data: company } = await db.from("Company").select("id").eq("id", companyId).maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const analysis = await analyzeCompanyStyle(companyId);

    const { data: styleProfile } = await db
      .from("StyleProfile")
      .upsert({
        companyId,
        tone: analysis.tone,
        vocabulary: analysis.vocabulary,
        avgWordCount: analysis.avgWordCount,
        commonPhrases: analysis.commonPhrases,
        preferredFormats: analysis.preferredFormats,
        summary: analysis.summary,
        updatedAt: new Date().toISOString(),
      }, { onConflict: "companyId" })
      .select()
      .single();

    await logActivity(authUser.id, authUser.email || "", "style.analyze", `Style analysis for company ${companyId}`);

    return NextResponse.json({ success: true, styleProfile });
  } catch (error) {
    return handleApiError(error, "Style analyze");
  }
}
