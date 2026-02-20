"use client";

import { Mail, RefreshCw, TrendingUp } from "lucide-react";
import type { MCCampaign, MCAudience } from "./types";
import { pct, fmtNum, fmtDate, STATUS_COLORS } from "./types";

interface Props {
  campaigns: MCCampaign[];
  audiences: MCAudience[];
  onSync: () => Promise<void>;
  syncing: boolean;
}

export default function CampaignsTab({ campaigns, audiences, onSync, syncing }: Props) {
  const audienceMap = Object.fromEntries(audiences.map((a) => [a.id, a.name]));

  const sent = campaigns.filter((c) => c.status === "sent");
  const avgOpen  = sent.length ? sent.reduce((s, c) => s + c.openRate,  0) / sent.length : 0;
  const avgClick = sent.length ? sent.reduce((s, c) => s + c.clickRate, 0) / sent.length : 0;
  const totalSent = sent.reduce((s, c) => s + c.emailsSent, 0);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-24 text-center">
        <Mail className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">No campaigns synced yet</p>
        <p className="text-gray-300 text-xs mt-1 mb-4">Sync your Mailchimp account to see campaign analytics.</p>
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      {sent.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Campaigns sent",  value: fmtNum(sent.length),   color: "text-gray-900" },
            { label: "Total emails sent", value: fmtNum(totalSent),   color: "text-gray-900" },
            { label: "Avg open rate",   value: pct(avgOpen),          color: "text-green-600" },
            { label: "Avg click rate",  value: pct(avgClick),         color: "text-blue-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Campaign", "Audience", "Status", "Sent", "Emails", "Open", "Click", "Unsub"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                  {c.subjectLine && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.subjectLine}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  {c.audienceId ? (audienceMap[c.audienceId] ?? c.audienceId) : "—"}
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(c.sendTime)}</td>
                <td className="px-3 py-3 text-xs text-gray-700 font-medium">{c.emailsSent > 0 ? fmtNum(c.emailsSent) : "—"}</td>
                <td className="px-3 py-3">
                  {c.status === "sent" ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-gray-200">
                        <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${Math.min(c.openRate * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-green-700">{pct(c.openRate)}</span>
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-3 py-3">
                  {c.status === "sent" ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-gray-200">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(c.clickRate * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-blue-700">{pct(c.clickRate)}</span>
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  {c.status === "sent" ? pct(c.unsubscribeRate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
