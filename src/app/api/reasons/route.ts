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

const AUDIENCES = [
  "Doctors",
  "Nurses",
  "Pediatricians",
  "Hospitals",
  "Dentists",
  "Pharmacists",
  "Therapists",
  "Healthcare Professionals",
] as const;

const generateSchema = z.object({
  audience: z.string().min(1),
  count: z.number().int().min(1).max(50).default(10),
});

// GET /api/reasons — list saved reasons
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const status   = p.get("status") ?? "";
    const audience = p.get("audience") ?? "";

    let query = db
      .from("Reason")
      .select("*", { count: "exact" })
      .eq("companyId", DEMO_COMPANY_ID)
      .order("reasonNumber", { ascending: false });

    if (status)   query = query.eq("status", status);
    if (audience) query = query.eq("audience", audience);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ reasons: data ?? [], total: count ?? 0, audiences: AUDIENCES });
  } catch (err) {
    return handleApiError(err, "Reasons GET");
  }
}

// POST /api/reasons — generate a batch of reasons via AI, or save individual reasons
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

    // Direct save (batch of pre-generated reasons)
    if (body.reasons && Array.isArray(body.reasons)) {
      const appUser = await logActivity(authUser.id, authUser.email || "", "reasons.save", `Saved ${body.reasons.length} reasons`);

      // Get the current max reason number
      const { data: maxRow } = await db
        .from("Reason")
        .select("reasonNumber")
        .eq("companyId", DEMO_COMPANY_ID)
        .order("reasonNumber", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = (maxRow?.reasonNumber ?? 0) + 1;

      const inserts = body.reasons.map((r: { output: string; audience: string; reasonNumber?: number }) => ({
        companyId: DEMO_COMPANY_ID,
        userId: appUser.id,
        reasonNumber: r.reasonNumber ?? nextNumber++,
        audience: r.audience,
        output: r.output,
        status: "PENDING",
        updatedAt: new Date().toISOString(),
      }));

      const { data, error } = await db
        .from("Reason")
        .insert(inserts)
        .select();

      if (error) throw new Error(error.message);
      return NextResponse.json({ reasons: data });
    }

    // Generate reasons via AI
    const parsed = generateSchema.parse(body);

    const { fullBlock } = await loadAIContext({ companyId: DEMO_COMPANY_ID, includeFAQ: false });

    // Get current max reason number for numbering
    const { data: maxRow } = await db
      .from("Reason")
      .select("reasonNumber")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("reasonNumber", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startNumber = (maxRow?.reasonNumber ?? 0) + 1;

    const systemPrompt = `You are a creative content strategist for GUSI. Your job is to generate compelling, concise "reasons" for a social media series called "Reasons why ${parsed.audience} Love GUSI".

Each reason should be:
- Short (1-2 sentences max, under 150 characters ideal)
- Specific and grounded in GUSI's actual products, features, and value propositions
- Easy to turn into a social media post
- Varied in angle: some about saving time, some about patient outcomes, some about ease of use, some about community impact, some about technology, etc.
- Written in a warm, confident tone — not salesy or hyperbolic
- Each one must stand alone as a complete thought

Return a JSON object with a single key "reasons" containing an array of strings (just the reason text, no numbering).

Example output format:
{"reasons": ["It helps them improve their service in their local community", "Patient records are always just one tap away"]}

${fullBlock}`;

    const userPrompt = `Generate ${parsed.count} unique reasons why ${parsed.audience} love GUSI. Make each one distinct — cover different benefits, features, and angles. Return {"reasons": [...]}.`;

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
      feature: "reasons.generate",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId: authUser.id,
    });

    let reasons: string[];
    try {
      const raw = JSON.parse(aiResult.content);
      reasons = Array.isArray(raw) ? raw : raw.reasons ?? [];
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // Map to objects with numbering
    const mapped = reasons
      .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
      .map((text, i) => ({
        reasonNumber: startNumber + i,
        audience: parsed.audience,
        output: text.trim(),
      }));

    return NextResponse.json({ reasons: mapped, startNumber });
  } catch (err) {
    return handleApiError(err, "Reasons POST");
  }
}
