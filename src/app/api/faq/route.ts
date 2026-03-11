export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

// GET /api/faq
export async function GET(req: NextRequest) {
  try {
    const showAll = req.nextUrl.searchParams.get("all") === "true";

    if (showAll) {
      const { response: authError } = await requireAuth();
      if (authError) return authError;

      const { data, error } = await db
        .from("Faq")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("sortOrder", { ascending: true })
        .order("createdAt", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ faqs: data ?? [] });
    }

    const { data, error } = await db
      .from("Faq")
      .select("id, question, answer, category, sortOrder")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("active", true)
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ faqs: data ?? [] });
  } catch (error) {
    return handleApiError(error, "FAQ GET");
  }
}

// POST /api/faq
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = createSchema.parse(body);

    const now = new Date().toISOString();
    const { data, error } = await db
      .from("Faq")
      .insert({
        companyId: DEMO_COMPANY_ID,
        ...parsed,
        category: parsed.category || null,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, faq: data });
  } catch (error) {
    return handleApiError(error, "FAQ POST");
  }
}
