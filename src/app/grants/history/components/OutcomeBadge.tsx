import { OUTCOME_CONFIG } from "./types";

export function OutcomeBadge({ outcome }: { outcome?: string | null }) {
  if (!outcome) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">—</span>;
  const cfg = OUTCOME_CONFIG[outcome] ?? { label: outcome, bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
