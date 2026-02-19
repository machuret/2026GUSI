"use client";

import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import { QUICK_ISSUES } from "./OutputReview";

interface Props {
  variant: "regen" | "reject";
  loading?: boolean;
  onSubmit: (feedback: string, tags: string[]) => void;
  onCancel: () => void;
}

export function FeedbackForm({ variant, loading, onSubmit, onCancel }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");

  const isRegen = variant === "regen";
  const hasFeedback = tags.length > 0 || text.trim().length > 0;

  const toggleTag = (id: string) =>
    setTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);

  const handleSubmit = () => {
    const tagDetails = tags.map((id) => QUICK_ISSUES.find((q) => q.id === id)?.detail ?? id);
    const combined = [...tagDetails, text.trim()].filter(Boolean).join(". ");
    if (!combined) return;
    onSubmit(combined, tags);
  };

  return (
    <div className={`mt-4 rounded-xl border p-4 ${isRegen ? "border-brand-200 bg-brand-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className={`h-4 w-4 ${isRegen ? "text-brand-600" : "text-amber-600"}`} />
          <p className={`text-sm font-semibold ${isRegen ? "text-brand-800" : "text-amber-800"}`}>
            {isRegen
              ? "What's wrong? Tell the AI — this becomes a lesson."
              : "What's wrong? This becomes a lesson for the AI."}
          </p>
        </div>
        <button onClick={onCancel}>
          <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
        </button>
      </div>

      {/* Quick-pick tags */}
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_ISSUES.map((issue) => (
          <button key={issue.id} onClick={() => toggleTag(issue.id)} title={issue.detail}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              tags.includes(issue.id)
                ? isRegen
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-amber-500 bg-amber-500 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-brand-400 hover:text-brand-700"
            }`}>
            {issue.label}
          </button>
        ))}
      </div>

      {/* Free text */}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus={!isRegen}
        placeholder={isRegen
          ? "Add any specific detail… e.g. 'The opening paragraph is too long, cut it to one sentence'"
          : "Add specific detail… e.g. 'Opening paragraph is too long, cut to one sentence'"}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
          isRegen ? "border-brand-200 bg-white" : "border-amber-300 bg-white"
        }`}
      />

      <div className="mt-3 flex items-center gap-2">
        <button onClick={handleSubmit} disabled={!hasFeedback || loading}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
            isRegen ? "bg-brand-600 hover:bg-brand-700" : "bg-red-600 hover:bg-red-700"
          }`}>
          {loading ? (isRegen ? "Regenerating…" : "Submitting...") : (isRegen ? "Save Lesson + Regenerate" : "Submit Feedback + Create Lesson")}
        </button>
        {isRegen && tags.length > 0 && (
          <p className="text-xs font-medium text-gray-600">
            {tags.length} issue{tags.length > 1 ? "s" : ""} selected
          </p>
        )}
        {!isRegen && (
          <button onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
