"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen, Loader2, FileText, Languages, Volume2,
  CheckCircle2, XCircle, ArrowLeft, Play, Clock,
  ChevronDown, ExternalLink, Zap,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface Lesson {
  id: string;
  module: string;
  title: string;
  durationSeconds: number;
  durationLabel: string;
  vimeoUrl: string;
  vimeoId: string;
  sortOrder: number;
  hasVideo: boolean;
  hasTranscript: boolean;
  hasTranslation: boolean;
  hasAudio: boolean;
  transcriptWordCount: number;
}

interface Stats {
  totalLessons: number;
  totalDuration: number;
  withVideo: number;
  withTranscript: number;
  withTranslation: number;
  withAudio: number;
  modules: string[];
}

function formatTotalDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      ok ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function VideoLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/videos/lessons");
      const data = await res.json();
      setLessons(data.lessons ?? []);
      setStats(data.stats ?? null);
      setCourseName(data.courseName ?? "");
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLessons(); }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await authFetch("/api/videos/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      setSeedMsg(data.message);
      if (data.seeded) await fetchLessons();
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : "Seed failed");
    }
    finally { setSeeding(false); }
  };

  const toggleModule = (mod: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      next.has(mod) ? next.delete(mod) : next.add(mod);
      return next;
    });
  };

  // Group lessons by module (preserving order)
  const modules: { name: string; lessons: Lesson[] }[] = [];
  const seen = new Set<string>();
  for (const l of lessons) {
    if (!seen.has(l.module)) {
      seen.add(l.module);
      modules.push({ name: l.module, lessons: [] });
    }
    modules.find((m) => m.name === l.module)!.lessons.push(l);
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/videos" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-indigo-600" /> Video Lessons
            </h1>
          </div>
          <p className="mt-1 text-gray-500 ml-10">
            {courseName ? `Course: ${courseName}` : "Manage course video lessons and track readiness status."}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats.totalLessons}</p>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Lessons</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{formatTotalDuration(stats.totalDuration)}</p>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Total Duration</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats.modules.length}</p>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Modules</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-center shadow-sm ${stats.withTranscript === stats.totalLessons ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
            <p className={`text-2xl font-bold ${stats.withTranscript === stats.totalLessons ? "text-green-700" : "text-orange-700"}`}>
              {stats.withTranscript}/{stats.totalLessons}
            </p>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex items-center justify-center gap-1">
              <FileText className="h-3 w-3" /> Transcripts
            </p>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-center shadow-sm ${stats.withTranslation === stats.totalLessons ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
            <p className={`text-2xl font-bold ${stats.withTranslation === stats.totalLessons ? "text-green-700" : "text-orange-700"}`}>
              {stats.withTranslation}/{stats.totalLessons}
            </p>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex items-center justify-center gap-1">
              <Languages className="h-3 w-3" /> Translations
            </p>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-center shadow-sm ${stats.withAudio === stats.totalLessons ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}>
            <p className={`text-2xl font-bold ${stats.withAudio === stats.totalLessons ? "text-green-700" : "text-orange-700"}`}>
              {stats.withAudio}/{stats.totalLessons}
            </p>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex items-center justify-center gap-1">
              <Volume2 className="h-3 w-3" /> Audio
            </p>
          </div>
        </div>
      )}

      {/* Seed message */}
      {seedMsg && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700 font-medium">
          {seedMsg}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-20 text-center text-gray-400">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" /> Loading lessons…
        </div>
      )}

      {/* Empty — need to seed */}
      {!loading && lessons.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No lessons found</p>
          <p className="mt-1 text-sm text-gray-400">
            Seed the GUSI Essentials course to get started.
          </p>
          <button onClick={handleSeed} disabled={seeding}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {seeding ? "Seeding…" : "Seed GUSI Essentials (98 lessons)"}
          </button>
        </div>
      )}

      {/* Module list */}
      {!loading && modules.length > 0 && (
        <div className="space-y-3">
          {modules.map((mod, mi) => {
            const isCollapsed = collapsedModules.has(mod.name);
            const modTranscripts = mod.lessons.filter((l) => l.hasTranscript).length;
            const modTranslations = mod.lessons.filter((l) => l.hasTranslation).length;
            const modAudio = mod.lessons.filter((l) => l.hasAudio).length;
            const modDuration = mod.lessons.reduce((s, l) => s + l.durationSeconds, 0);

            return (
              <div key={mod.name} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Module header */}
                <button onClick={() => toggleModule(mod.name)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                  <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-gray-900">
                      <span className="text-indigo-600 mr-2">{String(mi + 1).padStart(2, "0")}</span>
                      {mod.name}
                    </h2>
                    <div className="flex items-center gap-4 mt-0.5">
                      <span className="text-[10px] text-gray-400">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {formatTotalDuration(modDuration)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge ok={modTranscripts === mod.lessons.length} label={`${modTranscripts}/${mod.lessons.length}`} />
                    <StatusBadge ok={modTranslations === mod.lessons.length} label={`${modTranslations}/${mod.lessons.length}`} />
                    <StatusBadge ok={modAudio === mod.lessons.length} label={`${modAudio}/${mod.lessons.length}`} />
                  </div>
                </button>

                {/* Lessons */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-5 py-1.5 bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <span className="w-6 text-center">#</span>
                      <span className="w-12 text-center">Length</span>
                      <span className="flex-1">Title</span>
                      <span className="w-16 text-center"><FileText className="h-3 w-3 mx-auto" /></span>
                      <span className="w-16 text-center"><Languages className="h-3 w-3 mx-auto" /></span>
                      <span className="w-16 text-center"><Volume2 className="h-3 w-3 mx-auto" /></span>
                      <span className="w-8" />
                    </div>
                    {mod.lessons.map((lesson, li) => (
                      <div key={lesson.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                        <span className="w-6 text-center text-[10px] font-mono text-gray-400">{li + 1}</span>
                        <span className="w-12 text-center text-xs font-mono text-gray-500">{lesson.durationLabel}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{lesson.title}</p>
                          {lesson.hasTranscript && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{lesson.transcriptWordCount.toLocaleString()} words</p>
                          )}
                        </div>
                        <div className="w-16 text-center">
                          {lesson.hasTranscript
                            ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            : <XCircle className="h-4 w-4 text-red-300 mx-auto" />}
                        </div>
                        <div className="w-16 text-center">
                          {lesson.hasTranslation
                            ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            : <XCircle className="h-4 w-4 text-red-300 mx-auto" />}
                        </div>
                        <div className="w-16 text-center">
                          {lesson.hasAudio
                            ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            : <XCircle className="h-4 w-4 text-red-300 mx-auto" />}
                        </div>
                        <a href={lesson.vimeoUrl} target="_blank" rel="noopener noreferrer" title="Open in Vimeo"
                          className="w-8 flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {!loading && lessons.length > 0 && (
        <div className="mt-6 flex items-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Transcript</span>
          <span className="flex items-center gap-1"><Languages className="h-3.5 w-3.5" /> Translation</span>
          <span className="flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" /> Audio (ElevenLabs)</span>
          <span className="flex items-center gap-1.5 ml-auto">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Available
            <XCircle className="h-3.5 w-3.5 text-red-300 ml-2" /> Missing
          </span>
        </div>
      )}
    </div>
  );
}
