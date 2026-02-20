export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { getCompanyContext } from "@/lib/aiContext";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { audienceId, goal, tone, length, extraContext } = await req.json();

  if (!goal) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  const [companyCtx, audience] = await Promise.all([
    getCompanyContext(DEMO_COMPANY_ID),
    audienceId
      ? db.from("MailchimpAudience").select("name, memberCount").eq("id", audienceId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const wordTarget = length === "short" ? 150 : length === "long" ? 500 : 300;
  const toneLabel  = tone === "formal" ? "professional and formal" : tone === "casual" ? "casual and friendly" : "warm and conversational";

  const systemPrompt = `You are an expert email marketing copywriter. Write compelling, high-converting email campaign content.
Return JSON with exactly these fields:
{
  "subjectLine": "compelling subject line (max 60 chars)",
  "previewText": "preview/preheader text (max 90 chars)",
  "htmlBody": "full HTML email body — use inline styles, a clean single-column layout, clear CTA button"
}`;

  const userPrompt = `Write an email campaign with the following brief:

ORGANISATION:
${companyCtx}

CAMPAIGN GOAL: ${goal}
TONE: ${toneLabel}
TARGET LENGTH: ~${wordTarget} words in the body
${audience ? `AUDIENCE: ${audience.name} (${audience.memberCount?.toLocaleString()} subscribers)` : ""}
${extraContext ? `EXTRA CONTEXT:\n${extraContext}` : ""}

Requirements:
- Subject line must create curiosity or urgency
- Preview text must complement (not repeat) the subject
- HTML body: single-column, max-width 600px, inline styles, responsive
- Include a clear CTA button in brand colour (#4F46E5)
- Sign off with the organisation name
- No placeholder text — write real, specific copy based on the org context above`;

  try {
    const result = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model:       MODEL_CONFIG.generate,
      maxTokens:   2000,
      temperature: 0.6,
      jsonMode:    true,
    });

    logAiUsage({
      feature:          "mailchimp_campaign_generate",
      model:            MODEL_CONFIG.generate,
      promptTokens:     result.promptTokens,
      completionTokens: result.completionTokens,
    });

    const parsed = JSON.parse(result.content);
    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

