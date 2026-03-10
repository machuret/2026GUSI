export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  grantName: z.string().default(""),
  funder: z.string().default(""),
  amount: z.string().default(""),
  outcome: z.string().default(""),
  section: z.string().default(""),
  content: z.string().min(1, "Content is required"),
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

// GET /api/grants/examples — list all examples
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("GrantExample")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("updatedAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ examples: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Grant Examples GET");
  }
}

// POST /api/grants/examples — create new example
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { data, error } = await db
      .from("GrantExample")
      .insert({ ...parsed.data, companyId: DEMO_COMPANY_ID })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, example: data });
  } catch (err) {
    return handleApiError(err, "Grant Examples POST");
  }
}
