"use client";

import { useRef, useState } from "react";
import {
  Upload, X, Sparkles, CheckCircle2, AlertCircle,
  Loader2, Save, ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { Translation } from "./types";
import { LANGUAGES, CONTENT_CATEGORIES } from "./types";

interface FileItem {
  id: string;
  name: string;
  text: string;
  status: "pending" | "translating" | "done" | "error";
  translated: string;
  error: string;
  expanded: boolean;
}

interface Props {
  buildCombinedRules: (lang: string) => string;
  getLangRules: (lang: string) => string;
  onSaved: (t: Translation) => void;
}

export function BulkUploadTab({ buildCombinedRules, getLangRules, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [category, setCategory] = useState("General");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const addFiles = (incoming: File[]) => {
    const txtFiles = incoming.filter((f) => f.type === "text/plain" || f.name.endsWith(".txt"));
    if (txtFiles.length === 0) return;
    const readers = txtFiles.map(
      (f) =>
        new Promise<FileItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: `${f.name}-${Date.now()}-${Math.random()}`,
              name: f.name.replace(/\.txt$/i, ""),
              text: (reader.result as string).trim(),
              status: "pending",
              translated: "",
              error: "",
              expanded: false,
            });
          reader.readAsText(f);
        })
    );
    Promise.all(readers).then((items) =>
      setFiles((prev) => [...prev, ...items])
    );
  };

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const toggleExpand = (id: string) =>
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, expanded: !f.expanded } : f));

  const updateFile = (id: string, patch: Partial<FileItem>) =>
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));

  const translateOne = async (item: FileItem, rules: string): Promise<void> => {
    updateFile(item.id, { status: "translating", error: "" });
    try {
      const res = await authFetch("/api/translations/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, targetLanguage, rules }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateFile(item.id, { status: "error", error: data.error || "Translation failed" });
      } else {
        updateFile(item.id, { status: "done", translated: data.translated });
      }
    } catch (err) {
      updateFile(item.id, { status: "error", error: err instanceof Error ? err.message : "Network error" });
    }
  };

  const handleTranslateAll = async () => {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (pending.length === 0) return;
    setRunning(true);
    setProgress(0);

    const rules = buildCombinedRules(targetLanguage);
    const CHUNK = 3;
    let completed = 0;

    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK);
      await Promise.allSettled(chunk.map((item) => translateOne(item, rules)));
      completed += chunk.length;
      setProgress(Math.round((completed / pending.length) * 100));
    }

    setRunning(false);
  };

  const handleSaveOne = async (item: FileItem) => {
    if (!item.translated) return;
    setSavingId(item.id);
    try {
      const res = await authFetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.name,
          originalText: item.text,
          translatedText: item.translated,
          language: targetLanguage,
          category,
          publishedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedIds((prev) => new Set(Array.from(prev).concat(item.id)));
        onSaved(data.translation);
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    const done = files.filter((f) => f.status === "done" && !savedIds.has(f.id));
    for (const item of done) {
      await handleSaveOne(item);
    }
  };

  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const unsavedDone = files.filter((f) => f.status === "done" && !savedIds.has(f.id)).length;

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50"
      >
        <Upload className="h-8 w-8 text-gray-400 mb-3" />
        <p className="font-semibold text-gray-700">Drop .txt files here or click to browse</p>
        <p className="mt-1 text-sm text-gray-500">Multiple files supported — each file becomes one translation</p>
        <input ref={fileInputRef} type="file" accept=".txt,text/plain" multiple className="hidden" onChange={handleFileInput} />
      </div>

      {files.length > 0 && (
        <>
          {/* Controls */}
          <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-40">
                <label className="mb-1 block text-xs font-medium text-gray-700">Target Language</label>
                <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white">
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}{getLangRules(l) ? " ✓" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-36">
                <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white">
                  {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTranslateAll}
                  disabled={running || pendingCount + errorCount === 0}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm"
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {running ? "Translating…" : `Translate ${pendingCount + errorCount} file${pendingCount + errorCount !== 1 ? "s" : ""}`}
                </button>
                {unsavedDone > 0 && !running && (
                  <button onClick={handleSaveAll}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 shadow-sm">
                    <Save className="h-4 w-4" /> Save All ({unsavedDone})
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {(running || (progress > 0 && progress < 100)) && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Progress</span>
                  <span className="text-xs font-semibold text-brand-600">{progress}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex gap-4 text-xs text-gray-500">
                  {doneCount > 0 && <span className="text-green-600 font-medium">✓ {doneCount} done</span>}
                  {errorCount > 0 && <span className="text-red-500 font-medium">✗ {errorCount} failed</span>}
                  <span>{files.filter((f) => f.status === "translating").length > 0 ? "Translating…" : ""}</span>
                </div>
              </div>
            )}

            {/* Summary when done */}
            {!running && progress === 100 && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-gray-700">
                  Batch complete — {doneCount} translated{errorCount > 0 ? `, ${errorCount} failed` : ""}
                </span>
                {errorCount > 0 && (
                  <button onClick={handleTranslateAll} className="ml-auto text-xs text-brand-600 hover:underline font-medium">
                    Retry failed
                  </button>
                )}
              </div>
            )}
          </div>

          {/* File list */}
          <div className="space-y-2">
            {files.map((item) => (
              <div key={item.id} className={`rounded-xl border bg-white overflow-hidden shadow-sm ${
                item.status === "done" ? "border-green-200" :
                item.status === "error" ? "border-red-200" :
                item.status === "translating" ? "border-brand-200" :
                "border-gray-300"
              }`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <FileText className={`h-4 w-4 shrink-0 ${
                    item.status === "done" ? "text-green-500" :
                    item.status === "error" ? "text-red-400" :
                    item.status === "translating" ? "text-brand-500" :
                    "text-gray-400"
                  }`} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.text.split(/\s+/).filter(Boolean).length} words</p>
                  </div>

                  {/* Status indicator */}
                  <div className="shrink-0">
                    {item.status === "pending" && <span className="text-xs text-gray-400 font-medium">Pending</span>}
                    {item.status === "translating" && <Loader2 className="h-4 w-4 animate-spin text-brand-500" />}
                    {item.status === "done" && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {savedIds.has(item.id) ? "Saved" : "Done"}
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                        <AlertCircle className="h-3.5 w-3.5" /> Error
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === "done" && !savedIds.has(item.id) && (
                      <button onClick={() => handleSaveOne(item)} disabled={savingId === item.id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                        {savingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                      </button>
                    )}
                    {item.status === "done" && (
                      <button onClick={() => toggleExpand(item.id)}
                        className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50">
                        {item.expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button onClick={() => removeFile(item.id)} disabled={running}
                      className="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-400 disabled:opacity-30">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {item.status === "error" && item.error && (
                  <div className="border-t border-red-100 bg-red-50 px-4 py-2">
                    <p className="text-xs text-red-600">{item.error}</p>
                  </div>
                )}

                {/* Expanded translation preview */}
                {item.expanded && item.status === "done" && (
                  <div className="border-t border-gray-100 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                    <div className="px-4 py-3">
                      <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Original</p>
                      <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto">{item.text}</pre>
                    </div>
                    <div className="px-4 py-3">
                      <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{targetLanguage}</p>
                      <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto">{item.translated}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
