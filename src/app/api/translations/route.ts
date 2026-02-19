export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/translations — list stored translations
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("Translation")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ translations: data ?? [] });
  } catch (err) {
    return handleApiError(err, "Translations GET");
  }
}

// POST /api/translations — save a translation
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { title, originalText, translatedText, language, category, publishedAt } = body;

    if (!title || !translatedText || !language) {
      return NextResponse.json({ error: "title, translatedText and language are required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("Translation")
      .insert({
        companyId: DEMO_COMPANY_ID,
        title,
        originalText: originalText ?? "",
        translatedText,
        language,
        category: category ?? "general",
        publishedAt: publishedAt ?? new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, translation: data });
  } catch (err) {
    return handleApiError(err, "Translations POST");
  }
}

// DELETE /api/translations?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await db
      .from("Translation")
      .delete()
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Translations DELETE");
  }
}
