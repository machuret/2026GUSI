export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const profileSchema = z.object({
  orgType:             z.string().optional(),
  sector:              z.string().optional(),
  subSector:           z.string().optional(),
  location:            z.string().optional(),
  country:             z.string().optional(),
  stage:               z.string().optional(),
  teamSize:            z.string().optional(),
  annualRevenue:       z.string().optional(),
  yearFounded:         z.string().optional(),
  focusAreas:          z.array(z.string()).optional(),
  targetFundingMin:    z.number().int().min(0).optional().nullable(),
  targetFundingMax:    z.number().int().min(0).optional().nullable(),
  preferredDuration:   z.string().optional(),
  isRegisteredCharity: z.boolean().optional(),
  hasABN:              z.boolean().optional(),
  hasACN:              z.boolean().optional(),
  indigenousOwned:     z.boolean().optional(),
  womanOwned:          z.boolean().optional(),
  regionalOrRural:     z.boolean().optional(),
  missionStatement:    z.string().max(2000).optional(),
  keyActivities:       z.string().max(2000).optional(),
  pastGrantsWon:       z.string().max(2000).optional(),
  uniqueStrengths:     z.string().max(2000).optional(),
});

// GET /api/grant-profile
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data } = await db
      .from("GrantProfile")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .maybeSingle();

    return NextResponse.json({ profile: data ?? null });
  } catch (error) {
    return handleApiError(error, "Grant Profile GET");
  }
}

// PUT /api/grant-profile
export async function PUT(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = profileSchema.parse(body);

    const { data: saved, error } = await db
      .from("GrantProfile")
      .upsert(
        { ...data, companyId: DEMO_COMPANY_ID, updatedAt: new Date().toISOString() },
        { onConflict: "companyId" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, profile: saved });
  } catch (error) {
    return handleApiError(error, "Grant Profile PUT");
  }
}
