export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { logAiUsage } from "@/lib/aiUsage";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { loadGenerationContext } from "@/lib/contentContext";
import { HYPE_WORDS } from "@/lib/constants";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

export const runtime = "nodejs";

const TONE_LABELS = ["Very formal", "Formal", "Balanced", "Casual", "Very casual"];
const SLIDE_COUNT_OPTIONS = [5, 7, 10, 12, 15];

const carouselSchema = z.object({
  topic:        z.string().min(1).max(500),
  audience:     z.string().max(300).optional(),
  goal:         z.string().max(300).optional(),
  cta:          z.string().max(200).optional(),
  keywords:     z.string().max(300).optional(),
  tone:         z.number().min(0).max(4).default(2),
  slideCount:   z.number().min(0).max(4).default(1),
  carouselType: z.enum(["educational", "narrative", "list", "persuasion"]).default("educational"),
});

function buildCarouselSystemPrompt(
  companyName: string,
  ctx: Awaited<ReturnType<typeof loadGenerationContext>>,
  opts: z.infer<typeof carouselSchema>
): string {
  const toneLabel = TONE_LABELS[opts.tone];
  const slideTarget = SLIDE_COUNT_OPTIONS[opts.slideCount];

  const TYPE_DESCRIPTIONS: Record<string, string> = {
    educational: "Progressive teaching sequence — each slide builds on the last, moving from problem to insight to solution.",
    narrative:   "Story-driven sequence — builds tension, conflict, and resolution across slides.",
    list:        "Step-by-step reveal — each slide unveils one item from a list, building anticipation.",
    persuasion:  "Belief-shifting sequence — challenges assumptions, presents evidence, reshapes perspective.",
  };

  // Company DNA block
  const dnaBlock = ctx.companyInfo?.bulkContent
    ? `\n\n═══ COMPANY WRITING DNA — FOLLOW THIS PRECISELY ═══\n${ctx.companyInfo.bulkContent}\n═══ END ═══`
    : "";

  // Company identity
  const identityParts: string[] = [];
  if (ctx.companyInfo?.values)        identityParts.push(`Values: ${ctx.companyInfo.values}`);
  if (ctx.companyInfo?.corePhilosophy) identityParts.push(`Philosophy: ${ctx.companyInfo.corePhilosophy}`);
  if (ctx.companyInfo?.products)      identityParts.push(`Products/Services: ${ctx.companyInfo.products}`);
  if (ctx.companyInfo?.founders)      identityParts.push(`Team: ${ctx.companyInfo.founders}`);
  if (ctx.companyInfo?.hashtags)      identityParts.push(`Brand hashtags: ${ctx.companyInfo.hashtags}`);
  const identityBlock = identityParts.length
    ? `\n\nCOMPANY IDENTITY:\n${identityParts.join("\n")}`
    : "";

  // Vault knowledge
  const VAULT_BUDGET = 10_000;
  let budget = VAULT_BUDGET;
  const vaultBlock = ctx.vaultDocs && ctx.vaultDocs.length > 0
    ? `\n\nKNOWLEDGE VAULT (use this to inform slide content):\n` +
      ctx.vaultDocs.map((d) => {
        if (budget <= 0) return null;
        const chunk = d.content.slice(0, Math.min(2000, budget));
        budget -= chunk.length;
        return `--- ${d.filename} ---\n${chunk}`;
      }).filter(Boolean).join("\n\n")
    : "";

  // Lessons
  const sortedLessons = [
    ...ctx.lessons.filter((l) => l.severity === "high"),
    ...ctx.lessons.filter((l) => l.severity !== "high"),
  ];
  const lessonsBlock = sortedLessons.length > 0
    ? `\n\nLESSONS FROM PAST REJECTIONS — APPLY ALL STRICTLY:\n` +
      sortedLessons.map((l, i) =>
        `${i + 1}. [${l.severity.toUpperCase()}] ${l.feedback}`
      ).join("\n")
    : "";

  // Brief
  const briefParts: string[] = [];
  if (opts.audience) briefParts.push(`- Target audience: ${opts.audience}`);
  if (opts.goal)     briefParts.push(`- Goal: ${opts.goal}`);
  if (opts.cta)      briefParts.push(`- Call to action (final slide): ${opts.cta}`);
  if (opts.keywords) briefParts.push(`- Keywords/hashtags to include: ${opts.keywords}`);
  const briefBlock = briefParts.length
    ? `\n\nCONTENT BRIEF:\n${briefParts.join("\n")}`
    : "";

  return `You are the carousel content writer for ${companyName}. You write high-performing Canva carousel posts.
${dnaBlock}${identityBlock}${vaultBlock}${lessonsBlock}${briefBlock}

CAROUSEL TYPE: ${opts.carouselType.toUpperCase()}
${TYPE_DESCRIPTIONS[opts.carouselType]}

TONE: ${toneLabel}
SLIDE COUNT: Exactly ${slideTarget} slides

CAROUSEL STRUCTURE RULES:
- Slide 1 (HOOK): Interrupt the scroll. Bold statement, provocative question, or tension-creating claim. No explanation yet — only curiosity. Max 10 words headline + 1 short subline.
- Slide 2 (CONTEXT): Frame the problem or set the scene. Why does this matter? 1-2 short sentences.
- Middle slides (BODY): One dominant idea per slide. No competing messages. Use compressed communication — short sentences, clear statements, visual hierarchy in mind. Each slide must justify the next swipe with an open loop or implied continuation.
- Final slide (RESOLUTION): Resolve the sequence. Summarise the core takeaway OR deliver the CTA. Must feel like closure, not abandonment.

OUTPUT FORMAT — return valid JSON only, no markdown:
{
  "title": "short internal title for this carousel",
  "slides": [
    {
      "slideNumber": 1,
      "role": "hook",
      "headline": "...",
      "body": "...",
      "designNote": "brief visual/layout suggestion for Canva"
    }
  ],
  "hashtags": ["tag1", "tag2"],
  "canvaNote": "overall design tip for this carousel"
}

RULES:
1. Follow the Writing DNA as your primary voice instruction.
2. Each slide communicates ONE dominant idea — never two.
3. Every slide must make the viewer want to swipe to the next.
4. Text is compressed — no long paragraphs, no filler words.
5. Never use: ${HYPE_WORDS}.
6. Apply all lessons from past rejections.
7. Return ONLY valid JSON — no prose, no markdown fences.`;
}

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const rl = checkRateLimit(`carousel:${authUser.id}`, RATE_LIMITS.generate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const data = carouselSchema.parse(body);

    const { data: company } = await db
      .from("Company")
      .select("*")
      .eq("id", DEMO_COMPANY_ID)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const ctx = await loadGenerationContext(DEMO_COMPANY_ID, "carousel");
    const systemPrompt = buildCarouselSystemPrompt(company.name, ctx, data);

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt: `Create a ${SLIDE_COUNT_OPTIONS[data.slideCount]}-slide ${data.carouselType} carousel about: ${data.topic}`,
      model: MODEL_CONFIG.generate,
      maxTokens: 3000,
      temperature: 0.65,
      jsonMode: true,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(aiResult.content);
    } catch {
      return NextResponse.json({ error: "AI returned malformed JSON — please try again" }, { status: 500 });
    }

    await logActivity(
      authUser.id,
      authUser.email || "",
      "carousel.generate",
      `Carousel: ${data.topic.slice(0, 100)}`
    );

    logAiUsage({
      model: MODEL_CONFIG.generate,
      feature: "carousel_generate",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId: authUser.id,
    });

    return NextResponse.json({ success: true, carousel: parsed });
  } catch (error) {
    return handleApiError(error, "Carousel Generate");
  }
}
