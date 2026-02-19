"use client";

import { useState } from "react";
import { Clock, Copy, Check } from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  linkedin:  "bg-blue-100 text-blue-800 border-blue-200",
  instagram: "bg-pink-100 text-pink-800 border-pink-200",
  facebook:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  twitter:   "bg-sky-100 text-sky-800 border-sky-200",
  newsletter:"bg-amber-100 text-amber-800 border-amber-200",
  blog_post: "bg-emerald-100 text-emerald-800 border-emerald-200",
  default:   "bg-gray-100 text-gray-700 border-gray-200",
};

export const CATEGORY_COLORS: Record<string, string> = {
  social_media:   "bg-pink-50 border-l-4 border-l-pink-400",
  newsletter:     "bg-amber-50 border-l-4 border-l-amber-400",
  blog_post:      "bg-emerald-50 border-l-4 border-l-emerald-400",
  offer:          "bg-orange-50 border-l-4 border-l-orange-400",
  webinar:        "bg-violet-50 border-l-4 border-l-violet-400",
  announcement:   "bg-red-50 border-l-4 border-l-red-400",
  course_content: "bg-teal-50 border-l-4 border-l-teal-400",
  sales_page:     "bg-yellow-50 border-l-4 border-l-yellow-400",
  cold_email:     "bg-blue-50 border-l-4 border-l-blue-400",
};

export interface CalendarItem {
  id: string;
  prompt: string;
  output: string;
  status: string;
  category: string;
  categoryLabel: string;
  scheduledAt?: string | null;
  createdAt: string;
  platform?: string;
}

export function CalendarCard({ item }: { item: CalendarItem }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(item.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const colorCls = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.cold_email;
  const platformColor = item.platform
    ? PLATFORM_COLORS[item.platform] ?? PLATFORM_COLORS.default
    : PLATFORM_COLORS.default;

  const time = item.scheduledAt
    ? new Date(item.scheduledAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={`rounded-lg border p-2 text-xs cursor-pointer ${colorCls}`} onClick={() => setExpanded((v) => !v)}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          {time && (
            <div className="flex items-center gap-0.5 text-gray-500 mb-0.5">
              <Clock className="h-2.5 w-2.5" /> {time}
            </div>
          )}
          <p className="font-medium text-gray-800 truncate">{item.categoryLabel}</p>
          <p className="text-gray-500 truncate">{item.prompt.slice(0, 50)}</p>
        </div>
        {item.platform && (
          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${platformColor}`}>
            {item.platform}
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-2 border-t border-gray-200 pt-2" onClick={(e) => e.stopPropagation()}>
          <p className="whitespace-pre-wrap text-gray-700 leading-relaxed max-h-40 overflow-y-auto">
            {item.output}
          </p>
          <button onClick={copy} className="mt-1.5 flex items-center gap-1 text-gray-400 hover:text-brand-600">
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
