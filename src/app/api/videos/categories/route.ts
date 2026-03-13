export const runtime = "edge";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  color: z.string().default("#6366f1"),
  sortOrder: z.number().int().default(0),
});

// GET /api/videos/categories — list all categories
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("VideoCategory")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("sortOrder", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    return handleApiError(err, "VideoCategories GET");
  }
}

// POST /api/videos/categories — create a category
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
      .from("VideoCategory")
      .insert({ ...parsed.data, companyId: DEMO_COMPANY_ID })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (err) {
    return handleApiError(err, "VideoCategories POST");
  }
}
