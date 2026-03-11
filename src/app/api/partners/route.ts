export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  url: z.string().url().optional().or(z.literal("")),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

// GET /api/partners
export async function GET(req: NextRequest) {
  try {
    const showAll = req.nextUrl.searchParams.get("all") === "true";

    if (showAll) {
      const { response: authError } = await requireAuth();
      if (authError) return authError;

      const { data, error } = await db
        .from("Partner")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("sortOrder", { ascending: true })
        .order("createdAt", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ partners: data ?? [] });
    }

    const { data, error } = await db
      .from("Partner")
      .select("id, name, description, logoUrl, url, slug")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("active", true)
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ partners: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Partners GET");
  }
}

// POST /api/partners
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = createSchema.parse(body);

    const { data: existing } = await db
      .from("Partner")
      .select("id")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("slug", parsed.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from("Partner")
      .insert({
        companyId: DEMO_COMPANY_ID,
        ...parsed,
        logoUrl: parsed.logoUrl || null,
        url: parsed.url || null,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, partner: data });
  } catch (error) {
    return handleApiError(error, "Partners POST");
  }
}
