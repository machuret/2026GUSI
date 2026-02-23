export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenAIWithUsage, MODEL_CONFIG } from "@/lib/openai";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logAiUsage } from "@/lib/aiUsage";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const AU_STATES = [
  "New South Wales",
  "Victoria",
  "Queensland",
  "Western Australia",
  "South Australia",
  "Tasmania",
  "Northern Territory",
  "Australian Capital Territory",
] as const;

const searchSchema = z.object({
  state: z.string().min(1),
  count: z.number().int().min(1).max(30).default(10),
});

const hospitalSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().min(1),
  country: z.string().default("Australia"),
  url: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  beds: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().default("new"),
});

// GET /api/hospitals — list saved hospitals
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const state  = p.get("state") ?? "";
    const status = p.get("status") ?? "";
    const search = p.get("search") ?? "";

    let query = db
      .from("HospitalLead")
      .select("*", { count: "exact" })
      .eq("companyId", DEMO_COMPANY_ID)
      .order("state", { ascending: true })
      .order("city", { ascending: true })
      .order("name", { ascending: true });

    if (state)  query = query.eq("state", state);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,address.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ hospitals: data ?? [], total: count ?? 0, states: AU_STATES });
  } catch (err) {
    return handleApiError(err, "Hospitals GET");
  }
}

// POST /api/hospitals — search via OpenAI OR bulk save
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

    // ── Bulk save (from search results) ──────────────────────────────────────
    if (body.hospitals && Array.isArray(body.hospitals)) {
      // Get existing names for dedup
      const { data: existing } = await db
        .from("HospitalLead")
        .select("name, state")
        .eq("companyId", DEMO_COMPANY_ID);

      const existingSet = new Set(
        (existing ?? []).map((h: { name: string; state: string }) => `${h.name}|||${h.state}`.toLowerCase())
      );

      const inserts = body.hospitals
        .map((h: unknown) => hospitalSchema.parse(h))
        .filter((h: z.infer<typeof hospitalSchema>) => !existingSet.has(`${h.name}|||${h.state}`.toLowerCase()))
        .map((h: z.infer<typeof hospitalSchema>) => ({
          ...h,
          companyId: DEMO_COMPANY_ID,
          updatedAt: new Date().toISOString(),
        }));

      if (inserts.length === 0) {
        return NextResponse.json({ hospitals: [], saved: 0, skipped: body.hospitals.length, message: "All hospitals already exist" });
      }

      const { data, error } = await db
        .from("HospitalLead")
        .insert(inserts)
        .select();

      if (error) throw new Error(error.message);
      return NextResponse.json({
        hospitals: data ?? [],
        saved: data?.length ?? 0,
        skipped: body.hospitals.length - (data?.length ?? 0),
      });
    }

    // ── Manual add single hospital ───────────────────────────────────────────
    if (body.name && !body.state_search) {
      const parsed = hospitalSchema.parse(body);

      // Check dedup
      const { data: dup } = await db
        .from("HospitalLead")
        .select("id")
        .eq("companyId", DEMO_COMPANY_ID)
        .ilike("name", parsed.name)
        .eq("state", parsed.state)
        .maybeSingle();

      if (dup) {
        return NextResponse.json({ error: "Hospital already exists", duplicate: true }, { status: 409 });
      }

      const { data, error } = await db
        .from("HospitalLead")
        .insert({ ...parsed, companyId: DEMO_COMPANY_ID, updatedAt: new Date().toISOString() })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ hospital: data });
    }

    // ── AI Search ────────────────────────────────────────────────────────────
    const parsed = searchSchema.parse({ state: body.state, count: body.count });

    const systemPrompt = `You are an Australian healthcare data researcher. Your task is to provide accurate, real information about hospitals in Australia.

For the given state, return the top hospitals — one per major city/town. Focus on:
- Major public hospitals (tertiary/teaching hospitals first)
- Regional hospitals in key cities
- Well-known private hospitals

For each hospital, provide:
- name: Official hospital name
- address: Full street address
- city: City/suburb name
- state: State name (full, e.g. "New South Wales")
- url: Official hospital website URL (must be real, not made up)
- phone: Main phone number if known
- type: "Public", "Private", or "Public/Teaching"
- beds: Approximate bed count if known (number or null)

Return ONLY valid JSON: {"hospitals": [...]}
Be accurate — only include real hospitals you are confident about. Do not fabricate URLs or details.`;

    const userPrompt = `List the top ${parsed.count} hospitals in ${parsed.state}, Australia. One hospital per major city/town where possible. Include the biggest teaching hospitals and key regional hospitals. Return {"hospitals": [...]}.`;

    const aiResult = await callOpenAIWithUsage({
      systemPrompt,
      userPrompt,
      model: MODEL_CONFIG.generate,
      maxTokens: 3000,
      temperature: 0.3,
      jsonMode: true,
    });

    logAiUsage({
      model: MODEL_CONFIG.generate,
      feature: "hospitals.search",
      promptTokens: aiResult.promptTokens,
      completionTokens: aiResult.completionTokens,
      userId: authUser.id,
    });

    let hospitals: Record<string, unknown>[];
    try {
      const raw = JSON.parse(aiResult.content);
      hospitals = Array.isArray(raw) ? raw : raw.hospitals ?? [];
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    // Normalise
    const results = hospitals.map((h) => ({
      name: String(h.name ?? "").trim(),
      address: h.address ? String(h.address).trim() : null,
      city: h.city ? String(h.city).trim() : null,
      state: parsed.state,
      country: "Australia",
      url: h.url ? String(h.url).trim() : null,
      phone: h.phone ? String(h.phone).trim() : null,
      type: h.type ? String(h.type).trim() : null,
      beds: typeof h.beds === "number" ? h.beds : null,
    })).filter((h) => h.name.length > 0);

    return NextResponse.json({ hospitals: results });
  } catch (err) {
    return handleApiError(err, "Hospitals POST");
  }
}
