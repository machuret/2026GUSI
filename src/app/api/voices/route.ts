export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(1000).optional(),
});

// GET /api/voices — list all authors for the company
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: authors, error } = await db
      .from("Author")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    if (!authors || authors.length === 0) return NextResponse.json({ authors: [] });

    // Fetch style profiles separately — avoids FK join issues in Supabase schema cache
    const authorIds = authors.map((a) => a.id);
    const { data: profiles } = await db
      .from("AuthorStyleProfile")
      .select("authorId, tone, summary, updatedAt, tokenCount")
      .in("authorId", authorIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.authorId, p]));
    const enriched = authors.map((a) => ({
      ...a,
      AuthorStyleProfile: profileMap.has(a.id) ? [profileMap.get(a.id)] : [],
    }));

    return NextResponse.json({ authors: enriched });
  } catch (err) {
    return handleApiError(err, "Voices GET");
  }
}

// POST /api/voices — create a new author
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = createSchema.parse(body);

    // Ensure company exists
    await db.from("Company").upsert({ id: DEMO_COMPANY_ID, name: "My Company" }, { onConflict: "id", ignoreDuplicates: true });

    const { data: author, error } = await db
      .from("Author")
      .insert({ companyId: DEMO_COMPANY_ID, name: data.name, bio: data.bio ?? null })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, author });
  } catch (err) {
    return handleApiError(err, "Voices POST");
  }
}
