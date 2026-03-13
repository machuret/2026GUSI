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

const RATE_LIMIT_MS = 200; // pause between Vimeo API calls to respect rate limits
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST /api/videos/transcripts?batch=10
// Fetches transcripts for videos that don't have one yet.
// Processes `batch` videos per request with rate-limit delays.
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const batch = Math.min(20, Math.max(1, parseInt(req.nextUrl.searchParams.get("batch") || "10", 10)));

    // Count total remaining BEFORE processing
    const { count: totalRemaining } = await db
      .from("Video")
      .select("id", { count: "exact", head: true })
      .eq("companyId", DEMO_COMPANY_ID)
      .is("transcript", null);

    // Get next batch of videos without transcripts (always offset 0 since processed ones leave the queue)
    const { data: videos, error: fetchErr } = await db
      .from("Video")
      .select("id, vimeoId, title")
      .eq("companyId", DEMO_COMPANY_ID)
      .is("transcript", null)
      .order("createdAt", { ascending: true })
      .limit(batch);

    if (fetchErr) throw fetchErr;

    let fetched = 0;
    let noTrack = 0;
    let errors = 0;
    const now = new Date().toISOString();
    const noTrackIds: string[] = [];

    for (const video of videos ?? []) {
      try {
        const tracks = await fetchVideoTextTracks(video.vimeoId);

        // Prefer English captions, then any active track, then first available
        const track =
          tracks.find((t) => t.language === "en" && t.active) ??
          tracks.find((t) => t.active) ??
          tracks[0];

        if (!track?.link) {
          noTrackIds.push(video.id);
          noTrack++;
        } else {
          await sleep(RATE_LIMIT_MS); // rate-limit before download
          const raw = await fetchTranscriptContent(track.link);
          const text = parseTranscriptToText(raw);

          await db
            .from("Video")
            .update({ transcript: text, updatedAt: now })
            .eq("id", video.id);
          fetched++;
        }

        await sleep(RATE_LIMIT_MS); // rate-limit between texttracks calls
      } catch {
        // Mark failed videos so we don't retry endlessly
        noTrackIds.push(video.id);
        errors++;
      }
    }

    // Batch update all no-track/failed videos in one DB call
    if (noTrackIds.length > 0) {
      await db
        .from("Video")
        .update({ transcript: "", updatedAt: now })
        .in("id", noTrackIds);
    }

    const processed = (videos ?? []).length;
    const remaining = (totalRemaining ?? 0) - processed;

    return NextResponse.json({
      success: true,
      processed,
      fetched,
      noTrack,
      errors,
      remaining: Math.max(0, remaining),
      hasMore: remaining > 0,
    });
  } catch (err) {
    return handleApiError(err, "Videos Transcripts");
  }
}
