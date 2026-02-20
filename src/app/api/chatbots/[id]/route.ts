export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const updateSchema = z.object({
  name:                z.string().min(1).max(100).optional(),
  systemPrompt:        z.string().min(10).max(4000).optional(),
  widgetTitle:         z.string().max(60).optional(),
  widgetColor:         z.string().optional(),
  avatarEmoji:         z.string().max(4).optional(),
  welcomeMessage:      z.string().max(300).optional(),
  active:              z.boolean().optional(),
  // Widget style
  widgetPosition:      z.enum(["bottom-right", "bottom-left"]).optional(),
  widgetBorderRadius:  z.number().int().min(0).max(24).optional(),
  widgetFontSize:      z.number().int().min(12).max(18).optional(),
  headerTextColor:     z.string().optional(),
  botBubbleColor:      z.string().optional(),
  botTextColor:        z.string().optional(),
  userBubbleColor:     z.string().optional(),
  userTextColor:       z.string().optional(),
  showBranding:        z.boolean().optional(),
  placeholderText:     z.string().max(80).optional(),
  windowHeight:        z.number().int().min(400).max(700).optional(),
  windowWidth:         z.number().int().min(300).max(480).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: bot } = await db
      .from("ChatBot")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ bot });
  } catch (error) {
    return handleApiError(error, "Chatbot GET");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = updateSchema.parse(body);

    const { data: bot, error } = await db
      .from("ChatBot")
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, bot });
  } catch (error) {
    return handleApiError(error, "Chatbot PATCH");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { error } = await db.from("ChatBot").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Chatbot DELETE");
  }
}
