"use client";

import { AlignLeft } from "lucide-react";
import type { PostEntry } from "./ManualPanel";

const CONTENT_TYPES = [
  { value: "blog", label: "Blog Post" },
  { value: "newsletter", label: "Newsletter" },
  { value: "announcement", label: "Announcement" },
  { value: "linkedin", label: "LinkedIn Post" },
  { value: "facebook", label: "Facebook Post" },
  { value: "instagram", label: "Instagram Post" },
  { value: "twitter", label: "Twitter / X Post" },
  { value: "email", label: "Email Campaign" },
  { value: "press-release", label: "Press Release" },
  { value: "case-study", label: "Case Study" },
];

const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface Props {
  bulkText: string;
  bulkType: string;
  bulkPlatform: string;
  bulkParsed: PostEntry[];
  onBulkTextChange: (v: string) => void;
  onBulkTypeChange: (v: string) => void;
  onBulkPlatformChange: (v: string) => void;
  onParse: () => void;
}

export function BulkPanel({
  bulkText, bulkType, bulkPlatform, bulkParsed,
  onBulkTextChange, onBulkTypeChange, onBulkPlatformChange, onParse,
}: Props) {
  const estimatedCount = bulkText.split(/\n---+\n|\n\n\n+/).filter((s) => s.trim()).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="mb-3 text-sm text-gray-600">
        Paste multiple posts separated by <code className="rounded bg-gray-100 px-1">---</code> or three blank lines, then click Parse.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Content Type (all)</label>
          <select value={bulkType} onChange={(e) => onBulkTypeChange(e.target.value)} className={IC}>
            {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Platform (all)</label>
          <input value={bulkPlatform} onChange={(e) => onBulkPlatformChange(e.target.value)}
            placeholder="website, linkedin..." className={IC} />
        </div>
      </div>
      <textarea value={bulkText} onChange={(e) => onBulkTextChange(e.target.value)}
        placeholder={"Post one...\n\n---\n\nPost two...\n\n---\n\nPost three..."}
        rows={12} className={IC} />
      <div className="mt-3 flex items-center gap-3">
        <button onClick={onParse} disabled={!bulkText.trim()}
          className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
          <AlignLeft className="h-4 w-4" />
          Parse {bulkText.trim() ? `(~${estimatedCount} posts)` : ""}
        </button>
        {bulkParsed.length > 0 && (
          <span className="text-sm text-green-700 font-medium">✓ {bulkParsed.length} posts ready</span>
        )}
      </div>
      {bulkParsed.length > 0 && (
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {bulkParsed.map((p, i) => (
            <div key={i} className="flex items-start justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <span className="text-gray-700 flex-1 line-clamp-2">{p.body.slice(0, 120)}...</span>
              <span className="ml-3 shrink-0 text-gray-400">{p.body.trim().split(/\s+/).length}w</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
