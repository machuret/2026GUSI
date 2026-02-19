export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const grantSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  founder: z.string().optional(),
  url: z.string().optional(),
  deadlineDate: z.string().optional().nullable(),
  howToApply: z.string().optional(),
  geographicScope: z.string().optional(),
  eligibility: z.string().optional(),
  amount: z.string().optional(),
  projectDuration: z.string().optional(),
  fitScore: z.number().int().min(1).max(5).optional().nullable(),
  submissionEffort: z.enum(["Low", "Medium", "High"]).optional().nullable(),
  decision: z.enum(["Apply", "Maybe", "No"]).optional().nullable(),
  notes: z.string().optional(),
});

// GET /api/grants?companyId=xxx
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

    const { data, error } = await db
      .from("Grant")
      .select("*")
      .eq("companyId", companyId)
      .order("deadlineDate", { ascending: true, nullsFirst: false });

    if (error) throw error;
    return NextResponse.json({ grants: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Get Grants");
  }
}

// POST /api/grants
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = grantSchema.parse(body);

    const { data: grant, error } = await db
      .from("Grant")
      .insert({ ...data, updatedAt: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, grant });
  } catch (error) {
    return handleApiError(error, "Create Grant");
  }
}
