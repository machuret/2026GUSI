export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const createSchema = z.object({
  question: z.string().min(1).max(500),
  answer:   z.string().min(1).max(5000),
  category: z.enum(["support", "sales", "general"]).default("general"),
  tags:     z.array(z.string()).optional(),
});

// GET /api/chatbots/[id]/faq
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const category = req.nextUrl.searchParams.get("category") ?? "";
    const search   = req.nextUrl.searchParams.get("search") ?? "";

    let query = db
      .from("ChatFAQ")
      .select("id, question, answer, category, tags, active, createdAt")
      .eq("botId", params.id)
      .order("createdAt", { ascending: false });

    if (category) query = query.eq("category", category);
    if (search)   query = query.ilike("question", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ faqs: data ?? [] });
  } catch (error) {
    return handleApiError(error, "FAQ GET");
  }
}

// POST /api/chatbots/[id]/faq — single or bulk array
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const parsed = items.map((item) => createSchema.parse(item));

    const rows = parsed.map((item) => ({
      ...item,
      botId: params.id,
      updatedAt: new Date().toISOString(),
    }));

    const { data, error } = await db
      .from("ChatFAQ")
      .insert(rows)
      .select("id, question, category");

    if (error) throw error;
    return NextResponse.json({ success: true, faqs: data });
  } catch (error) {
    return handleApiError(error, "FAQ POST");
  }
}

// PATCH /api/chatbots/[id]/faq — update single FAQ
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data, error } = await db
      .from("ChatFAQ")
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("botId", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, faq: data });
  } catch (error) {
    return handleApiError(error, "FAQ PATCH");
  }
}

// DELETE /api/chatbots/[id]/faq?faqId=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const faqId = req.nextUrl.searchParams.get("faqId");
    if (!faqId) return NextResponse.json({ error: "faqId required" }, { status: 400 });

    const { error } = await db
      .from("ChatFAQ")
      .delete()
      .eq("id", faqId)
      .eq("botId", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "FAQ DELETE");
  }
}
