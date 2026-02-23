export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";

// GET /api/carousel/saved — list saved carousels
export async function GET() {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error } = await db
      .from("SavedCarousel")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .order("createdAt", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ carousels: data ?? [] });
  } catch (err) {
    return handleApiError(err, "SavedCarousel GET");
  }
}

// POST /api/carousel/saved — save a carousel
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { title, topic, carouselType, slides, hashtags, canvaNote } = body;

    if (!title || !slides || !Array.isArray(slides)) {
      return NextResponse.json({ error: "title and slides are required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("SavedCarousel")
      .insert({
        companyId: DEMO_COMPANY_ID,
        title,
        topic: topic || "",
        carouselType: carouselType || "educational",
        slides,
        hashtags: hashtags || [],
        canvaNote: canvaNote || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ carousel: data });
  } catch (err) {
    return handleApiError(err, "SavedCarousel POST");
  }
}
