"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { PostEntry } from "./ManualPanel";

interface Props {
  filePosts: PostEntry[];
  onRemove: (i: number) => void;
  onAdded: (post: PostEntry) => void;
}

export function FilePanel({ filePosts, onRemove, onAdded }: Props) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File) => {
    setParsing(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/content/parse-file", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) {
        onAdded({ title: file.name.replace(/\.[^.]+$/, ""), body: d.text, contentType: "blog", platform: "document", tags: "" });
      } else {
        setError(d.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setParsing(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files).forEach((f) => parseFile(f));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-brand-400 bg-brand-50" : "border-gray-300 hover:border-brand-300 hover:bg-gray-50"
        }`}
      >
        <Upload className="mx-auto mb-3 h-8 w-8 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
        <p className="mt-1 text-xs text-gray-400">Supports PDF, DOCX, TXT, MD</p>
        <input
          ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden"
          onChange={(e) => Array.from(e.target.files ?? []).forEach((f) => parseFile(f))}
        />
      </div>
      {parsing && <p className="mt-3 text-sm text-brand-600 animate-pulse">Parsing file...</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {filePosts.length > 0 && (
        <div className="mt-4 space-y-2">
          {filePosts.map((p, i) => (
            <div key={i} className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                <p className="text-xs text-gray-400">{p.body.trim().split(/\s+/).length} words</p>
              </div>
              <button onClick={() => onRemove(i)} className="ml-3 text-gray-300 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
