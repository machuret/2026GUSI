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

const bulkSchema = z.object({
  companyId: z.string().min(1),
  category: z.enum(categoryKeys),
  topics: z.array(z.string().min(1)).min(1).max(20),
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
    const data = bulkSchema.parse(body);

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

    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.generate_bulk",
      `Bulk ${catLabel}: ${data.topics.length} topics`
    );

    // Generate all topics sequentially to avoid rate limits
    const results: { topic: string; id: string; output: string; error?: string }[] = [];

    for (const topic of data.topics) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: topic },
          ],
          temperature: 0.65,
          max_tokens: 2500,
        });

        const output = response.choices[0]?.message?.content?.trim() ?? "";

        const saved = await createContent(data.category, {
          companyId: data.companyId,
          userId: appUser.id,
          prompt: topic,
          output,
        });

        results.push({ topic, id: saved.id, output });
      } catch (err) {
        results.push({ topic, id: "", output: "", error: err instanceof Error ? err.message : "Failed" });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      generated: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
    });
  } catch (error) {
    return handleApiError(error, "Generate Bulk");
  }
}
