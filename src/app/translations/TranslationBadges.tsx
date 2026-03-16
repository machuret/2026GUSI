"use client";

import type { TranslationStatus } from "./types";
import { LANG_COLORS, LANG_FLAGS, STATUS_STYLES } from "./types";

export function FlagBadge({ lang }: { lang: string }) {
  const flag = LANG_FLAGS[lang] ?? "";
  const colorKey = Object.keys(LANG_COLORS).find((k) => lang.startsWith(k));
  const colorCls = colorKey ? LANG_COLORS[colorKey] : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorCls}`}>
      {flag && <span className="text-sm leading-none">{flag}</span>}
      {lang}
    </span>
  );
}

export function StatusBadge({ status }: { status: TranslationStatus }) {
  const labels: Record<TranslationStatus, string> = { draft: "Draft", approved: "Approved", archived: "Archived" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {labels[status]}
    </span>
  );
}
