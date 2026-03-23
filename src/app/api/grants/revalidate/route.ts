export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const schema = z.object({ grantId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = requireEdgeAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { grantId } = parsed.data;

    // Forward auth headers from the original request to the edge function
    const authorization = req.headers.get("authorization") ?? "";

    const res = await fetch(`${SUPABASE_URL}/functions/v1/grant-revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ grantId }),
      signal: AbortSignal.timeout(45000),
    });

    // Supabase returns HTML (not JSON) when the edge function is not deployed.
    // Detect this before calling res.json() to avoid an unhandled parse crash.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      const isNotDeployed = res.status === 404 || text.includes("Function not found") || text.includes("<!DOCTYPE");
      return NextResponse.json(
        isNotDeployed
          ? { error: "Revalidation service is not deployed. Run: supabase functions deploy grant-revalidate", deployed: false }
          : { error: `Revalidation service returned an unexpected response (HTTP ${res.status})` },
        { status: 503 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    // AbortSignal.timeout() throws a DOMException with name "TimeoutError"
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    if (isTimeout) {
      return NextResponse.json(
        { error: "Revalidation timed out (45s). The grant-revalidate edge function may be overloaded or unreachable." },
        { status: 504 }
      );
    }
    return handleApiError(err, "Grant Revalidate");
  }
}
