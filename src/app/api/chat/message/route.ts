export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { getVaultContext, getLessonsContext } from "@/lib/aiContext";
import { z } from "zod";

// gpt-4o-mini: 10x cheaper than gpt-4o, fast enough for chat
const CHAT_MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const schema = z.object({
  botId:       z.string().min(1),
  sessionId:   z.string().min(1),
  message:     z.string().min(1).max(2000),
  lang:        z.enum(["es", "en"]).default("en"),
  leadName:    z.string().max(200).optional(),
  leadEmail:   z.string().email().optional(),
  leadPhone:   z.string().max(50).optional(),
  leadCompany: z.string().max(200).optional(),
});

// Safe Postgres FTS query — returns null if no usable words
function buildTsQuery(text: string): string | null {
  const words = text.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 8);
  return words.length > 0 ? words.join(" & ") : null;
}

// Classify intent with gpt-4o-mini (cheap + fast)
async function classifyIntent(message: string, historyText: string): Promise<"support" | "sales" | "general"> {
  try {
    const result = await callOpenAIWithUsage({
      systemPrompt: `Classify the visitor's intent as exactly one of: support, sales, general.
- support: troubleshooting, existing product help, account issues, technical problems
- sales: pricing, buying, demos, new features, product info for purchase decisions
- general: greetings, unclear, off-topic
Return ONLY the single word, lowercase.`,
      userPrompt: `Conversation:\n${historyText || "(none)"}\n\nLatest: ${message}`,
      model: CHAT_MODEL,
      maxTokens: 5,
      temperature: 0,
      jsonMode: false,
    });
    const intent = result.content.trim().toLowerCase();
    if (intent === "support" || intent === "sales") return intent;
    return "general";
  } catch {
    return "general";
  }
}

// Search bot KB — falls back to top-3 articles if no FTS match
async function searchKnowledge(botId: string, query: string, intent: string): Promise<string> {
  const tsQuery = buildTsQuery(query);
  let docs: { title: string; content: string }[] | null = null;

  if (tsQuery) {
    const { data } = await db
      .from("KnowledgeBase")
      .select("title, content")
      .eq("botId", botId)
      .or(`category.eq.${intent},category.eq.general`)
      .textSearch("searchVector", tsQuery, { type: "plain" })
      .limit(3);
    docs = data;
  }
  if (!docs || docs.length === 0) {
    const { data: fallback } = await db.from("KnowledgeBase").select("title, content").eq("botId", botId).limit(3);
    docs = fallback;
  }
  if (!docs || docs.length === 0) return "";
  return docs.map((d) => `### ${d.title}\n${d.content.slice(0, 800)}`).join("\n\n");
}

// Search FAQs for verbatim Q&A pairs
async function searchFAQs(botId: string, query: string, intent: string): Promise<string> {
  const tsQuery = buildTsQuery(query);
  if (!tsQuery) return "";
  const { data: faqs } = await db
    .from("ChatFAQ")
    .select("question, answer")
    .eq("botId", botId)
    .eq("active", true)
    .or(`category.eq.${intent},category.eq.general`)
    .textSearch("searchVector", tsQuery, { type: "plain" })
    .limit(4);
  if (!faqs || faqs.length === 0) return "";
  return faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
}

// Fetch active bot rules by priority
async function fetchRules(botId: string): Promise<string> {
  const { data: rules } = await db
    .from("ChatBotRule")
    .select("rule, category")
    .eq("botId", botId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .limit(20);
  if (!rules || rules.length === 0) return "";
  return rules.map((r) => `- [${r.category}] ${r.rule}`).join("\n");
}

// Vault: truncate per-document (not mid-string) within a 2400-char budget
async function buildVaultBlock(companyId: string): Promise<string> {
  const vault = await getVaultContext(companyId);
  if (!vault.docs || vault.docs.length === 0) return vault.block ? vault.block.slice(0, 2400) : "";
  const perDoc = Math.floor(2400 / Math.min(vault.docs.length, 4));
  return vault.docs
    .slice(0, 4)
    .map((d: { filename?: string; content: string }) =>
      `### ${d.filename ?? "Doc"}\n${d.content.slice(0, perDoc)}`
    )
    .join("\n\n");
}

// Lead capture trigger
function shouldCaptureLead(messageCount: number, hasLead: boolean, reply: string): boolean {
  if (hasLead) return false;
  if (messageCount < 3) return false;
  if (messageCount % 4 === 0) return true;
  const phrases = ["team will", "get back to you", "contact you", "follow up", "reach out", "someone will"];
  return phrases.some((w) => reply.toLowerCase().includes(w));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    // ── 1. Validate session ──────────────────────────────────────────────────
    const { data: session } = await db
      .from("ChatSession")
      .select("id, botId, messageCount, detectedIntent, status, lang")
      .eq("id", data.sessionId)
      .eq("botId", data.botId)
      .maybeSingle();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404, headers: CORS_HEADERS });
    if (session.status === "closed") return NextResponse.json({ error: "Session is closed" }, { status: 400, headers: CORS_HEADERS });

    // ── 2. Lead-only submission — save lead, return early (no AI call) ───────
    if (data.leadName || data.leadEmail) {
      const { data: existingLead } = await db.from("ChatLead").select("id").eq("sessionId", data.sessionId).maybeSingle();
      if (!existingLead && data.leadEmail) {
        await db.from("ChatLead").insert({
          sessionId: data.sessionId,
          botId: data.botId,
          name: data.leadName ?? null,
          email: data.leadEmail,
          phone: data.leadPhone ?? null,
          company: data.leadCompany ?? null,
          intent: session.detectedIntent ?? "general",
          notes: `Captured after ${session.messageCount} messages`,
        });
      }
      return NextResponse.json(
        { reply: null, intent: session.detectedIntent, messageCount: session.messageCount, askForLead: false, leadSaved: true },
        { headers: CORS_HEADERS }
      );
    }

    // ── 3. Load bot + company + history in parallel ──────────────────────────
    const [
      { data: bot },
      { data: companyInfo },
      { data: company },
      { data: rawHistory },
    ] = await Promise.all([
      db.from("ChatBot").select("systemPrompt, name").eq("id", data.botId).maybeSingle(),
      db.from("CompanyInfo").select("bulkContent, values, corePhilosophy, founders, achievements").eq("companyId", DEMO_COMPANY_ID).maybeSingle(),
      db.from("Company").select("name, industry, website").eq("id", DEMO_COMPANY_ID).maybeSingle(),
      // Last 20 rows = 10 exchanges; filter out [Lead captured] system messages
      db.from("ChatMessage")
        .select("role, content")
        .eq("sessionId", data.sessionId)
        .neq("content", "[Lead captured]")
        .order("createdAt", { ascending: false })
        .limit(20),
    ]);

    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404, headers: CORS_HEADERS });

    const historyMessages = (rawHistory ?? []).reverse();
    const historyText = historyMessages
      .map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`)
      .join("\n");

    // ── 4. Classify intent + load all context in parallel ────────────────────
    const cachedIntent = session.detectedIntent as "support" | "sales" | "general" | null;
    const needsClassify = !cachedIntent || cachedIntent === "general";

    const [resolvedIntent, knowledgeContext, faqContext, rulesContext, vaultBlock, lessons] =
      await Promise.all([
        needsClassify ? classifyIntent(data.message, historyText) : Promise.resolve(cachedIntent as "support" | "sales" | "general"),
        searchKnowledge(data.botId, data.message, cachedIntent ?? "general"),
        searchFAQs(data.botId, data.message, cachedIntent ?? "general"),
        fetchRules(data.botId),
        buildVaultBlock(DEMO_COMPANY_ID),
        getLessonsContext({ companyId: DEMO_COMPANY_ID }),
      ]);

    // Persist newly classified intent (fire-and-forget)
    if (needsClassify && resolvedIntent !== "general") {
      db.from("ChatSession").update({ detectedIntent: resolvedIntent }).eq("id", data.sessionId).then(() => {});
    }

    // ── 5. Company context (capped to prevent token blowout) ─────────────────
    const companyContext = [
      company?.name     ? `Company: ${company.name}` : null,
      company?.industry ? `Industry: ${company.industry}` : null,
      company?.website  ? `Website: ${company.website}` : null,
      companyInfo?.values         ? `Values: ${String(companyInfo.values).slice(0, 300)}` : null,
      companyInfo?.corePhilosophy ? `Philosophy: ${String(companyInfo.corePhilosophy).slice(0, 300)}` : null,
      companyInfo?.founders       ? `Founders: ${String(companyInfo.founders).slice(0, 200)}` : null,
      companyInfo?.achievements   ? `Achievements: ${String(companyInfo.achievements).slice(0, 200)}` : null,
      companyInfo?.bulkContent    ? String(companyInfo.bulkContent).slice(0, 800) : null,
    ].filter(Boolean).join("\n");

    // ── 6. Language ──────────────────────────────────────────────────────────
    const lang = data.lang ?? session.lang ?? "en";
    const langInstruction = lang === "es"
      ? "## LANGUAGE\nRespond entirely in Spanish (español) for every message."
      : "## LANGUAGE\nRespond in English unless the visitor writes in another language — then match their language.";

    // ── 7. System prompt ─────────────────────────────────────────────────────
    const systemPrompt = [
      bot.systemPrompt?.trim(),
      langInstruction,
      companyContext        ? `## COMPANY\n${companyContext}` : null,
      lessons.block         ? lessons.block : null,
      rulesContext          ? `## RULES (apply strictly)\n${rulesContext}` : null,
      faqContext            ? `## EXACT FAQ ANSWERS (use verbatim when question matches)\n${faqContext}` : null,
      knowledgeContext      ? `## KNOWLEDGE BASE\n${knowledgeContext}` : null,
      vaultBlock            ? `## REFERENCE DOCUMENTS\n${vaultBlock}` : null,
      `## CONTEXT\nVisitor intent: ${resolvedIntent}`,
      `## GUIDELINES\n- Be concise, warm, professional — 2-4 sentences unless detail needed\n- Use FAQ answers verbatim when question matches\n- Draw on company info, KB, and reference docs for accuracy\n- Never fabricate — if unsure, say so and offer to connect with the team\n- Do NOT ask for contact details — the system handles lead capture separately`,
    ].filter(Boolean).join("\n\n");

    // ── 8. Call OpenAI with full conversation history ────────────────────────
    const chatMessages = historyMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    chatMessages.push({ role: "user", content: data.message });

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt: "",
      model: CHAT_MODEL,
      maxTokens: 500,
      temperature: 0.4,
      jsonMode: false,
      extraMessages: chatMessages,
    });

    const reply = aiResult.content.trim() || "I'm sorry, I couldn't generate a response. Please try again.";

    // ── 9. Persist messages + session (with dedup guard) ────────────────────
    // Prevent double-save if client retries the same request within 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const { data: recentDup } = await db
      .from("ChatMessage")
      .select("id")
      .eq("sessionId", data.sessionId)
      .eq("role", "user")
      .eq("content", data.message)
      .gte("createdAt", tenSecondsAgo)
      .limit(1)
      .maybeSingle();

    const newCount = (session.messageCount ?? 0) + 1;
    if (!recentDup) {
      await Promise.all([
        db.from("ChatMessage").insert([
          { sessionId: data.sessionId, role: "user",      content: data.message },
          { sessionId: data.sessionId, role: "assistant", content: reply },
        ]),
        db.from("ChatSession").update({ messageCount: newCount, lang, updatedAt: new Date().toISOString() }).eq("id", data.sessionId),
      ]);
    }

    logAiUsage({ model: CHAT_MODEL, feature: "chatbot", promptTokens: aiResult.promptTokens, completionTokens: aiResult.completionTokens });

    // ── 10. Lead capture check ───────────────────────────────────────────────
    const { data: existingLead } = await db.from("ChatLead").select("id").eq("sessionId", data.sessionId).maybeSingle();
    const askForLead = shouldCaptureLead(newCount, !!existingLead, reply);

    return NextResponse.json(
      { reply, intent: resolvedIntent, messageCount: newCount, askForLead },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
