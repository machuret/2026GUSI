"use client";

import Link from "next/link";
import { Upload, Sparkles, Building2, TrendingUp } from "lucide-react";
import type { DashboardStats } from "./types";

interface Props {
  stats: DashboardStats | null;
}

export function SetupChecklist({ stats }: Props) {
  const steps = [
    {
      done: stats?.hasCompanyInfo,
      label: "Add company info",
      desc: "Tell the AI about your brand, values, and philosophy",
      href: "/company",
      icon: Building2,
    },
    {
      done: (stats?.ingestedPosts ?? 0) > 0,
      label: "Ingest your content",
      desc: "Upload past posts so the AI learns your voice",
      href: "/ingest",
      icon: Upload,
    },
    {
      done: stats?.hasStyleProfile,
      label: "Build style profile",
      desc: "Run the style analyser to extract your writing fingerprint",
      href: "/ingest",
      icon: TrendingUp,
    },
    {
      done: (stats?.totalGenerated ?? 0) > 0,
      label: "Generate your first piece",
      desc: "Create content in your company's voice",
      href: "/generate",
      icon: Sparkles,
    },
  ];

  const done = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Setup Checklist</h2>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          {done}/{steps.length}
        </span>
      </div>
      <div className="space-y-3">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
              step.done ? "bg-green-50" : "bg-gray-50 hover:bg-brand-50"
            }`}
          >
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              step.done ? "bg-green-500" : "border-2 border-gray-300"
            }`}>
              {step.done && <span className="text-xs text-white">✓</span>}
            </div>
            <div>
              <p className={`text-sm font-medium ${step.done ? "text-green-700 line-through" : "text-gray-700"}`}>
                {step.label}
              </p>
              {!step.done && <p className="text-xs text-gray-400">{step.desc}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
