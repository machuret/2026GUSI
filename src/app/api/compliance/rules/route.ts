export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminAuth, requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";
import { DEMO_COMPANY_ID } from "@/lib/constants";

const createSchema = z.object({
  ruleType:    z.enum(["legal", "medical", "ethical"]),
  title:       z.string().min(1),
  description: z.string().min(1),
  severity:    z.enum(["critical", "high", "medium", "low"]),
});

// GET /api/compliance/rules — list all rules (any authenticated user)
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || DEMO_COMPANY_ID;
    const ruleType  = searchParams.get("ruleType");

    let q = db
      .from("ComplianceRule")
      .select("*")
      .eq("companyId", companyId)
      .order("ruleType", { ascending: true })
      .order("severity", { ascending: true })
      .order("createdAt", { ascending: true });

    if (ruleType) q = q.eq("ruleType", ruleType);

    const { data: rules, error } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json({ rules: rules ?? [] });
  } catch (error) {
    return handleApiError(error, "Compliance Rules GET");
  }
}

// POST /api/compliance/rules — create a rule (ADMIN+ only)
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAdminAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = createSchema.parse(body);
    const companyId = body.companyId || DEMO_COMPANY_ID;

    const { data: rule, error } = await db
      .from("ComplianceRule")
      .insert({
        companyId,
        ruleType:    data.ruleType,
        title:       data.title,
        description: data.description,
        severity:    data.severity,
        active:      true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    return handleApiError(error, "Compliance Rules POST");
  }
}
