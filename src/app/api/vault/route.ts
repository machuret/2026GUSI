export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/vault — list vault items with pagination
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const rawPage  = parseInt(p.get("page")  ?? "1",  10);
    const rawLimit = parseInt(p.get("limit") ?? "50", 10);
    const search   = p.get("search") ?? "";
    const page  = Math.max(1, isNaN(rawPage)  ? 1  : rawPage);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = (page - 1) * limit;

    let query = db
      .from("Document")
      .select("id, filename, fileType, createdAt, content", { count: "exact" })
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (search) query = query.ilike("filename", `%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    return handleApiError(err, "Vault GET");
  }
}

// POST /api/vault — add a manual text item (ADMIN+ only)
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const { filename, content, fileType = "text", sourceUrl } = body;

    if (!filename || !content) {
      return NextResponse.json({ error: "filename and content are required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("Document")
      .insert({
        companyId: DEMO_COMPANY_ID,
        filename,
        content,
        fileType,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    return handleApiError(err, "Vault POST");
  }
}

// DELETE /api/vault?id=xxx (ADMIN+ only)
export async function DELETE(req: NextRequest) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await db
      .from("Document")
      .delete()
      .eq("id", id)
      .eq("companyId", DEMO_COMPANY_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "Vault DELETE");
  }
}
