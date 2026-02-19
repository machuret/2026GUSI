export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — system health check for monitoring / CFO dashboard
export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  const start = Date.now();

  // 1. Database
  try {
    const t0 = Date.now();
    const { error } = await db.from("Company").select("id").limit(1);
    checks.database = { ok: !error, latencyMs: Date.now() - t0, ...(error ? { error: error.message } : {}) };
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }

  // 2. OpenAI API key present
  const hasKey = !!process.env.OPENAI_API_KEY;
  checks.openai_key = { ok: hasKey, ...(!hasKey ? { error: "OPENAI_API_KEY not set" } : {}) };

  // 3. OpenAI reachability (lightweight models list — no tokens consumed)
  if (hasKey) {
    try {
      const t0 = Date.now();
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.openai_api = { ok: res.ok, latencyMs: Date.now() - t0, ...(!res.ok ? { error: `HTTP ${res.status}` } : {}) };
    } catch (err) {
      checks.openai_api = { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
    }
  } else {
    checks.openai_api = { ok: false, error: "Key not configured" };
  }

  // 4. Supabase env vars
  checks.supabase_config = {
    ok: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    ...(!process.env.NEXT_PUBLIC_SUPABASE_URL ? { error: "NEXT_PUBLIC_SUPABASE_URL missing" } : {}),
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const totalMs = Date.now() - start;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      totalMs,
      checks,
      version: process.env.npm_package_version ?? "unknown",
    },
    { status: allOk ? 200 : 503 }
  );
}
