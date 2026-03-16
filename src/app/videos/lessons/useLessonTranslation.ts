"use client";

import { useState, useRef } from "react";
import { authFetch } from "@/lib/authFetch";
import { useRules } from "@/app/translations/hooks/useRules";

interface Lesson {
  id: string;
  vimeoId: string;
  title: string;
  hasTranscript: boolean;
  hasTranslation: boolean;
}

export interface TranslateProgress {
  current: number;
  total: number;
  saved: number;
  currentTitle: string;
}

interface UseLessonTranslationOptions {
  targetLanguage: string;
  category: string;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function useLessonTranslation({ targetLanguage, category, onRefresh, onError }: UseLessonTranslationOptions) {
  const { buildCombinedRules } = useRules();
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<TranslateProgress | null>(null);
  const cancelRef = useRef(false);

  async function fetchTranscripts(vimeoIds: string[]): Promise<Record<string, { title: string; transcript: string }>> {
    const res = await authFetch("/api/videos/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getTranscripts", vimeoIds }),
    });
    const data = await res.json();
    return data.transcripts ?? {};
  }

  async function translateAndSave(videoTitle: string, transcript: string): Promise<boolean> {
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
    if (!translateRes.ok) throw new Error(translateData.error || "Translation failed");

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

  async function translateLessons(lessonsToTranslate: Lesson[]) {
    const eligible = lessonsToTranslate.filter((l) => l.hasTranscript && !l.hasTranslation);
    if (eligible.length === 0) {
      onError("No lessons need translation — all already translated or missing transcripts.");
      setTimeout(() => onError(""), 5000);
      return;
    }

    cancelRef.current = false;
    setTranslating(true);
    setTranslateProgress({ current: 0, total: eligible.length, saved: 0, currentTitle: "" });

    let transcripts: Record<string, { title: string; transcript: string }>;
    try {
      transcripts = await fetchTranscripts(eligible.map((l) => l.vimeoId));
    } catch (err) {
      onError("Failed to fetch transcripts: " + (err instanceof Error ? err.message : "Unknown"));
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
        const ok = await translateAndSave(data.title, data.transcript);
        if (ok) saved++;
      } catch (err) {
        onError(`Error translating "${lesson.title}": ${err instanceof Error ? err.message : "Unknown"}`);
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

    await onRefresh();
    setTimeout(() => setTranslateProgress(null), 8000);
  }

  const handleCancel = () => { cancelRef.current = true; };

  return {
    translating,
    translateProgress,
    buildCombinedRules,
    translateLessons,
    handleCancel,
  };
}
