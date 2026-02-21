export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

type CheckResult = { ok: boolean; latencyMs?: number; detail?: string; error?: string };

async function testOpenAI(): Promise<CheckResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "OPENAI_API_KEY not set in environment" };
  try {
    const t0 = Date.now();
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    return { ok: true, latencyMs, detail: "Connected — key is valid" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
  }
}

async function testApify(): Promise<CheckResult> {
  const key = process.env.APIFY_API_TOKEN;
  if (!key) return { ok: false, error: "APIFY_API_TOKEN not set in environment" };
  try {
    const t0 = Date.now();
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${key}`, {
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, latencyMs, detail: `Connected — ${data.data?.username ?? "user ok"}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
  }
}

async function testMailchimp(): Promise<CheckResult> {
  try {
    const { data } = await db
      .from("MailchimpConnection")
      .select("apiKey, dataCenter, accountName")
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();

    if (!data?.apiKey) return { ok: false, error: "No Mailchimp API key connected" };

    const t0 = Date.now();
    const res = await fetch(`https://${data.dataCenter}.api.mailchimp.com/3.0/`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${data.apiKey}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    return { ok: true, latencyMs, detail: `Connected — ${data.accountName}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
  }
}

async function testSupabase(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Supabase env vars not set" };
  try {
    const t0 = Date.now();
    const { error } = await db.from("Company").select("id").limit(1);
    const latencyMs = Date.now() - t0;
    if (error) return { ok: false, latencyMs, error: error.message };
    return { ok: true, latencyMs, detail: "Connected — database reachable" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
  }
}

// GET /api/settings/api-test?service=openai|apify|mailchimp|supabase|all
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireSuperAdminAuth();
    if (authError) return authError;

    const service = req.nextUrl.searchParams.get("service") ?? "all";

    const results: Record<string, CheckResult> = {};

    if (service === "all" || service === "openai")   results.openai   = await testOpenAI();
    if (service === "all" || service === "apify")    results.apify    = await testApify();
    if (service === "all" || service === "mailchimp") results.mailchimp = await testMailchimp();
    if (service === "all" || service === "supabase") results.supabase = await testSupabase();

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error, "API Test");
  }
}
