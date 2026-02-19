export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdminAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/vault — list all vault items
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("Document")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ items: data ?? [] });
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
