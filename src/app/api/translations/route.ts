export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/translations — list stored translations with pagination
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const rawPage  = parseInt(p.get("page")  ?? "1",    10);
    const rawLimit = parseInt(p.get("limit") ?? "1000", 10);
    const page   = Math.max(1, isNaN(rawPage)  ? 1    : rawPage);
    const limit  = Math.min(1000, Math.max(1, isNaN(rawLimit) ? 1000 : rawLimit));
    const offset = (page - 1) * limit;
    const search   = p.get("search") ?? "";
    const language = p.get("language") ?? "";
    const status   = p.get("status") ?? "";

    let query = db
      .from("Translation")
      .select("id, title, originalText, translatedText, language, category, publishedAt, createdAt, status, feedback", { count: "exact" })
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (language) query = query.eq("language", language);
    if (status)   query = query.eq("status", status);
    if (search)   query = query.or(`title.ilike.%${search}%,translatedText.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      // Fallback: status/feedback columns may not exist yet
      const { data: fallback, error: fallbackError } = await db
        .from("Translation")
        .select("id, title, originalText, translatedText, language, category, publishedAt, createdAt", { count: "exact" })
        .eq("companyId", DEMO_COMPANY_ID)
        .order("createdAt", { ascending: false })
        .range(offset, offset + limit - 1);
      if (fallbackError) throw new Error(fallbackError.message);
      const withDefaults = (fallback ?? []).map((t) => ({ ...t, status: "draft", feedback: null }));
      return NextResponse.json({ translations: withDefaults, total: count ?? 0, page, limit });
    }
    return NextResponse.json({ translations: data ?? [], total: count ?? 0, page, limit });
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
        category: category ?? "General",
        publishedAt: publishedAt ?? new Date().toISOString(),
        status: "draft",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, translation: data });
  } catch (err) {
    return handleApiError(err, "Translations POST");
  }
}

// PATCH /api/translations?id=xxx — update status or content
export async function PATCH(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const body = await req.json();
    const allowed = ["status", "title", "translatedText", "category", "publishedAt", "feedback"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await db
      .from("Translation")
      .update(updates)
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, translation: data });
  } catch (err) {
    return handleApiError(err, "Translations PATCH");
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
