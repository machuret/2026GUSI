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
