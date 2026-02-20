export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const createSchema = z.object({
  title:    z.string().min(1).max(200),
  content:  z.string().min(1).max(50000),
  category: z.enum(["support", "sales", "general"]).default("general"),
  source:   z.enum(["manual", "url", "upload", "vault"]).default("manual"),
  sourceUrl: z.string().url().optional(),
});

// GET /api/chatbots/[id]/knowledge
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const search = req.nextUrl.searchParams.get("search") ?? "";
    const category = req.nextUrl.searchParams.get("category") ?? "";

    let query = db
      .from("KnowledgeBase")
      .select("id, title, category, source, sourceUrl, createdAt, updatedAt")
      .eq("botId", params.id)
      .order("createdAt", { ascending: false });

    if (category) query = query.eq("category", category);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Knowledge GET");
  }
}

// POST /api/chatbots/[id]/knowledge
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

    // Support bulk import (array) or single item
    const items = Array.isArray(body) ? body : [body];
    const parsed = items.map((item) => createSchema.parse(item));

    const rows = parsed.map((item) => ({
      ...item,
      botId: params.id,
      updatedAt: new Date().toISOString(),
    }));

    const { data, error } = await db
      .from("KnowledgeBase")
      .insert(rows)
      .select("id, title, category, source");

    if (error) throw error;
    return NextResponse.json({ success: true, items: data });
  } catch (error) {
    return handleApiError(error, "Knowledge POST");
  }
}

// DELETE /api/chatbots/[id]/knowledge?itemId=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    const { error } = await db
      .from("KnowledgeBase")
      .delete()
      .eq("id", itemId)
      .eq("botId", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Knowledge DELETE");
  }
}
