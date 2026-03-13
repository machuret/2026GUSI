"use client";

import { Play, Clock, Tag, ExternalLink } from "lucide-react";
import { Video, VideoCategory } from "../types";
import { formatDuration } from "../helpers";

interface Props {
  video: Video;
  categories: VideoCategory[];
  assigningId: string | null;
  onSelect: (v: Video) => void;
  onAssign: (videoId: string, categoryId: string | null) => void;
}

export function VideoListRow({ video: v, categories, assigningId, onSelect, onAssign }: Props) {
  const cat = categories.find((c) => c.id === v.categoryId);
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 shrink-0 cursor-pointer" onClick={() => onSelect(v)}>
        {v.thumbnailUrl ? (
          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Play className="h-5 w-5 text-gray-300" /></div>
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-mono text-white">
          {formatDuration(v.duration)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600" onClick={() => onSelect(v)}>
            {v.title}
          </h3>
          {cat && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: cat.color }}>
              {cat.name}
            </span>
          )}
        </div>
        {v.description && <p className="text-xs text-gray-400 truncate mt-0.5">{v.description}</p>}
        <div className="flex items-center gap-3 mt-1">
          {v.publishedAt && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(v.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {v.tags.length > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Tag className="h-3 w-3" /> {v.tags.slice(0, 3).join(", ")}
            </span>
          )}
        </div>
      </div>
      <select value={v.categoryId || ""} onChange={(e) => onAssign(v.id, e.target.value || null)} disabled={assigningId === v.id}
        className="w-36 shrink-0 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-indigo-400 focus:outline-none bg-white"
        style={cat ? { borderColor: cat.color, color: cat.color } : {}}>
        <option value="">Uncategorized</option>
        {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </select>
      {assigningId === v.id && <span className="shrink-0 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />}
      <a href={v.vimeoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-400 hover:text-indigo-600">
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
