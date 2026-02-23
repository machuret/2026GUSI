"use client";

import {
  Loader2, Sparkles, Check, Archive, Trash2,
  ThumbsUp, ThumbsDown, CheckCircle2,
} from "lucide-react";
import type { Idea, ContentType, IdeaCategory } from "@/hooks/useIdeas";
import { CONTENT_TYPES, IDEA_CATEGORIES } from "../constants";

function ContentTypeBadge({ type }: { type: ContentType }) {
  const ct = CONTENT_TYPES.find((c) => c.key === type);
  if (!ct) return null;
  const Icon = ct.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ct.color}`}>
      <Icon className="h-3 w-3" />{ct.label}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: IdeaCategory }) {
  const c = IDEA_CATEGORIES.find((x) => x.key === cat);
  if (!c) return null;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${c.color}`}>
      <Icon className="h-3 w-3" />{c.label}
    </span>
  );
}

export { ContentTypeBadge, CategoryBadge };

interface IdeaRowProps {
  idea: Idea;
  busy: boolean;
  onApprove: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRate: (r: "up" | "down") => void;
}

export function IdeaRow({ idea, busy, onApprove, onArchive, onDelete, onRate }: IdeaRowProps) {
  const isApproved = idea.status === "approved";
  const isDone     = idea.status === "done";

  return (
    <div className={`flex items-start gap-4 rounded-xl border bg-white px-4 py-3.5 transition-all ${
      isDone ? "border-purple-200 bg-purple-50" :
      isApproved ? "border-green-200 bg-green-50" :
      idea.rating === "down" ? "border-red-100 bg-red-50/40" :
      "border-gray-200 hover:border-brand-200"
    }`}>
      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
        isDone ? "bg-purple-400" : isApproved ? "bg-green-400" : idea.status === "archived" ? "bg-gray-300" : "bg-brand-400"
      }`} />

      <div className="flex-1 min-w-0">
        <div className="mb-1 flex flex-wrap gap-1.5">
          <ContentTypeBadge type={idea.contentType as ContentType} />
          <CategoryBadge cat={idea.category as IdeaCategory} />
          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              <CheckCircle2 className="h-3 w-3" /> Done
            </span>
          )}
          {isApproved && !isDone && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <Check className="h-3 w-3" /> Approved
            </span>
          )}
          {idea.rating === "up" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
              <ThumbsUp className="h-3 w-3" /> Liked
            </span>
          )}
          {idea.rating === "down" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
              <ThumbsDown className="h-3 w-3" /> Rejected
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-snug">{idea.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{idea.summary}</p>
        {idea.ratingFeedback && (
          <p className="mt-1 text-xs text-red-500 italic">Feedback: {idea.ratingFeedback}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isDone && (
          <>
            <button onClick={() => onRate("up")} disabled={busy} title="Good idea"
              className={`rounded-lg border p-1.5 transition-colors disabled:opacity-50 ${
                idea.rating === "up" ? "border-emerald-300 bg-emerald-100 text-emerald-600" : "border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-600"
              }`}>
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onRate("down")} disabled={busy} title="Reject with feedback"
              className={`rounded-lg border p-1.5 transition-colors disabled:opacity-50 ${
                idea.rating === "down" ? "border-red-300 bg-red-100 text-red-600" : "border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500"
              }`}>
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {!isApproved && !isDone && (
          <button onClick={onApprove} disabled={busy} title="Approve — creates a content draft and opens the generator"
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Approve
          </button>
        )}

        {(isApproved || isDone) && idea.contentId && (
          <button onClick={onApprove} disabled={busy} title="Open in generator"
            className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Open Draft
          </button>
        )}

        {idea.status !== "archived" && (
          <button onClick={onArchive} disabled={busy} title="Archive"
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:border-gray-300 hover:text-gray-600 disabled:opacity-50">
            <Archive className="h-3.5 w-3.5" />
          </button>
        )}

        <button onClick={onDelete} disabled={busy} title="Delete permanently"
          className="rounded-lg border border-gray-200 p-1.5 text-gray-300 hover:border-red-200 hover:text-red-500 disabled:opacity-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
