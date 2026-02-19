export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/ai-usage?period=30d — aggregated AI cost stats
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const period = req.nextUrl.searchParams.get("period") ?? "30d";
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await db
      .from("AiUsageLog")
      .select("model, feature, promptTokens, completionTokens, totalTokens, costUsd, createdAt")
      .eq("companyId", DEMO_COMPANY_ID)
      .gte("createdAt", since)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    const logs = rows ?? [];

    // Aggregate totals
    const totalTokens   = logs.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const totalCostUsd  = logs.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);
    const totalCalls    = logs.length;

    // By feature
    const byFeature: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
    for (const r of logs) {
      const f = r.feature ?? "unknown";
      if (!byFeature[f]) byFeature[f] = { calls: 0, tokens: 0, costUsd: 0 };
      byFeature[f].calls++;
      byFeature[f].tokens  += r.totalTokens ?? 0;
      byFeature[f].costUsd += Number(r.costUsd ?? 0);
    }

    // By model
    const byModel: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
    for (const r of logs) {
      const m = r.model ?? "unknown";
      if (!byModel[m]) byModel[m] = { calls: 0, tokens: 0, costUsd: 0 };
      byModel[m].calls++;
      byModel[m].tokens  += r.totalTokens ?? 0;
      byModel[m].costUsd += Number(r.costUsd ?? 0);
    }

    // Daily breakdown (last N days)
    const byDay: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
    for (const r of logs) {
      const day = r.createdAt.slice(0, 10);
      if (!byDay[day]) byDay[day] = { calls: 0, tokens: 0, costUsd: 0 };
      byDay[day].calls++;
      byDay[day].tokens  += r.totalTokens ?? 0;
      byDay[day].costUsd += Number(r.costUsd ?? 0);
    }

    return NextResponse.json({
      period,
      days,
      totalCalls,
      totalTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      byFeature,
      byModel,
      byDay,
    });
  } catch (err) {
    return handleApiError(err, "AI Usage GET");
  }
}
