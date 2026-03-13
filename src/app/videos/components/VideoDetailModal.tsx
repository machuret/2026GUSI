"use client";

import { useState, useEffect } from "react";
import { X, Clock, ExternalLink, Loader2, FileText, Pencil, Save, Check } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { Video, VideoCategory } from "../types";
import { formatDuration } from "../helpers";

interface Props {
  video: Video;
  categories: VideoCategory[];
  assigningId: string | null;
  onClose: () => void;
  onAssign: (videoId: string, categoryId: string | null) => void;
  onVideoLoaded: (video: Video) => void;
}

export function VideoDetailModal({ video, categories, assigningId, onClose, onAssign, onVideoLoaded }: Props) {
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const handleEditStart = () => {
    setEditText(video.transcript || "");
    setEditingTranscript(true);
    setSavedOk(false);
  };

  const handleSaveTranscript = async () => {
    setSavingTranscript(true);
    try {
      const res = await authFetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: editText }),
      });
      const data = await res.json();
      if (res.ok && data.video) {
        onVideoLoaded(data.video);
        setEditingTranscript(false);
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      }
    } catch { /* silent */ }
    finally { setSavingTranscript(false); }
  };

  // Load full video (with transcript) on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/videos/${video.id}`);
        const data = await res.json();
        if (!cancelled && data.video) onVideoLoaded(data.video);
      } catch { /* use existing data */ }
      finally { if (!cancelled) setLoadingDetail(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 hover:text-gray-800 shadow">
          <X className="h-5 w-5" />
        </button>
        <div className="aspect-video bg-black shrink-0" dangerouslySetInnerHTML={{ __html: video.embedHtml.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }} />
        <div className="p-5 overflow-y-auto">
          <h2 className="text-lg font-bold text-gray-900 mb-1">{video.title}</h2>
          {video.description && <p className="text-sm text-gray-500 whitespace-pre-wrap mb-3 max-h-32 overflow-y-auto">{video.description}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(video.duration)}</span>
            <span>{video.width}×{video.height}</span>
            {video.publishedAt && <span>{new Date(video.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>}
            <a href={video.vimeoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700">
              <ExternalLink className="h-3.5 w-3.5" /> View on Vimeo
            </a>
          </div>
          {video.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {video.tags.map((t) => (
                <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{t}</span>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600">Category:</label>
            <select value={video.categoryId || ""} onChange={(e) => onAssign(video.id, e.target.value || null)} disabled={assigningId === video.id}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none bg-white">
              <option value="">Uncategorized</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            {assigningId === video.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          {/* Transcript — loaded on demand, editable */}
          {loadingDetail ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading transcript…
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Transcript
                  {video.transcript && (
                    <span className="font-normal text-gray-400 ml-1">
                      {video.transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                    </span>
                  )}
                  {savedOk && (
                    <span className="flex items-center gap-1 text-green-600 font-medium ml-2">
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}
                </h3>
                {!editingTranscript ? (
                  <button onClick={handleEditStart}
                    className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50">
                    <Pencil className="h-3 w-3" /> {video.transcript ? "Edit" : "Add transcript"}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleSaveTranscript} disabled={savingTranscript}
                      className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                      {savingTranscript ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      {savingTranscript ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingTranscript(false)}
                      className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {editingTranscript ? (
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={12}
                  className="w-full rounded-lg border border-indigo-300 bg-white p-3 text-xs text-gray-700 leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              ) : video.transcript ? (
                <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {video.transcript}
                </div>
              ) : (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  No transcript available — click &quot;Add transcript&quot; to add one manually.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
