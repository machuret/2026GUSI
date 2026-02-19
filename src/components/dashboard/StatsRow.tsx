"use client";

import { Clock, CheckCircle2, XCircle, BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import type { DashboardStats } from "./types";

interface Props {
  stats: DashboardStats | null;
  loading: boolean;
}

const STAT_CARDS = [
  { key: "totalGenerated",  label: "Total Generated", icon: FileText,     color: "text-gray-700",    bg: "bg-gray-50",   href: undefined,   urgentKey: undefined },
  { key: "pendingReview",   label: "Pending Review",  icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50",  href: "/history",  urgentKey: "pendingReview" },
  { key: "approved",        label: "Approved",        icon: CheckCircle2, color: "text-green-600",   bg: "bg-green-50",  href: undefined,   urgentKey: undefined },
  { key: "rejected",        label: "Rejected",        icon: XCircle,      color: "text-red-500",     bg: "bg-red-50",    href: undefined,   urgentKey: undefined },
  { key: "lessons",         label: "AI Lessons",      icon: BookOpen,     color: "text-brand-600",   bg: "bg-brand-50",  href: "/lessons",  urgentKey: undefined },
] as const;

export function StatsRow({ stats, loading }: Props) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
      {STAT_CARDS.map((s) => {
        const value = stats ? stats[s.key] : null;
        const isUrgent = s.urgentKey && (stats?.[s.urgentKey] ?? 0) > 0;

        const card = (
          <div className={`rounded-xl border p-4 ${isUrgent ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
            <div className={`mb-2 inline-flex rounded-lg p-2 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`mt-0.5 text-2xl font-bold ${isUrgent ? "text-amber-600" : "text-gray-900"}`}>
              {loading || value === null ? "—" : value}
            </p>
            {isUrgent && (
              <p className="mt-1 text-xs font-medium text-amber-600">Needs attention →</p>
            )}
          </div>
        );

        return s.href ? (
          <Link key={s.key} href={s.href} className="transition-transform hover:scale-[1.02]">
            {card}
          </Link>
        ) : (
          <div key={s.key}>{card}</div>
        );
      })}
    </div>
  );
}
