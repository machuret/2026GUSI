"use client";

import { useState } from "react";
import { DECISION_STYLES, EFFORT_STYLES, type Decision, type Effort } from "./grantTypes";

export function FitStars({ value, onChange }: { value?: number | null; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={`text-base transition-colors ${n <= (hover || value || 0) ? "text-amber-400" : "text-gray-200"} ${onChange ? "cursor-pointer" : "cursor-default"}`}
        >★</button>
      ))}
    </div>
  );
}

export function FitBadge({ aiScore, aiVerdict, fitScore }: { aiScore?: number | null; aiVerdict?: string | null; fitScore?: number | null }) {
  // If we have a rich AI score, show that
  if (aiScore != null) {
    const cls = aiScore >= 70 ? "bg-green-100 text-green-700 border-green-200"
      : aiScore >= 50 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : aiScore >= 30 ? "bg-orange-100 text-orange-700 border-orange-200"
      : "bg-red-100 text-red-600 border-red-200";
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}
          title={aiVerdict ? `${aiVerdict} — ${aiScore}%` : `${aiScore}%`}>
          {aiScore}%
        </span>
        {aiVerdict && (
          <span className="text-[10px] font-medium text-gray-400 leading-tight truncate max-w-[80px]" title={aiVerdict}>
            {aiVerdict}
          </span>
        )}
      </div>
    );
  }
  // Fall back to star rating
  if (fitScore != null) return <FitStars value={fitScore} />;
  return <span className="text-xs text-gray-300">—</span>;
}

export function DecisionBadge({ value }: { value?: Decision | "Rejected" | null }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>;
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DECISION_STYLES[value]}`}>{value}</span>;
}

export function EffortBadge({ value }: { value?: Effort | null }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EFFORT_STYLES[value]}`}>{value}</span>;
}

export function DeadlineBadge({ date }: { date?: string | null }) {
  if (!date) return <span className="text-xs text-gray-300">—</span>;
  const d = new Date(date);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const fmt = d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  const cls = daysLeft < 0
    ? "text-gray-400 line-through"
    : daysLeft <= 14 ? "text-red-600 font-semibold"
    : daysLeft <= 30 ? "text-orange-600 font-medium"
    : "text-gray-700";
  return (
    <span className={`text-xs ${cls}`}>
      {fmt}
      {daysLeft >= 0 && daysLeft <= 60 && <span className="ml-1 text-gray-400">({daysLeft}d)</span>}
    </span>
  );
}
