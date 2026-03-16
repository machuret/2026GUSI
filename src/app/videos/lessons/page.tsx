"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BookOpen, Loader2, FileText, Languages, Volume2,
  CheckCircle2, XCircle, ArrowLeft, Clock,
  ChevronDown, ExternalLink, Zap, Ban, Settings,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useRules } from "@/app/translations/hooks/useRules";
import { LANGUAGES, CONTENT_CATEGORIES } from "@/app/translations/types";

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

interface TranslateProgress {
  current: number;
  total: number;
  saved: number;
  currentTitle: string;
}

function formatTotalDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ ok, label, text }: { ok: boolean; label: string; text: string }) {
  return (
    <span title={text} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
      ok ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {text} {label}
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Translation state
  const { buildCombinedRules } = useRules();
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [category, setCategory] = useState("Course Content");
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<TranslateProgress | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const cancelRef = useRef(false);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/videos/lessons?language=${encodeURIComponent(targetLanguage)}`);
      const data = await res.json();
      setLessons(data.lessons ?? []);
      setStats(data.stats ?? null);
      setCourseName(data.courseName ?? "");
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLessons(); }, [targetLanguage]);

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

  // ── Translation helpers ──

  /** Fetch transcript text for a set of vimeoIds */
  async function fetchTranscripts(vimeoIds: string[]): Promise<Record<string, { title: string; transcript: string }>> {
    const res = await authFetch("/api/videos/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getTranscripts", vimeoIds }),
    });
    const data = await res.json();
    return data.transcripts ?? {};
  }

  /** Translate a single lesson transcript and save to Translation library */
  async function translateAndSave(
    vimeoId: string,
    videoTitle: string,
    transcript: string,
  ): Promise<boolean> {
    // Step 1: Translate via AI with rules
    const translateRes = await authFetch("/api/translations/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: transcript,
        targetLanguage,
        category,
        rules: buildCombinedRules(targetLanguage),
      }),
    });
    const translateData = await translateRes.json();
    if (!translateRes.ok) {
      throw new Error(translateData.error || "Translation failed");
    }

    // Step 2: Save to Translation library
    const saveRes = await authFetch("/api/translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${videoTitle} — ${targetLanguage}`,
        originalText: transcript,
        translatedText: translateData.translated,
        language: targetLanguage,
        category,
        publishedAt: new Date().toISOString(),
      }),
    });
    return saveRes.ok;
  }

  /** Translate a batch of lessons (used for single lesson or whole module) */
  async function translateLessons(lessonsToTranslate: Lesson[]) {
    // Filter to only those with transcripts and without translations
    const eligible = lessonsToTranslate.filter((l) => l.hasTranscript && !l.hasTranslation);
    if (eligible.length === 0) {
      setErrorMsg("No lessons need translation — all already translated or missing transcripts.");
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }

    cancelRef.current = false;
    setTranslating(true);
    setTranslateProgress({ current: 0, total: eligible.length, saved: 0, currentTitle: "" });

    // Fetch all transcripts in one batch
    const vimeoIds = eligible.map((l) => l.vimeoId);
    let transcripts: Record<string, { title: string; transcript: string }>;
    try {
      transcripts = await fetchTranscripts(vimeoIds);
    } catch (err) {
      setErrorMsg("Failed to fetch transcripts: " + (err instanceof Error ? err.message : "Unknown"));
      setTranslating(false);
      setTranslateProgress(null);
      return;
    }

    let saved = 0;
    for (let i = 0; i < eligible.length; i++) {
      if (cancelRef.current) break;
      const lesson = eligible[i];
      const data = transcripts[lesson.vimeoId];
      if (!data) {
        setTranslateProgress({ current: i + 1, total: eligible.length, saved, currentTitle: lesson.title });
        continue;
      }

      setTranslateProgress({ current: i + 1, total: eligible.length, saved, currentTitle: lesson.title });

      try {
        const ok = await translateAndSave(lesson.vimeoId, data.title, data.transcript);
        if (ok) saved++;
      } catch (err) {
        setErrorMsg(`Error translating "${lesson.title}": ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    const wasCancelled = cancelRef.current;
    setTranslateProgress({
      current: wasCancelled ? saved : eligible.length,
      total: eligible.length,
      saved,
      currentTitle: "",
    });
    setTranslating(false);

    // Refresh data to show updated statuses
    await fetchLessons();

    // Keep progress visible for a bit
    setTimeout(() => setTranslateProgress(null), 8000);
  }

  const handleTranslateLesson = (lesson: Lesson) => translateLessons([lesson]);
  const handleTranslateModule = (moduleLessons: Lesson[]) => translateLessons(moduleLessons);
  const handleTranslateAll = () => translateLessons(lessons);
  const handleCancel = () => { cancelRef.current = true; };

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

  const untranslatedWithTranscript = lessons.filter((l) => l.hasTranscript && !l.hasTranslation).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Error banner */}
      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600"><XCircle className="h-4 w-4" /></button>
        </div>
      )}

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

      {/* Translation controls bar */}
      {stats && lessons.length > 0 && !translating && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Languages className="h-5 w-5 text-indigo-600 shrink-0" />
            <span className="text-sm font-semibold text-indigo-800">Translate Lessons</span>

            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}
              className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>

            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300">
              {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {untranslatedWithTranscript > 0 && (
              <button onClick={handleTranslateAll} disabled={translating}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50">
                <Languages className="h-3.5 w-3.5" />
                Translate All ({untranslatedWithTranscript} lessons)
              </button>
            )}

            <button onClick={() => setShowSettings(!showSettings)}
              title="Translation rules are loaded from /translations settings"
              className={`rounded-lg border p-1.5 text-xs transition-colors ${showSettings ? "border-indigo-400 bg-indigo-100 text-indigo-700" : "border-indigo-300 text-indigo-500 hover:bg-indigo-100"}`}>
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>

          {showSettings && (
            <div className="mt-3 rounded-lg bg-white border border-indigo-200 px-4 py-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-700 mb-1">Translation Rules Applied</p>
              <p className="text-gray-500 mb-2">
                Rules are loaded from the <Link href="/translations" className="text-indigo-600 underline hover:text-indigo-700">Translations page</Link> settings.
                Edit global and language-specific rules there.
              </p>
              <pre className="whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-200 p-2 text-[11px] text-gray-600 max-h-40 overflow-y-auto">
                {buildCombinedRules(targetLanguage) || "(No custom rules configured — using defaults)"}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Translation progress bar */}
      {translateProgress && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-indigo-700">
              {translating ? (
                <>Translating {translateProgress.current} of {translateProgress.total}: <span className="font-normal italic">{translateProgress.currentTitle}</span></>
              ) : (
                <>Done! {translateProgress.saved} lesson{translateProgress.saved !== 1 ? "s" : ""} translated and saved to Library</>
              )}
            </span>
            {!translating && (
              <Link href="/translations" className="text-xs text-indigo-600 hover:underline font-medium">
                View in Library →
              </Link>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.round((translateProgress.current / translateProgress.total) * 100)}%` }} />
          </div>
          {translating && (
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-indigo-500">{translateProgress.saved} saved so far · using {targetLanguage} translation rules</p>
              <button onClick={handleCancel}
                className="flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                <Ban className="h-3 w-3" /> Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {stats && lessons.length > 0 && !translating && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-500">
          <span className="font-semibold text-gray-600">Status columns:</span>
          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-gray-400" /> <strong>Transcript</strong> — extracted from Vimeo</span>
          <span className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5 text-gray-400" /> <strong>Translation</strong> — AI-translated</span>
          <span className="flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5 text-gray-400" /> <strong>Audio</strong> — ElevenLabs voiceover</span>
          <span className="flex items-center gap-2 ml-auto text-[11px]">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>
            <span className="flex items-center gap-1 text-red-400"><XCircle className="h-3.5 w-3.5" /> Missing</span>
          </span>
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
            const modUntranslated = mod.lessons.filter((l) => l.hasTranscript && !l.hasTranslation).length;

            return (
              <div key={mod.name} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Module header */}
                <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <button onClick={() => toggleModule(mod.name)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
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
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge ok={modTranscripts === mod.lessons.length} label={`${modTranscripts}/${mod.lessons.length}`} text="Transcript" />
                    <StatusBadge ok={modTranslations === mod.lessons.length} label={`${modTranslations}/${mod.lessons.length}`} text="Translation" />
                    <StatusBadge ok={modAudio === mod.lessons.length} label={`${modAudio}/${mod.lessons.length}`} text="Audio" />
                    {modUntranslated > 0 && !translating && (
                      <button onClick={() => handleTranslateModule(mod.lessons)}
                        title={`Translate ${modUntranslated} untranslated lesson${modUntranslated !== 1 ? "s" : ""} in this module`}
                        className="ml-1 flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 shadow-sm">
                        <Languages className="h-3 w-3" /> Translate {modUntranslated}
                      </button>
                    )}
                  </div>
                </div>

                {/* Lessons */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-5 py-2 bg-gray-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <span className="w-6 text-center">#</span>
                      <span className="w-12 text-center">Length</span>
                      <span className="flex-1">Lesson Title</span>
                      <span className="w-20 text-center flex items-center justify-center gap-1"><FileText className="h-3 w-3" /> Transcript</span>
                      <span className="w-20 text-center flex items-center justify-center gap-1"><Languages className="h-3 w-3" /> Translation</span>
                      <span className="w-20 text-center flex items-center justify-center gap-1"><Volume2 className="h-3 w-3" /> Audio</span>
                      <span className="w-24" />
                    </div>
                    {mod.lessons.map((lesson, li) => {
                      const canTranslate = lesson.hasTranscript && !lesson.hasTranslation && !translating;
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                          <span className="w-6 text-center text-[10px] font-mono text-gray-400">{li + 1}</span>
                          <span className="w-12 text-center text-xs font-mono text-gray-500">{lesson.durationLabel}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{lesson.title}</p>
                            {lesson.hasTranscript && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{lesson.transcriptWordCount.toLocaleString()} words</p>
                            )}
                          </div>
                          <div className="w-20 text-center" title={lesson.hasTranscript ? `Transcript available (${lesson.transcriptWordCount.toLocaleString()} words)` : "No transcript yet"}>
                            {lesson.hasTranscript
                              ? <span className="inline-flex items-center gap-1 text-green-600 text-[10px] font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                              : <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-medium"><XCircle className="h-3.5 w-3.5" /> No</span>}
                          </div>
                          <div className="w-20 text-center" title={lesson.hasTranslation ? "Translation available" : "No translation yet"}>
                            {lesson.hasTranslation
                              ? <span className="inline-flex items-center gap-1 text-green-600 text-[10px] font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                              : <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-medium"><XCircle className="h-3.5 w-3.5" /> No</span>}
                          </div>
                          <div className="w-20 text-center" title={lesson.hasAudio ? "Audio available" : "No audio yet"}>
                            {lesson.hasAudio
                              ? <span className="inline-flex items-center gap-1 text-green-600 text-[10px] font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
                              : <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-medium"><XCircle className="h-3.5 w-3.5" /> No</span>}
                          </div>
                          <div className="w-24 flex items-center justify-end gap-1">
                            {canTranslate && (
                              <button onClick={() => handleTranslateLesson(lesson)}
                                title={`Translate to ${targetLanguage}`}
                                className="flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100">
                                <Languages className="h-3 w-3" /> Translate
                              </button>
                            )}
                            <a href={lesson.vimeoUrl} target="_blank" rel="noopener noreferrer" title="Open in Vimeo"
                              className="flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom legend — compact reminder */}
      {!loading && lessons.length > 0 && (
        <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-400 justify-center">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Yes = Done</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-300" /> No = Missing</span>
        </div>
      )}
    </div>
  );
}
