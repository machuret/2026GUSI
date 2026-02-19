export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const promptSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  contentType: z.string().min(1),
});

// GET /api/prompts
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data: prompts } = await db
      .from("PromptTemplate")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("updatedAt", { ascending: false });

    return NextResponse.json({ prompts: prompts ?? [] });
  } catch (error) {
    return handleApiError(error, "Prompts GET");
  }
}

// POST /api/prompts
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = promptSchema.parse(body);

    const { data: prompt } = await db
      .from("PromptTemplate")
      .insert({
        companyId: DEMO_COMPANY_ID,
        name: data.name,
        description: data.description ?? null,
        systemPrompt: data.systemPrompt,
        contentType: data.contentType,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    return handleApiError(error, "Prompts POST");
  }
}
