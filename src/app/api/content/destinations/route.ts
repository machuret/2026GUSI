export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { findContentById, updateContent } from "@/lib/content";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { z } from "zod";

const schema = z.object({
  contentId:    z.string().min(1),
  category:     z.string().min(1),
  destinations: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const data = schema.parse(body);

    const found = await findContentById(data.contentId, data.category);
    if (!found) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    await updateContent(data.category, data.contentId, {
      destinations: data.destinations,
    });

    return NextResponse.json({ success: true, destinations: data.destinations });
  } catch (error) {
    return handleApiError(error, "Destinations");
  }
}
