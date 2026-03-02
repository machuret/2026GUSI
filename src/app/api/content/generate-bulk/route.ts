export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logActivity } from "@/lib/activity";
import { logAiUsage } from "@/lib/aiUsage";
import { createContent, CATEGORIES } from "@/lib/content";
import { categoryKeys, briefSchema } from "@/lib/contentSchemas";
import { buildGenerationPrompt } from "@/lib/contentContext";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { stripMarkdown } from "@/lib/htmlUtils";
import { z } from "zod";

const bulkSchema = z.object({
  companyId: z.string().min(1),
  category: z.enum(categoryKeys),
  topics: z.array(z.string().min(1).max(500, "Topic must be under 500 characters")).min(1).max(20),
  brief: briefSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const rl = checkRateLimit(`generate-bulk:${authUser.id}`, RATE_LIMITS.generateBulk);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const data = bulkSchema.parse(body);

    const { data: company } = await db
      .from("Company")
      .select("*")
      .eq("id", data.companyId)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const catLabel = CATEGORIES.find((c) => c.key === data.category)?.label ?? data.category;
    const systemPrompt = await buildGenerationPrompt(company, data.companyId, data.category, data.brief);

    const appUser = await logActivity(
      authUser.id,
      authUser.email || "",
      "content.generate_bulk",
      `Bulk ${catLabel}: ${data.topics.length} topics`
    );

    // Stream results as NDJSON — each topic is flushed immediately on completion.
    // This prevents Vercel's 60s response timeout from killing a large batch,
    // since we're continuously writing to the stream rather than buffering everything.
    const TOPIC_TIMEOUT_MS = 25_000;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let generated = 0;
        let failed = 0;

        for (const topic of data.topics) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Topic timed out after 25s")), TOPIC_TIMEOUT_MS)
            );

            const generatePromise = callOpenAIWithUsage({
              systemPrompt,
              userPrompt: topic,
              model: MODEL_CONFIG.generateBulk,
              maxTokens: 2500,
              temperature: 0.65,
              jsonMode: false,
            });

            const aiResult = await Promise.race([generatePromise, timeoutPromise]);
            const output = stripMarkdown(aiResult.content);

            const saved = await createContent(data.category, {
              companyId: data.companyId,
              userId: appUser.id,
              prompt: topic,
              output,
            });

            logAiUsage({ model: MODEL_CONFIG.generateBulk, feature: "generate_bulk", promptTokens: aiResult.promptTokens, completionTokens: aiResult.completionTokens, userId: authUser.id });

            generated++;
            controller.enqueue(encoder.encode(JSON.stringify({ topic, id: saved.id, output }) + "\n"));
          } catch (err) {
            failed++;
            controller.enqueue(encoder.encode(JSON.stringify({ topic, id: "", output: "", error: err instanceof Error ? err.message : "Failed" }) + "\n"));
          }
        }

        // Final summary line
        controller.enqueue(encoder.encode(JSON.stringify({ __done: true, generated, failed }) + "\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error, "Generate Bulk");
  }
}
