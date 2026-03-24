"use client";

import { Bell, X, Loader2, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { Grant } from "@/hooks/GrantsContext";
import { COLUMNS, getDaysLeft, formatCurrency, type ColumnDef } from "./crmConstants";

interface StatsProps {
  crmGrants: Grant[];
}

interface ProgressProps {
  done: number;
  total: number;
  errors: number;
  onCancel: () => void;
}

export function CrmStats({ crmGrants }: StatsProps) {
  const totalInCrm = crmGrants.length;
  const researchingCount = crmGrants.filter((g) => g.crmStatus === "Researching" || g.crmStatus === "Pipeline").length;
  const activeCount = crmGrants.filter((g) => g.crmStatus === "Active" || g.crmStatus === "Submitted").length;
  const submittedCount = crmGrants.filter((g) => g.crmStatus === "Submitted").length;
  const pipelineValue = crmGrants
    .filter((g) => g.crmStatus !== "Won" && g.crmStatus !== "Lost")
    .reduce((sum, g) => {
      if (!g.amount) return sum;
      const cleaned = g.amount.replace(/,/g, "");
      const m = cleaned.match(/([\d]+(?:\.\d+)?)/);
      if (!m) return sum;
      const n = parseFloat(m[0]);
      return sum + (/k\b/i.test(g.amount) ? n * 1000 : n);
    }, 0);

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-xs text-gray-400">Total in CRM</p>
        <p className="text-2xl font-bold text-gray-900">{totalInCrm}</p>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs text-blue-600">Researching / Pipeline</p>
        <p className="text-2xl font-bold text-blue-800">{researchingCount}</p>
      </div>
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-xs text-brand-600">Active / Submitted</p>
        <p className="text-2xl font-bold text-brand-800">{activeCount}</p>
      </div>
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
        <p className="text-xs text-purple-600">Pipeline Value</p>
        <p className="text-2xl font-bold text-purple-800">{pipelineValue > 0 ? formatCurrency(pipelineValue) : "—"}</p>
      </div>
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <p className="text-xs text-orange-600">Submitted</p>
        <p className="text-2xl font-bold text-orange-800">{submittedCount}</p>
      </div>
    </div>
  );
}

export function DeadlineAlertStrip({ crmGrants }: StatsProps) {
  const urgentGrants = crmGrants
    .filter((g) => {
      const d = getDaysLeft(g.deadlineDate);
      return d !== null && d <= 7 && g.crmStatus !== "Won" && g.crmStatus !== "Lost";
    })
    .sort((a, b) => (getDaysLeft(a.deadlineDate) ?? 99) - (getDaysLeft(b.deadlineDate) ?? 99));

  if (urgentGrants.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-4 w-4 text-orange-500" />
        <p className="text-sm font-semibold text-orange-700">
          {urgentGrants.length} grant{urgentGrants.length !== 1 ? "s" : ""} due within 7 days
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {urgentGrants.map((g) => {
          const d = getDaysLeft(g.deadlineDate)!;
          const col = COLUMNS.find((c: ColumnDef) => c.status === g.crmStatus);
          return (
            <div
              key={g.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${d <= 0 ? "border-red-200 bg-red-50" : "border-orange-200 bg-white"}`}
            >
              <span className={`font-semibold ${d <= 0 ? "text-red-600" : "text-orange-700"}`}>
                {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d left`}
              </span>
              <span className="text-gray-700 font-medium">
                {g.name.length > 40 ? g.name.slice(0, 40) + "…" : g.name}
              </span>
              {col && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${col.bg} ${col.color}`}>
                  {g.crmStatus}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MassResearchProgress({ done, total, errors, onCancel }: ProgressProps) {
  return (
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-blue-700">
        <span>
          Researching CRM grants — {done} / {total} done
          {errors > 0 ? ` · ${errors} failed` : ""}
        </span>
        <div className="flex items-center gap-2">
          <span>{Math.round((done / total) * 100)}%</span>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-200"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-blue-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CrmEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
      <FlaskConical className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">No grants in CRM yet</p>
      <p className="text-sm text-gray-400 mt-1">
        Go to <Link href="/grants" className="text-brand-600 hover:underline">All Grants</Link> and click <strong>Send to CRM</strong> on any grant.
      </p>
    </div>
  );
}
