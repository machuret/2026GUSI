"use client";

import { Mic2, ChevronRight, Trash2, CheckCircle2, Clock } from "lucide-react";
import type { Author } from "../page";

interface Props {
  author: Author;
  onSelect: () => void;
  onDelete: () => void;
}

export function AuthorCard({ author, onSelect, onDelete }: Props) {
  const style = author.AuthorStyleProfile?.[0];
  const isAnalysed = !!author.analysedAt;

  return (
    <div className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-bold text-lg shrink-0">
          {author.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{author.name}</p>
          {style?.tone && <p className="text-xs text-brand-600 capitalize">{style.tone}</p>}
        </div>
      </div>

      {author.bio && <p className="mb-3 text-xs text-gray-500 line-clamp-2">{author.bio}</p>}

      <div className="mb-3 flex items-center gap-3 text-xs text-gray-400">
        <span>{author.postCount} samples</span>
        <span>·</span>
        <span>{(author.wordCount ?? 0).toLocaleString()} words</span>
      </div>

      {style?.summary && (
        <p className="mb-3 text-xs text-gray-600 line-clamp-2 italic">"{style.summary}"</p>
      )}

      <div className="mb-4 flex items-center gap-1.5">
        {isAnalysed ? (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Style analysed
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" /> Not yet analysed
          </span>
        )}
        {style?.tokenCount ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {style.tokenCount.toLocaleString()} tokens
          </span>
        ) : null}
      </div>

      <button
        onClick={onSelect}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        <Mic2 className="h-4 w-4" /> Open Voice
        <ChevronRight className="h-4 w-4 ml-auto" />
      </button>
    </div>
  );
}
