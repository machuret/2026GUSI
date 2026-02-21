"use client";

import Link from "next/link";
import { Upload, Sparkles, Clock, BookOpen, ArrowRight } from "lucide-react";
import type { DashboardStats } from "./types";

interface Props {
  stats: DashboardStats | null;
}

export function QuickActions({ stats }: Props) {
  const actions = [
    {
      title: "Create Content",
      desc: "Generate, review and approve in one flow",
      href: "/generate",
      icon: Sparkles,
      color: "bg-brand-600",
      primary: true,
    },
    {
      title: "Review Pending",
      desc: `${stats?.pendingReview ?? 0} piece${(stats?.pendingReview ?? 0) !== 1 ? "s" : ""} waiting for approval`,
      href: "/history",
      icon: Clock,
      color: "bg-amber-500",
      primary: (stats?.pendingReview ?? 0) > 0,
    },
    {
      title: "Load Content",
      desc: "Upload posts and documents to train the AI",
      href: "/ingest",
      icon: Upload,
      color: "bg-blue-500",
      primary: false,
    },
    {
      title: "View Lessons",
      desc: `${stats?.lessons ?? 0} lesson${(stats?.lessons ?? 0) !== 1 ? "s" : ""} improving future content`,
      href: "/lessons",
      icon: BookOpen,
      color: "bg-purple-500",
      primary: false,
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group flex items-center justify-between rounded-xl border p-5 transition-all hover:shadow-[0_4px_14px_rgba(0,0,0,0.1)] ${
              action.primary
                ? "border-brand-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)]"
                : "border-gray-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)]"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-xl p-3 ${action.color} shadow-sm`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{action.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{action.desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-brand-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
