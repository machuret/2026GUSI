export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import {
  fetchVideoTextTracks,
  fetchTranscriptContent,
  parseTranscriptToText,
} from "@/lib/vimeo";

// POST /api/videos/transcripts?batch=20&offset=0
// Fetches transcripts for videos that don't have one yet.
// Processes `batch` videos at a time to avoid timeouts.
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const batch = parseInt(req.nextUrl.searchParams.get("batch") || "10", 10);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);

    // Get videos without transcripts
    const { data: videos, error: fetchErr } = await db
      .from("Video")
      .select("id, vimeoId, title")
      .eq("companyId", DEMO_COMPANY_ID)
      .is("transcript", null)
      .order("createdAt", { ascending: true })
      .range(offset, offset + batch - 1);

    if (fetchErr) throw fetchErr;

    // Count total remaining
    const { count } = await db
      .from("Video")
      .select("id", { count: "exact", head: true })
      .eq("companyId", DEMO_COMPANY_ID)
      .is("transcript", null);

    let fetched = 0;
    let noTrack = 0;
    let errors = 0;

    for (const video of videos ?? []) {
      try {
        const tracks = await fetchVideoTextTracks(video.vimeoId);

        // Prefer English captions, then any active track, then first available
        const track =
          tracks.find((t) => t.language === "en" && t.active) ??
          tracks.find((t) => t.active) ??
          tracks[0];

        if (!track?.link) {
          // Mark as empty string so we don't retry
          await db
            .from("Video")
            .update({ transcript: "", updatedAt: new Date().toISOString() })
            .eq("id", video.id);
          noTrack++;
          continue;
        }

        const raw = await fetchTranscriptContent(track.link);
        const text = parseTranscriptToText(raw);

        await db
          .from("Video")
          .update({ transcript: text, updatedAt: new Date().toISOString() })
          .eq("id", video.id);
        fetched++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: (videos ?? []).length,
      fetched,
      noTrack,
      errors,
      remaining: (count ?? 0) - (videos ?? []).length,
      hasMore: ((count ?? 0) - (videos ?? []).length) > 0,
    });
  } catch (err) {
    return handleApiError(err, "Videos Transcripts");
  }
}
