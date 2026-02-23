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

    const typeProfileCount = Object.keys(analysis.byContentType).length;

    const { data: styleProfile } = await db
      .from("StyleProfile")
      .upsert({
        companyId,
        tone: analysis.global.tone,
        vocabulary: analysis.global.vocabulary,
        avgWordCount: analysis.global.avgWordCount,
        commonPhrases: analysis.global.commonPhrases,
        preferredFormats: analysis.global.preferredFormats,
        summary: analysis.global.summary,
        byContentType: analysis.byContentType,
        updatedAt: new Date().toISOString(),
      }, { onConflict: "companyId" })
      .select()
      .single();

    await logActivity(
      authUser.id, authUser.email || "", "style.analyze",
      `Style analysis: global + ${typeProfileCount} content-type profiles`
    );

    return NextResponse.json({ success: true, styleProfile, typeProfileCount });
  } catch (error) {
    return handleApiError(error, "Style analyze");
  }
}
