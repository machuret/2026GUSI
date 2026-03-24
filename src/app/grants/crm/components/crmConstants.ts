export type CrmStatus = "Researching" | "Pipeline" | "Active" | "Built" | "Improved" | "Submitted" | "Won" | "Lost";
export type ViewMode = "kanban" | "list";

export interface ColumnDef {
  status: CrmStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const COLUMNS: ColumnDef[] = [
  { status: "Researching", label: "🔍 Researching",  color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  { status: "Pipeline",    label: "📋 Pipeline",     color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200" },
  { status: "Active",      label: "✍️ Active",       color: "text-brand-700",   bg: "bg-brand-50",   border: "border-brand-200" },
  { status: "Built",       label: "🏗️ Built",        color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  { status: "Improved",    label: "✨ Improved",     color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200" },
  { status: "Submitted",   label: "📤 Submitted",    color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200" },
  { status: "Lost",        label: "❌ Lost",         color: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200" },
];

export const STATUS_OPTIONS: CrmStatus[] = [
  "Researching", "Pipeline", "Active", "Built", "Improved", "Submitted", "Won", "Lost",
];

export function parseAmount(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "");
  const m = cleaned.match(/([\d]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (/k\b/i.test(raw)) return n * 1000;
  return n;
}

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function getDaysLeft(deadlineDate?: string | null): number | null {
  if (!deadlineDate) return null;
  return Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / 86_400_000);
}

export function sortByUrgency<T extends { deadlineDate?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = getDaysLeft(a.deadlineDate);
    const db = getDaysLeft(b.deadlineDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}
