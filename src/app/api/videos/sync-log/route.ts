export const runtime = "edge";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { z } from "zod";

const syncLogSchema = z.object({
  type: z.enum(["videos", "transcripts"]),
  status: z.enum(["completed", "failed"]).default("completed"),
  synced: z.number().int().min(0).default(0),
  updated: z.number().int().min(0).default(0),
  errors: z.number().int().min(0).default(0),
  totalProcessed: z.number().int().min(0).default(0),
  durationMs: z.number().int().min(0).default(0),
});

// GET /api/videos/sync-log — get last sync info for each type
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("VideoSyncLog")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false })
      .limit(5);

    if (error) throw error;

    const lastVideoSync = (data ?? []).find((d) => d.type === "videos");
    const lastTranscriptSync = (data ?? []).find((d) => d.type === "transcripts");

    return NextResponse.json({ lastVideoSync, lastTranscriptSync, recent: data ?? [] });
  } catch (err) {
    return handleApiError(err, "VideoSyncLog GET");
  }
}

// POST /api/videos/sync-log — record a sync event
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const parsed = syncLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { data, error } = await db
      .from("VideoSyncLog")
      .insert({ ...parsed.data, companyId: DEMO_COMPANY_ID })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ log: data });
  } catch (err) {
    return handleApiError(err, "VideoSyncLog POST");
  }
}
