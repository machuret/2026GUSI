export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { callOpenAIJson } from "@/lib/openai";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const scanSchema = z.object({
  contentId:       z.string().min(1),
  contentCategory: z.string().min(1),
  contentText:     z.string().min(1),
  companyId:       z.string().optional(),
  saveResult:      z.boolean().optional().default(true),
});

interface Violation {
  ruleId:      string;
  ruleTitle:   string;
  ruleType:    string;
  severity:    string;
  explanation: string;
}

interface ScanOutput {
  passed:     boolean;
  violations: Violation[];
  summary:    string;
}

// POST /api/compliance/scan
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = scanSchema.parse(body);
    const companyId = data.companyId || DEMO_COMPANY_ID;

    // Fetch all active compliance rules
    const { data: rules, error: rulesError } = await db
      .from("ComplianceRule")
      .select("*")
      .eq("companyId", companyId)
      .eq("active", true)
      .order("severity", { ascending: true });

    if (rulesError) throw new Error(rulesError.message);

    if (!rules || rules.length === 0) {
      return NextResponse.json({
        passed: true,
        violations: [],
        summary: "No active compliance rules found. Content passed by default.",
        ruleCount: 0,
      });
    }

    // Build rules list for the prompt
    const rulesText = rules.map((r: any, i: number) =>
      `Rule ${i + 1} [ID: ${r.id}] [Type: ${r.ruleType}] [Severity: ${r.severity}]\nTitle: ${r.title}\nDescription: ${r.description}`
    ).join("\n\n");

    const prompt = `You are a compliance officer for a medical innovation company. Your job is to check content against regulatory, legal, and ethical rules.

CONTENT TO REVIEW (Category: ${data.contentCategory}):
"""
${data.contentText.slice(0, 3000)}
"""

COMPLIANCE RULES TO CHECK AGAINST:
${rulesText}

INSTRUCTIONS:
- Check the content against EVERY rule listed above.
- For each rule that is VIOLATED, include it in the violations array.
- Only include rules that are actually violated — do not flag rules that are satisfied.
- Be precise and specific in your explanation of WHY the rule is violated.
- Return a JSON object with this exact structure:
{
  "passed": true/false,
  "violations": [
    {
      "ruleId": "the rule ID from above",
      "ruleTitle": "the rule title",
      "ruleType": "legal|medical|ethical",
      "severity": "critical|high|medium|low",
      "explanation": "specific explanation of how this content violates the rule"
    }
  ],
  "summary": "one sentence overall assessment"
}

If there are no violations, return passed: true and an empty violations array.`;

    const result = await callOpenAIJson<ScanOutput>({
      systemPrompt: "You are a compliance officer for a medical innovation company. You check content against regulatory, legal, and ethical rules and return structured JSON.",
      userPrompt: prompt,
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 2000,
    });

    const passed = result.violations.length === 0;

    // Save audit result if requested
    if (data.saveResult) {
      await db.from("AuditResult").insert({
        companyId,
        contentId:       data.contentId,
        contentCategory: data.contentCategory,
        contentSnippet:  data.contentText.slice(0, 300),
        passed,
        violations:      result.violations,
        scannedBy:       authUser.id,
      });
    }

    return NextResponse.json({
      passed,
      violations: result.violations,
      summary:    result.summary,
      ruleCount:  rules.length,
    });
  } catch (error) {
    return handleApiError(error, "Compliance Scan");
  }
}
