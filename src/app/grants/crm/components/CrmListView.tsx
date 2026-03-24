"use client";

import Link from "next/link";
import { PenLine, ExternalLink, X } from "lucide-react";
import type { Grant } from "@/hooks/GrantsContext";
import { COLUMNS, STATUS_OPTIONS, getDaysLeft, sortByUrgency, type CrmStatus, type ColumnDef } from "./crmConstants";

interface Props {
  grants: Grant[];
  onUpdate: (id: string, d: Partial<Grant>) => Promise<unknown>;
}

export function CrmListView({ grants, onUpdate }: Props) {
  const sorted = sortByUrgency(grants);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Grant</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[110px]">Stage</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[90px]">Amount</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[110px]">Deadline</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[80px]">Match</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-[100px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((grant) => {
            const daysLeft = getDaysLeft(grant.deadlineDate);
            const colMeta = COLUMNS.find((c: ColumnDef) => c.status === grant.crmStatus);
            return (
              <tr key={grant.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-sm">{grant.name}</p>
                  {grant.founder && <p className="text-xs text-gray-400">{grant.founder}</p>}
                </td>
                <td className="px-3 py-3">
                  <select
                    value={grant.crmStatus ?? ""}
                    onChange={(e) => onUpdate(grant.id, { crmStatus: e.target.value as CrmStatus })}
                    className={`w-full rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none ${colMeta ? `${colMeta.bg} ${colMeta.color} ${colMeta.border}` : "border-gray-200"}`}
                  >
                    {STATUS_OPTIONS.map((s: CrmStatus) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                  {grant.amount || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {daysLeft !== null ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      daysLeft <= 0 ? "bg-red-100 text-red-600" :
                      daysLeft <= 7 ? "bg-orange-100 text-orange-600" :
                      daysLeft <= 14 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Today" : `${daysLeft}d`}
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-3 py-3">
                  {grant.matchScore != null ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      grant.matchScore >= 70 ? "bg-green-100 text-green-700" :
                      grant.matchScore >= 40 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-600"
                    }`}>{grant.matchScore}%</span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {grant.url && (
                      <a href={grant.url} target="_blank" rel="noopener noreferrer"
                        className="rounded-md border border-gray-200 p-1 text-gray-400 hover:text-brand-600">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Link href={`/grants/builder?grantId=${grant.id}`}
                      className="rounded-md border border-emerald-200 bg-emerald-50 p-1 text-emerald-600 hover:bg-emerald-100">
                      <PenLine className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => onUpdate(grant.id, { crmStatus: null })}
                      title="Remove from CRM"
                      className="rounded-md border border-red-100 p-1 text-red-300 hover:bg-red-50 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
        {sorted.length} grant{sorted.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
