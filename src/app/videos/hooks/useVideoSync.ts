"use client";

import { useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { SyncProgress } from "../types";

export function useVideoSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleSync = async (onComplete?: () => Promise<void>) => {
    setSyncing(true); setSyncMsg(null);
    let page = 1;
    let totalSynced = 0;
    let totalUpdated = 0;
    let totalVimeo = 0;
    const startTime = Date.now();

    try {
      while (true) {
        const res = await authFetch(`/api/videos/sync?page=${page}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sync failed");

        totalSynced += data.synced;
        totalUpdated += data.updated;
        totalVimeo = data.total;
        setSyncProgress({ page: data.page, totalPages: data.totalPages, synced: totalSynced, updated: totalUpdated, total: data.total });

        if (!data.hasMore) break;
        page++;
      }

      const durationMs = Date.now() - startTime;
      await authFetch("/api/videos/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "videos", status: "completed", synced: totalSynced, updated: totalUpdated, errors: 0, totalProcessed: totalVimeo, durationMs }),
      }).catch(() => {});

      setSyncMsg(`Done! ${totalSynced} new, ${totalUpdated} updated (${totalVimeo} total) in ${(durationMs / 1000).toFixed(1)}s`);
      setSyncProgress(null);
      setTimeout(() => setSyncMsg(null), 10000);
      if (onComplete) await onComplete();
    } catch (err) {
      setSyncProgress(null);
      throw err;
    } finally { setSyncing(false); }
  };

  return { syncing, syncProgress, syncMsg, setSyncMsg, handleSync };
}
