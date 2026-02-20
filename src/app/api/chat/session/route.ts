export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const schema = z.object({
  botId:     z.string().min(1),
  visitorId: z.string().min(1),
  lang:      z.enum(["en", "es"]).default("en"),
});

// POST /api/chat/session — create or resume a session for a visitor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { botId, visitorId, lang } = schema.parse(body);

    // Verify bot exists and is active
    const { data: bot } = await db
      .from("ChatBot")
      .select("id, name, widgetTitle, welcomeMessage, widgetColor, avatarEmoji")
      .eq("id", botId)
      .eq("active", true)
      .maybeSingle();

    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    // Find existing active session for this visitor+bot
    const { data: existing } = await db
      .from("ChatSession")
      .select("id, status, messageCount, detectedIntent")
      .eq("botId", botId)
      .eq("visitorId", visitorId)
      .eq("status", "active")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Fetch last 20 messages for this session
      const { data: messages } = await db
        .from("ChatMessage")
        .select("id, role, content, createdAt")
        .eq("sessionId", existing.id)
        .order("createdAt", { ascending: true })
        .limit(20);

      return NextResponse.json({
        sessionId: existing.id,
        isNew: false,
        messageCount: existing.messageCount,
        detectedIntent: existing.detectedIntent,
        messages: messages ?? [],
        bot: { name: bot.name, widgetTitle: bot.widgetTitle, widgetColor: bot.widgetColor, avatarEmoji: bot.avatarEmoji, welcomeMessage: bot.welcomeMessage },
      }, { headers: CORS_HEADERS });
    }

    // Create new session
    const { data: session, error } = await db
      .from("ChatSession")
      .insert({ botId, visitorId, status: "active", messageCount: 0, lang })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      sessionId: session.id,
      isNew: true,
      messageCount: 0,
      detectedIntent: null,
      messages: [],
      bot: { name: bot.name, widgetTitle: bot.widgetTitle, widgetColor: bot.widgetColor, avatarEmoji: bot.avatarEmoji, welcomeMessage: bot.welcomeMessage },
    }, { headers: CORS_HEADERS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500, headers: CORS_HEADERS });
  }
}
