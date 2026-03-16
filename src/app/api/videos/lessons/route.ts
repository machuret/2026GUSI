export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleApiError } from "@/lib/apiHelpers";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import {
  GUSI_ESSENTIALS_COURSE,
  GUSI_ESSENTIALS_LESSONS,
  parseDuration,
  extractVimeoId,
} from "@/app/videos/lessons/seed";

// GET /api/videos/lessons?course=GUSI+Essentials
// Returns lessons enriched with transcript + translation status
export async function GET(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const courseName = req.nextUrl.searchParams.get("course") || GUSI_ESSENTIALS_COURSE;

    // 1. Fetch all lessons for this course
    const { data: lessons, error: lessonsErr } = await db
      .from("VideoLesson")
      .select("*")
      .eq("companyId", DEMO_COMPANY_ID)
      .eq("courseName", courseName)
      .order("sortOrder", { ascending: true });

    if (lessonsErr) throw lessonsErr;
    if (!lessons || lessons.length === 0) {
      return NextResponse.json({ lessons: [], stats: null, courseName });
    }

    // 2. Get all vimeoIds from lessons
    const vimeoIds = lessons.map((l: any) => l.vimeoId);

    // 3. Fetch matching Videos (for transcript status)
    const { data: videos } = await db
      .from("Video")
      .select("vimeoId, transcript, title")
      .in("vimeoId", vimeoIds);

    const videoMap = new Map<string, { transcript: string | null; title: string }>();
    for (const v of videos ?? []) {
      videoMap.set(v.vimeoId, { transcript: v.transcript, title: v.title });
    }

    // 4. Fetch matching Translations (check if any translation exists for each video title)
    // We look for translations whose title starts with the video title
    const videoTitles = (videos ?? []).map((v: any) => v.title).filter(Boolean);
    let translationSet = new Set<string>();

    if (videoTitles.length > 0) {
      // Fetch all translations and match client-side (more reliable than many OR queries)
      const { data: translations } = await db
        .from("Translation")
        .select("title, language")
        .eq("companyId", DEMO_COMPANY_ID);

      if (translations) {
        for (const t of translations) {
          // Match if translation title starts with any video title
          for (const vTitle of videoTitles) {
            if (t.title && t.title.startsWith(vTitle)) {
              translationSet.add(vTitle);
              break;
            }
          }
        }
      }
    }

    // 5. Enrich lessons
    const enriched = lessons.map((lesson: any) => {
      const video = videoMap.get(lesson.vimeoId);
      const hasVideo = !!video;
      const hasTranscript = hasVideo && !!video.transcript && video.transcript.trim().length > 0;
      const hasTranslation = hasVideo && translationSet.has(video.title);

      return {
        ...lesson,
        hasVideo,
        hasTranscript,
        hasTranslation,
        transcriptWordCount: hasTranscript
          ? video!.transcript!.split(/\s+/).filter(Boolean).length
          : 0,
      };
    });

    // 6. Stats
    const stats = {
      totalLessons: enriched.length,
      totalDuration: enriched.reduce((s: number, l: any) => s + l.durationSeconds, 0),
      withVideo: enriched.filter((l: any) => l.hasVideo).length,
      withTranscript: enriched.filter((l: any) => l.hasTranscript).length,
      withTranslation: enriched.filter((l: any) => l.hasTranslation).length,
      withAudio: enriched.filter((l: any) => l.hasAudio).length,
      modules: Array.from(new Set(enriched.map((l: any) => l.module))),
    };

    return NextResponse.json({ lessons: enriched, stats, courseName });
  } catch (err) {
    return handleApiError(err, "VideoLessons GET");
  }
}

// POST /api/videos/lessons — seed the GUSI Essentials course
export async function POST(req: NextRequest) {
  try {
    const { response: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const action = body.action || "seed";

    if (action === "seed") {
      const courseName = body.courseName || GUSI_ESSENTIALS_COURSE;

      // Check if already seeded
      const { count } = await db
        .from("VideoLesson")
        .select("id", { count: "exact", head: true })
        .eq("companyId", DEMO_COMPANY_ID)
        .eq("courseName", courseName);

      if (count && count > 0) {
        return NextResponse.json({ message: `Course "${courseName}" already has ${count} lessons`, seeded: false });
      }

      // Build rows
      const rows = GUSI_ESSENTIALS_LESSONS.map(([module, title, durationLabel, vimeoUrl], i) => ({
        companyId: DEMO_COMPANY_ID,
        courseName,
        module,
        title,
        durationSeconds: parseDuration(durationLabel),
        durationLabel,
        vimeoUrl,
        vimeoId: extractVimeoId(vimeoUrl),
        sortOrder: i + 1,
      }));

      // Insert in batches of 50 (Supabase limit)
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await db.from("VideoLesson").insert(batch);
        if (error) throw error;
      }

      return NextResponse.json({ message: `Seeded ${rows.length} lessons for "${courseName}"`, seeded: true, count: rows.length });
    }

    // getTranscripts — fetch transcript text for given vimeoIds
    if (action === "getTranscripts") {
      const vimeoIds: string[] = body.vimeoIds;
      if (!vimeoIds || vimeoIds.length === 0) {
        return NextResponse.json({ error: "vimeoIds required" }, { status: 400 });
      }

      const { data: videos } = await db
        .from("Video")
        .select("vimeoId, title, transcript")
        .in("vimeoId", vimeoIds);

      const transcripts: Record<string, { title: string; transcript: string }> = {};
      for (const v of videos ?? []) {
        if (v.transcript && v.transcript.trim()) {
          transcripts[v.vimeoId] = { title: v.title, transcript: v.transcript };
        }
      }

      return NextResponse.json({ transcripts });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handleApiError(err, "VideoLessons POST");
  }
}
