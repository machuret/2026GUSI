export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAI, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const schema = z.object({
  botId:     z.string().min(1),
  sessionId: z.string().min(1),
  message:   z.string().min(1).max(2000),
  // Lead capture fields (optional — sent when visitor submits contact form)
  leadName:  z.string().optional(),
  leadEmail: z.string().email().optional(),
  leadPhone: z.string().optional(),
  leadCompany: z.string().optional(),
});

// Classify intent as support or sales using GPT-4o-mini
async function classifyIntent(message: string, history: string): Promise<"support" | "sales" | "general"> {
  try {
    const result = await callOpenAI({
      systemPrompt: `Classify the user's intent as exactly one of: support, sales, general.
- support: troubleshooting, help with existing product/service, account issues, technical problems
- sales: pricing, buying, demos, new features, product info for purchase decisions
- general: greetings, unclear, other
Return ONLY the single word.`,
      userPrompt: `Recent conversation:\n${history}\n\nLatest message: ${message}`,
      model: "gpt-4o-mini",
      maxTokens: 10,
      temperature: 0,
      jsonMode: false,
    });
    const intent = result.trim().toLowerCase();
    if (intent === "support" || intent === "sales") return intent;
    return "general";
  } catch {
    return "general";
  }
}

// Search knowledge base for relevant docs
async function searchKnowledge(botId: string, query: string, category: string): Promise<string> {
  const { data: docs } = await db
    .from("KnowledgeBase")
    .select("title, content, category")
    .eq("botId", botId)
    .or(`category.eq.${category},category.eq.general`)
    .textSearch("searchVector", query.split(" ").filter(Boolean).join(" & "), { type: "plain" })
    .limit(4);

  if (!docs || docs.length === 0) {
    // Fallback: just get recent general docs if no search match
    const { data: fallback } = await db
      .from("KnowledgeBase")
      .select("title, content")
      .eq("botId", botId)
      .limit(3);
    if (!fallback || fallback.length === 0) return "";
    return fallback.map((d) => `## ${d.title}\n${d.content.slice(0, 800)}`).join("\n\n");
  }

  return docs.map((d) => `## ${d.title}\n${d.content.slice(0, 800)}`).join("\n\n");
}

// Detect if bot should ask for lead details
function shouldCaptureLead(messageCount: number, hasLead: boolean, reply: string): boolean {
  if (hasLead) return false;
  if (messageCount < 3) return false;
  // Trigger on every 4th message after the 3rd
  if (messageCount % 4 === 0) return true;
  // Also trigger if reply suggests escalation
  const escalationWords = ["team will", "get back to you", "contact you", "follow up", "reach out"];
  return escalationWords.some((w) => reply.toLowerCase().includes(w));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    // Verify session belongs to this bot
    const { data: session } = await db
      .from("ChatSession")
      .select("id, botId, messageCount, detectedIntent, status")
      .eq("id", data.sessionId)
      .eq("botId", data.botId)
      .maybeSingle();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status === "closed") return NextResponse.json({ error: "Session is closed" }, { status: 400 });

    // Get bot config + company info in parallel
    const [{ data: bot }, { data: companyInfo }, { data: company }] = await Promise.all([
      db.from("ChatBot").select("systemPrompt, name").eq("id", data.botId).maybeSingle(),
      db.from("CompanyInfo").select("*").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      db.from("Company").select("name, industry, website").eq("id", DEMO_COMPANY_ID).maybeSingle(),
    ]);

    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    // Build company context block from CompanyInfo (same data as companyDNA elsewhere)
    const companyContext = [
      company?.name       ? `Company: ${company.name}` : null,
      company?.industry   ? `Industry: ${company.industry}` : null,
      company?.website    ? `Website: ${company.website}` : null,
      companyInfo?.bulkContent     ? companyInfo.bulkContent : null,
      companyInfo?.values          ? `Values: ${companyInfo.values}` : null,
      companyInfo?.corePhilosophy  ? `Philosophy: ${companyInfo.corePhilosophy}` : null,
      companyInfo?.founders        ? `Founders: ${companyInfo.founders}` : null,
      companyInfo?.achievements    ? `Achievements: ${companyInfo.achievements}` : null,
    ].filter(Boolean).join("\n");

    // Handle lead capture submission
    if (data.leadName || data.leadEmail) {
      const { data: existingLead } = await db
        .from("ChatLead")
        .select("id")
        .eq("sessionId", data.sessionId)
        .maybeSingle();

      if (!existingLead) {
        await db.from("ChatLead").insert({
          sessionId: data.sessionId,
          botId: data.botId,
          name: data.leadName ?? null,
          email: data.leadEmail ?? null,
          phone: data.leadPhone ?? null,
          company: data.leadCompany ?? null,
          intent: session.detectedIntent ?? "general",
          notes: `Captured after ${session.messageCount} messages`,
        });
      }
    }

    // Fetch recent conversation history (last 10 messages)
    const { data: history } = await db
      .from("ChatMessage")
      .select("role, content")
      .eq("sessionId", data.sessionId)
      .order("createdAt", { ascending: false })
      .limit(10);

    const historyMessages = (history ?? []).reverse();
    const historyText = historyMessages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");

    // Classify intent (use cached if already detected)
    let intent = session.detectedIntent as "support" | "sales" | "general" | null;
    if (!intent || intent === "general") {
      intent = await classifyIntent(data.message, historyText);
      if (intent !== "general") {
        await db.from("ChatSession").update({ detectedIntent: intent }).eq("id", data.sessionId);
      }
    }

    // Search knowledge base
    const knowledgeContext = await searchKnowledge(data.botId, data.message, intent ?? "general");

    // Build system prompt — company info + bot persona + KB context
    const systemPrompt = [
      bot.systemPrompt,
      companyContext ? `\nCOMPANY INFORMATION:\n${companyContext}` : "",
      knowledgeContext ? `\nKNOWLEDGE BASE (use this to answer accurately):\n${knowledgeContext}` : "",
      `\nCurrent conversation intent: ${intent ?? "general"}`,
      `Guidelines:
- Be concise, warm, and professional
- Use the company information above to answer questions about the organisation accurately
- If you don't know something, say so honestly — don't make up information
- If the visitor needs urgent help you cannot provide, offer to escalate to the team
- Do NOT ask for contact details — the system handles that separately`,
    ].filter(Boolean).join("\n");

    // Build messages array for OpenAI
    const messages = historyMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    messages.push({ role: "user", content: data.message });

    // Call OpenAI with full conversation history
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL_CONFIG.generate,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`OpenAI error: ${err.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    const reply = (aiData.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.").trim();
    const promptTokens = aiData.usage?.prompt_tokens ?? 0;
    const completionTokens = aiData.usage?.completion_tokens ?? 0;

    // Save user message + assistant reply
    const newCount = (session.messageCount ?? 0) + 1;
    await Promise.all([
      db.from("ChatMessage").insert([
        { sessionId: data.sessionId, role: "user", content: data.message },
        { sessionId: data.sessionId, role: "assistant", content: reply },
      ]),
      db.from("ChatSession").update({ messageCount: newCount, updatedAt: new Date().toISOString() }).eq("id", data.sessionId),
    ]);

    logAiUsage({ model: MODEL_CONFIG.generate, feature: "chatbot", promptTokens, completionTokens });

    // Check if we should prompt for lead capture
    const { data: existingLead } = await db
      .from("ChatLead")
      .select("id")
      .eq("sessionId", data.sessionId)
      .maybeSingle();

    const askForLead = shouldCaptureLead(newCount, !!existingLead, reply);

    return NextResponse.json({
      reply,
      intent,
      messageCount: newCount,
      askForLead,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
