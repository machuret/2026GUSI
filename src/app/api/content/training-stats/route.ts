export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

const CONTENT_TYPES = [
  "blog", "newsletter", "announcement", "linkedin",
  "facebook", "instagram", "twitter", "email", "press-release", "case-study",
];

export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

    const [postsRes, styleRes] = await Promise.all([
      db.from("ContentPost").select("*").eq("companyId", companyId),
      db.from("StyleProfile").select("*").eq("companyId", companyId).maybeSingle(),
    ]);

    const posts = postsRes.data ?? [];
    const styleProfile = styleRes.data;

    const totalPosts = posts.length;
    const totalWords = posts.reduce((sum: number, p: any) => sum + (p.body?.split(/\s+/).length ?? 0), 0);
    const avgWords = totalPosts > 0 ? Math.round(totalWords / totalPosts) : 0;

    // Coverage per content type
    const coverage: Record<string, number> = {};
    for (const ct of CONTENT_TYPES) {
      coverage[ct] = posts.filter((p: any) => p.contentType === ct).length;
    }

    // Readiness score (0-100)
    // 10 posts = 50 pts, 30 posts = 100 pts, style profile = +20 pts bonus
    const postScore = Math.min(50, Math.round((totalPosts / 30) * 50));
    const varietyScore = Math.min(30, Object.values(coverage).filter((v) => v > 0).length * 3);
    const styleScore = styleProfile ? 20 : 0;
    const readiness = Math.min(100, postScore + varietyScore + styleScore);

    // Recommendations
    const recommendations: string[] = [];
    if (totalPosts < 5) recommendations.push("Add at least 5 posts to start training — more variety = better results");
    else if (totalPosts < 15) recommendations.push(`${15 - totalPosts} more posts will significantly improve output quality`);
    if (!styleProfile) recommendations.push("Run Style Analysis to activate your writing fingerprint");
    const missingTypes = CONTENT_TYPES.filter((ct) => !coverage[ct]);
    if (missingTypes.length > 6) recommendations.push("Add examples from more content types for broader coverage");

    return NextResponse.json({
      success: true,
      totalPosts,
      totalWords,
      avgWords,
      coverage,
      readiness,
      styleProfile,
      recommendations,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
