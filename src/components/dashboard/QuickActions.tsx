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
      <h2 className="mb-4 font-semibold text-gray-800">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group flex items-center justify-between rounded-xl border p-5 transition-all hover:shadow-md ${
              action.primary
                ? "border-brand-200 bg-brand-50 hover:bg-brand-100"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-lg p-2.5 ${action.color}`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className={`font-semibold ${action.primary ? "text-brand-800" : "text-gray-800"}`}>
                  {action.title}
                </p>
                <p className="text-sm text-gray-500">{action.desc}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
