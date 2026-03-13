"use client";

import { Play, Clock, Loader2 } from "lucide-react";
import { Video, VideoCategory } from "../types";
import { formatDuration } from "../helpers";

interface Props {
  video: Video;
  categories: VideoCategory[];
  assigningId: string | null;
  onSelect: (v: Video) => void;
  onAssign: (videoId: string, categoryId: string | null) => void;
}

export function VideoCard({ video: v, categories, assigningId, onSelect, onAssign }: Props) {
  const cat = categories.find((c) => c.id === v.categoryId);
  return (
    <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-video bg-gray-100 cursor-pointer" onClick={() => onSelect(v)}>
        {v.thumbnailUrl ? (
          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Play className="h-8 w-8 text-gray-300" /></div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-white">
          {formatDuration(v.duration)}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 cursor-pointer hover:text-indigo-600" onClick={() => onSelect(v)}>
          {v.title}
        </h3>
        {v.publishedAt && (
          <p className="text-[10px] text-gray-400 flex items-center gap-1 mb-2">
            <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
        <div className="flex items-center gap-1.5">
          <select value={v.categoryId || ""} onChange={(e) => onAssign(v.id, e.target.value || null)} disabled={assigningId === v.id}
            className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 focus:border-indigo-400 focus:outline-none bg-white truncate"
            style={cat ? { borderColor: cat.color, color: cat.color } : {}}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          {assigningId === v.id && <Loader2 className="h-3 w-3 animate-spin text-gray-400 shrink-0" />}
        </div>
      </div>
    </div>
  );
}
