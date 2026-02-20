export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const createSchema = z.object({
  rule:     z.string().min(1).max(1000),
  category: z.enum(["behaviour", "tone", "escalation", "restriction"]).default("behaviour"),
  priority: z.number().int().min(0).max(100).default(50),
});

// GET /api/chatbots/[id]/rules
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("ChatBotRule")
      .select("id, rule, category, priority, active, createdAt")
      .eq("botId", params.id)
      .order("priority", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ rules: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Rules GET");
  }
}

// POST /api/chatbots/[id]/rules
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const parsed = items.map((item) => createSchema.parse(item));

    const rows = parsed.map((item) => ({ ...item, botId: params.id }));
    const { data, error } = await db.from("ChatBotRule").insert(rows).select("id, rule, category, priority");
    if (error) throw error;
    return NextResponse.json({ success: true, rules: data });
  } catch (error) {
    return handleApiError(error, "Rules POST");
  }
}

// PATCH /api/chatbots/[id]/rules — toggle active or update
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data, error } = await db
      .from("ChatBotRule")
      .update(updates)
      .eq("id", id)
      .eq("botId", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, rule: data });
  } catch (error) {
    return handleApiError(error, "Rules PATCH");
  }
}

// DELETE /api/chatbots/[id]/rules?ruleId=xxx
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const ruleId = req.nextUrl.searchParams.get("ruleId");
    if (!ruleId) return NextResponse.json({ error: "ruleId required" }, { status: 400 });

    const { error } = await db.from("ChatBotRule").delete().eq("id", ruleId).eq("botId", params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Rules DELETE");
  }
}
