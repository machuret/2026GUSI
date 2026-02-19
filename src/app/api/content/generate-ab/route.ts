export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openai } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { createContent, CATEGORIES } from "@/lib/content";
import { buildSystemPrompt } from "@/lib/promptBuilder";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const categoryKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];

const abSchema = z.object({
  companyId: z.string().min(1),
  prompt: z.string().min(1),
  category: z.enum(categoryKeys),
  brief: z.object({
    audience: z.string().optional(),
    goal: z.string().optional(),
    cta: z.string().optional(),
    keywords: z.string().optional(),
    tone: z.number().min(0).max(4).optional(),
    length: z.number().min(0).max(4).optional(),
    platform: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = abSchema.parse(body);

    const catLabel = CATEGORIES.find((c) => c.key === data.category)?.label || data.category;

    const { data: company } = await db
      .from("Company")
      .select("*")
      .eq("id", data.companyId)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const [styleRes, postsRes, infoRes, promptRes, lessonsRes] = await Promise.all([
      db.from("StyleProfile").select("*").eq("companyId", data.companyId).maybeSingle(),
      db.from("ContentPost").select("*").eq("companyId", data.companyId).order("createdAt", { ascending: false }).limit(5),
      db.from("CompanyInfo").select("*").eq("companyId", data.companyId).maybeSingle(),
      db.from("PromptTemplate").select("*").eq("companyId", data.companyId).eq("contentType", data.category).eq("active", true).limit(1),
      db.from("Lesson").select("*").eq("companyId", data.companyId).eq("active", true).or(`contentType.eq.${data.category},contentType.is.null`).order("createdAt", { ascending: false }).limit(30),
    ]);

    const systemPrompt = buildSystemPrompt({
      companyName: company.name,
      companyIndustry: company.industry,
      categoryLabel: catLabel,
      styleProfile: styleRes.data,
      recentPosts: postsRes.data ?? [],
      companyInfo: infoRes.data,
      promptTemplate: promptRes.data?.[0] ?? null,
      lessons: lessonsRes.data ?? [],
      brief: data.brief,
    });

    // Generate 2 variants in parallel with slightly different temperatures
    const [respA, respB] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.prompt },
        ],
        temperature: 0.55,
        max_tokens: 2500,
      }),
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt + "\n\nIMPORTANT: Write a distinctly different version — different opening, different structure, different angle. Same brief, fresh approach." },
          { role: "user", content: data.prompt },
        ],
        temperature: 0.85,
        max_tokens: 2500,
      }),
    ]);

    const outputA = respA.choices[0]?.message?.content?.trim() ?? "";
    const outputB = respB.choices[0]?.message?.content?.trim() ?? "";

    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.generate_ab",
      `A/B ${catLabel}: ${data.prompt.slice(0, 100)}`
    );

    // Save both variants
    const [variantA, variantB] = await Promise.all([
      createContent(data.category, {
        companyId: data.companyId,
        userId: appUser.id,
        prompt: data.prompt,
        output: outputA,
      }),
      createContent(data.category, {
        companyId: data.companyId,
        userId: appUser.id,
        prompt: data.prompt,
        output: outputB,
      }),
    ]);

    return NextResponse.json({
      success: true,
      variantA: { id: variantA.id, output: outputA },
      variantB: { id: variantB.id, output: outputB },
      category: data.category,
    });
  } catch (error) {
    return handleApiError(error, "Generate A/B");
  }
}
