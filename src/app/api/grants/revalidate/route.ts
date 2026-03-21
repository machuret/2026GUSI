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
    const { grantId } = schema.parse(body);

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
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return handleApiError(err, "Grant Revalidate");
  }
}
