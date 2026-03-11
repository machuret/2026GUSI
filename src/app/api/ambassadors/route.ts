export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
});

// GET /api/ambassadors — list all (public, no auth needed for active ones)
export async function GET(req: NextRequest) {
  try {
    const showAll = req.nextUrl.searchParams.get("all") === "true";

    if (showAll) {
      // Admin view — requires admin role
      const { response: authError } = await requireAdminAuth();
      if (authError) return authError;

      const { data, error } = await db
        .from("Ambassador")
        .select("*")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("sortOrder", { ascending: true })
        .order("createdAt", { ascending: false });

      if (error) throw error;
      return NextResponse.json({ ambassadors: data ?? [] });
    }

    // Public view — only active ambassadors
    const { data, error } = await db
      .from("Ambassador")
      .select("id, name, title, bio, photoUrl, slug, linkedinUrl, websiteUrl")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("active", true)
      .order("sortOrder", { ascending: true })
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ambassadors: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Ambassadors GET");
  }
}

// POST /api/ambassadors — create (admin only)
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = createSchema.parse(body);

    // Check slug uniqueness
    const { data: existing } = await db
      .from("Ambassador")
      .select("id")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("slug", parsed.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data, error } = await db
      .from("Ambassador")
      .insert({
        companyId: DEMO_COMPANY_ID,
        ...parsed,
        photoUrl: parsed.photoUrl || null,
        linkedinUrl: parsed.linkedinUrl || null,
        websiteUrl: parsed.websiteUrl || null,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, ambassador: data });
  } catch (error) {
    return handleApiError(error, "Ambassadors POST");
  }
}
