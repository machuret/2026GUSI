export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logAiUsage } from "@/lib/aiUsage";
import { logActivity } from "@/lib/activity";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { loadAIContext } from "@/lib/aiContext";
import { z } from "zod";

const CONTENT_TYPES = ["newsletter", "social_media", "blog_post", "carousel"] as const;
const IDEA_CATEGORIES = ["Education", "Touching Base", "Company Win", "Company Blog Post", "Carousel Topic", "Facts", "Motivational"] as const;
const IDEA_STYLES = ["relaxed", "educational", "for_doctors", "funny", "inspirational", "professional", "storytelling", "data_driven"] as const;

const STYLE_DESCRIPTIONS: Record<string, string> = {
  relaxed:       "Warm, friendly, conversational tone — like chatting with a colleague",
  educational:   "Clear, informative, authoritative — backed by evidence and expertise",
  for_doctors:   "Clinical, peer-to-peer, uses medical terminology appropriately — speaks to physicians as equals",
  funny:         "Light-hearted, witty, uses humor to make points memorable — not sarcastic, genuinely fun",
  inspirational: "Uplifting, motivational, heart-felt — connects emotionally with the audience",
  professional:  "Polished, formal, credibility-focused — suitable for executive or institutional audiences",
  storytelling:  "Narrative-driven, uses anecdotes and patient stories — creates emotional connection",
  data_driven:   "Statistics-heavy, evidence-based, uses numbers and research findings to make the case",
};

const generateSchema = z.object({
  contentTypes: z.array(z.enum(CONTENT_TYPES)).min(1),
  categories:   z.array(z.enum(IDEA_CATEGORIES)).min(1),
  styles:       z.array(z.enum(IDEA_STYLES)).min(1).optional(),
  count:        z.number().int().min(1).max(20).default(6),
});

// GET /api/ideas — list saved ideas
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const status      = p.get("status") ?? "";
    const contentType = p.get("contentType") ?? "";
    const category    = p.get("category") ?? "";

    let query = db
      .from("Idea")
      .select("*", { count: "exact" })
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (status)      query = query.eq("status", status);
    if (contentType) query = query.eq("contentType", contentType);
    if (category)    query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ideas: data ?? [], total: count ?? 0 });
  } catch (err) {
    return handleApiError(err, "Ideas GET");
  }
}

// POST /api/ideas — generate a batch of ideas via AI
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

    // If body has an `idea` field, it's a direct save (no AI)
    if (body.idea) {
      const { title, summary, contentType, category, style } = body.idea;
      if (!title || !summary || !contentType || !category) {
        return NextResponse.json({ error: "title, summary, contentType and category are required" }, { status: 400 });
      }
      const appUser = await logActivity(authUser.id, authUser.email || "", "ideas.save", title.slice(0, 80));
      const row: Record<string, unknown> = { companyId: DEMO_COMPANY_ID, userId: appUser.id, title, summary, contentType, category, status: "saved" };
      if (style) row.style = style;
      const { data, error } = await db
        .from("Idea")
        .insert(row)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ idea: data });
    }

    // Otherwise generate ideas via AI
    const parsed = generateSchema.parse(body);

    const contentTypeLabels: Record<string, string> = {
      newsletter:   "Newsletter",
      social_media: "Social Media Post",
      blog_post:    "Blog Post",
      carousel:     "Carousel Post",
    };

    const { fullBlock } = await loadAIContext({ companyId: DEMO_COMPANY_ID, includeFAQ: false });

    const stylesRequested = parsed.styles ?? ["relaxed", "educational", "inspirational"];
    const styleGuidance = stylesRequested.map((s) => `- ${s}: ${STYLE_DESCRIPTIONS[s] ?? s}`).join("\n");

    const systemPrompt = `You are a creative content strategist for a specific company. Generate fresh, specific, actionable content ideas tailored to this company's industry, products, and voice.
Return a JSON object with a single key "ideas" containing an array of idea objects. No markdown, no explanation.
Each idea object must have exactly these fields:
- "title": string — a compelling, specific headline (max 80 chars)
- "summary": string — 1-2 sentence description of what the content covers and why it matters (max 200 chars)
- "contentType": one of ${JSON.stringify(parsed.contentTypes)}
- "category": one of ${JSON.stringify(parsed.categories)}
- "style": one of ${JSON.stringify(stylesRequested)}

CATEGORY GUIDELINES:
- "Facts": Real-world facts and evidence about how the company's products/technology help people. Focus on outcomes, clinical evidence, case examples.
- "Motivational": Heart-felt, light, uplifting content that connects emotionally. Think patient success stories, team dedication, why-we-do-this moments.
- "Education": Teaching the audience something useful — how-tos, tips, explainers.
- "Touching Base": Staying connected — updates, behind-the-scenes, community.
- "Company Win": Celebrating milestones, achievements, partnerships.
- "Company Blog Post": Long-form thought leadership.
- "Carousel Topic": Visual slide-based content.

STYLE/TONE — vary across these styles:
${styleGuidance}

Rules:
- Ground ideas in the company's actual products, services, values, and industry — not generic advice
- Be specific, not generic. "5 Ways to Reduce Churn Using Onboarding Emails" beats "Email Tips"
- Vary the angle across the requested styles — spread ideas across different tones
- Each idea must be immediately actionable — someone should be able to write it today
- For "Facts" category: include a specific claim or stat angle in the title
- For "Motivational" category: make it genuinely heart-felt, not corporate

${fullBlock}`;

    const userPrompt = `Generate ${parsed.count} content ideas.
Content types to cover: ${parsed.contentTypes.map((t) => contentTypeLabels[t]).join(", ")}
Categories to cover: ${parsed.categories.join(", ")}
Styles to use: ${stylesRequested.join(", ")}
Spread ideas across all requested content types, categories, and styles. Return {"ideas": [...]}.`;

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.generate,
      maxTokens: 2000,
      temperature: 0.85,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.generate,
      feature: "ideas.generate",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId: authUser.id,
    });

    let ideas: unknown[];
    try {
      const raw = JSON.parse(aiResult.content);
      ideas = Array.isArray(raw) ? raw : raw.ideas ?? [];
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // Validate and normalise each idea
    const valid = ideas
      .filter((i): i is Record<string, string> => typeof i === "object" && i !== null)
      .map((i) => ({
        title:       String(i.title ?? "").slice(0, 80),
        summary:     String(i.summary ?? "").slice(0, 200),
        contentType: CONTENT_TYPES.includes(i.contentType as typeof CONTENT_TYPES[number]) ? i.contentType : parsed.contentTypes[0],
        category:    IDEA_CATEGORIES.includes(i.category as typeof IDEA_CATEGORIES[number]) ? i.category : parsed.categories[0],
        style:       IDEA_STYLES.includes(i.style as typeof IDEA_STYLES[number]) ? i.style : stylesRequested[0],
      }))
      .filter((i) => i.title && i.summary);

    return NextResponse.json({ ideas: valid });
  } catch (err) {
    return handleApiError(err, "Ideas POST");
  }
}
