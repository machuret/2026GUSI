export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { logActivity } from "@/lib/activity";
import { z } from "zod";

const leadSchema = z.object({
  companyId: z.string().min(1),
  source: z.string().default("manual"),
  sourceActorId: z.string().optional().nullable(),
  status: z.string().default("new"),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  profileUrl: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  specialties: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  rawData: z.record(z.any()).optional().nullable(),
});

// GET /api/leads?companyId=xxx&status=xxx&source=xxx&search=xxx&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const p = req.nextUrl.searchParams;
    const companyId = p.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

    const status = p.get("status");
    const source = p.get("source");
    const search = p.get("search");
    const rawPage = parseInt(p.get("page") ?? "1", 10);
    const rawLimit = parseInt(p.get("limit") ?? "50", 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = (page - 1) * limit;

    let query = db.from("Lead").select("*", { count: "exact" }).eq("companyId", companyId);
    if (status) query = query.eq("status", status);
    if (source) query = query.eq("source", source);
    if (search) query = query.or(`fullName.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,jobTitle.ilike.%${search}%`);

    const { data, error, count } = await query
      .order("createdAt", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return NextResponse.json({ leads: data ?? [], total: count ?? 0, page, limit });
  } catch (error) {
    return handleApiError(error, "Get Leads");
  }
}

// POST /api/leads — create one or many leads
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();

    // Support bulk insert: { leads: [...] } or single: { ...lead }
    if (Array.isArray(body.leads)) {
      const validated = body.leads.map((l: unknown) => leadSchema.parse(l));

      // Dedup: fetch existing leads for this company (name+source)
      const companyId = validated[0]?.companyId;
      const { data: existing } = companyId
        ? await db.from("Lead").select("fullName, source").eq("companyId", companyId)
        : { data: [] };
      const existingSet = new Set(
        (existing ?? []).map((l: { fullName: string | null; source: string }) =>
          `${(l.fullName ?? "").toLowerCase().trim()}|||${l.source}`
        )
      );

      const unique = validated.filter((d: z.infer<typeof leadSchema>) => {
        const key = `${(d.fullName ?? "").toLowerCase().trim()}|||${d.source}`;
        if (existingSet.has(key)) return false;
        existingSet.add(key); // also dedup within the batch
        return true;
      });

      if (unique.length === 0) {
        return NextResponse.json({ success: true, leads: [], inserted: 0, skipped: validated.length });
      }

      const rows = unique.map((d: z.infer<typeof leadSchema>) => ({ ...d, updatedAt: new Date().toISOString() }));
      const { data, error } = await db.from("Lead").insert(rows).select();
      if (error) throw error;
      await logActivity(authUser.id, authUser.email || "", "leads.import", `Imported ${data?.length ?? 0} leads (${validated.length - unique.length} skipped as duplicates)`);
      return NextResponse.json({ success: true, leads: data, inserted: data?.length ?? 0, skipped: validated.length - unique.length });
    }

    const data = leadSchema.parse(body);
    const { data: lead, error } = await db
      .from("Lead")
      .insert({ ...data, updatedAt: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    await logActivity(authUser.id, authUser.email || "", "leads.create", `Created lead: ${data.fullName ?? "unnamed"}`);
    return NextResponse.json({ success: true, lead });
  } catch (error) {
    return handleApiError(error, "Create Lead");
  }
}
