export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";

// GET /api/chatbots/[id]/conversations
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const sessionId = req.nextUrl.searchParams.get("sessionId");

    // If sessionId provided, return full transcript
    if (sessionId) {
      const [{ data: session }, { data: messages }, { data: lead }] = await Promise.all([
        db.from("ChatSession").select("*").eq("id", sessionId).maybeSingle(),
        db.from("ChatMessage").select("*").eq("sessionId", sessionId).order("createdAt", { ascending: true }),
        db.from("ChatLead").select("*").eq("sessionId", sessionId).maybeSingle(),
      ]);
      return NextResponse.json({ session, messages: messages ?? [], lead });
    }

    // List all sessions for this bot
    const { data: sessions, error } = await db
      .from("ChatSession")
      .select("id, visitorId, status, detectedIntent, messageCount, createdAt, updatedAt")
      .eq("botId", params.id)
      .order("updatedAt", { ascending: false })
      .limit(100);

    if (error) throw error;

    // Enrich with lead info
    const enriched = await Promise.all((sessions ?? []).map(async (s) => {
      const { data: lead } = await db
        .from("ChatLead")
        .select("name, email, phone, company")
        .eq("sessionId", s.id)
        .maybeSingle();
      return { ...s, lead };
    }));

    return NextResponse.json({ sessions: enriched });
  } catch (error) {
    return handleApiError(error, "Conversations GET");
  }
}

// PATCH /api/chatbots/[id]/conversations — update session status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { sessionId, status } = await req.json();
    if (!sessionId || !["active", "closed", "escalated"].includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await db.from("ChatSession").update({ status, updatedAt: new Date().toISOString() }).eq("id", sessionId).eq("botId", params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Conversations PATCH");
  }
}
