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
      .select("*, AuthorStyleProfile(tone, summary, updatedAt, tokenCount)")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ authors: authors ?? [] });
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
