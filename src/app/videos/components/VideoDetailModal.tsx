"use client";

import { useState } from "react";
import { X, Clock, ExternalLink, Loader2, FileText } from "lucide-react";
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

  // Load full video (with transcript) on mount
  useState(() => {
    (async () => {
      try {
        const res = await authFetch(`/api/videos/${video.id}`);
        const data = await res.json();
        if (data.video) onVideoLoaded(data.video);
      } catch { /* use existing data */ }
      finally { setLoadingDetail(false); }
    })();
  });

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
          {/* Transcript — loaded on demand */}
          {loadingDetail ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading transcript…
            </div>
          ) : video.transcript ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Transcript
              </h3>
              <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                {video.transcript}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-400 flex items-center gap-1">
              <FileText className="h-3 w-3" /> No transcript available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
