export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  name:           z.string().min(1).max(100),
  systemPrompt:   z.string().min(10).max(4000),
  widgetTitle:    z.string().max(60).default("Chat with us"),
  widgetColor:    z.string().default("#7c3aed"),
  avatarEmoji:    z.string().max(4).default("🤖"),
  welcomeMessage: z.string().max(300).default("Hi! How can I help you today?"),
});

// GET /api/chatbots
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: bots } = await db
      .from("ChatBot")
      .select("id, name, widgetTitle, widgetColor, avatarEmoji, welcomeMessage, apiKey, active, createdAt")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    // Enrich with session/lead counts
    const enriched = await Promise.all((bots ?? []).map(async (bot) => {
      const [{ count: sessions }, { count: leads }] = await Promise.all([
        db.from("ChatSession").select("id", { count: "exact", head: true }).eq("botId", bot.id),
        db.from("ChatLead").select("id", { count: "exact", head: true }).eq("botId", bot.id),
      ]);
      return { ...bot, sessionCount: sessions ?? 0, leadCount: leads ?? 0 };
    }));

    return NextResponse.json({ bots: enriched });
  } catch (error) {
    return handleApiError(error, "Chatbots GET");
  }
}

// POST /api/chatbots
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = createSchema.parse(body);

    const { data: bot, error } = await db
      .from("ChatBot")
      .insert({ ...data, companyId: DEMO_COMPANY_ID, updatedAt: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, bot });
  } catch (error) {
    return handleApiError(error, "Chatbots POST");
  }
}
