export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEdgeAuth } from "@/lib/edgeAuth";
import { handleApiError } from "@/lib/apiHelpers";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { logAiUsage } from "@/lib/aiUsage";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  rawText: z.string().min(10, "rawText must be at least 10 characters"),
});

const SYSTEM_PROMPT = `You are a data extraction assistant. You will be given raw unstructured text describing a company's past grant submissions, funder outreach, and partnership history. Your job is to parse it into a structured JSON array.

Each item in the array represents one distinct funder/grant engagement and must have these fields:
- funderName (string, required): the name of the funder or grant program
- grantName (string | null): specific grant program name if different from funderName
- partnerOrg (string | null): local partner organisation name and country if mentioned
- region (string | null): one of "Africa", "Southeast Asia", "Philippines", "Europe", "North America", "Global", or null
- outcome (string | null): one of "Won", "Submitted", "Rejected", "Shortlisted", "NotSubmitted", "Exploratory", "Active", "Pending"
- amount (string | null): funding amount as a string e.g. "$3M", "$35K"
- rejectionReason (string | null): why the proposal failed if stated
- notes (string | null): 1-2 sentence summary of the engagement
- submittedAt (string | null): approximate date in YYYY-MM-DD format (use YYYY-01-01 if only year is known)

Outcome mapping rules:
- "WON", "CONVERTED", "won the bid" → "Won"
- "Rejected", "rejected" → "Rejected"
- "Shortlisted. Not selected" → "Shortlisted"
- "Submitted. No update", "No outcome update", "pending outcome" → "Pending"
- "Exploratory", "Did not pursue", "No proposal submitted" → "Exploratory"
- "Did not submit", "Not submitted", "Portal locked", "Structural barrier" → "NotSubmitted"
- "ACTIVE", "In cultivation", "Positioning" → "Active"

Return ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "rows": [
    {
      "funderName": "...",
      "grantName": null,
      "partnerOrg": null,
      "region": null,
      "outcome": "Submitted",
      "amount": null,
      "rejectionReason": null,
      "notes": "...",
      "submittedAt": null
    }
  ]
}`;

/**
 * POST /api/grants/history/parse
 *
 * Body: { rawText: string }
 *
 * Sends raw text (paste of handover doc or freeform notes) to GPT and parses
 * it into an array of structured GrantHistory rows ready for import.
 *
 * Response: { rows: ParsedHistoryRow[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = requireEdgeAuth(req);
    if (authError) return authError;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { rawText } = parsed.data;

    const result = await callOpenAIWithUsage({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Parse the following history text into structured rows:\n\n${rawText}`,
      model: MODEL_CONFIG.grantsAnalyse,
      maxTokens: 4000,
      temperature: 0.1,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.grantsAnalyse,
      feature: "grants_history_parse",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    let parsed2: { rows?: unknown[] };
    try {
      parsed2 = JSON.parse(result.content);
    } catch {
      logger.error("Grant History Parse", "AI returned invalid JSON");
      return NextResponse.json({ error: "AI returned invalid JSON — please try again" }, { status: 500 });
    }

    if (!Array.isArray(parsed2.rows)) {
      return NextResponse.json({ error: "AI response missing rows array" }, { status: 500 });
    }

    return NextResponse.json({ rows: parsed2.rows, count: parsed2.rows.length });
  } catch (err) {
    return handleApiError(err, "Grant History Parse");
  }
}
