"use client";

import { Users, RefreshCw } from "lucide-react";
import type { MCAudience } from "./types";
import { pct, fmtNum, fmtDate } from "./types";

interface Props {
  audiences: MCAudience[];
  onSync: () => Promise<void>;
  syncing: boolean;
}

export default function AudiencesTab({ audiences, onSync, syncing }: Props) {
  if (audiences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-24 text-center">
        <Users className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">No audiences synced yet</p>
        <p className="text-gray-300 text-xs mt-1 mb-4">Connect Mailchimp and sync to see your lists here.</p>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{audiences.length} audience{audiences.length !== 1 ? "s" : ""}</p>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {audiences.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{a.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{a.id}</p>
              </div>
              <div className="shrink-0 rounded-full bg-brand-50 p-2">
                <Users className="h-4 w-4 text-brand-600" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 py-2">
                <p className="text-lg font-bold text-gray-900">{fmtNum(a.memberCount)}</p>
                <p className="text-xs text-gray-400">Subscribers</p>
              </div>
              <div className="rounded-lg bg-gray-50 py-2">
                <p className="text-lg font-bold text-green-600">{pct(a.openRate)}</p>
                <p className="text-xs text-gray-400">Open rate</p>
              </div>
              <div className="rounded-lg bg-gray-50 py-2">
                <p className="text-lg font-bold text-blue-600">{pct(a.clickRate)}</p>
                <p className="text-xs text-gray-400">Click rate</p>
              </div>
            </div>

            <p className="text-xs text-gray-300">Synced {fmtDate(a.syncedAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
