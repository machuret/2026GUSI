"use client";

import { useState } from "react";
import { authFetch } from "@/lib/authFetch";

export function useTranscriptSync() {
  const [syncingTranscripts, setSyncingTranscripts] = useState(false);
  const [transcriptMsg, setTranscriptMsg] = useState<string | null>(null);

  const handleTranscriptSync = async (onComplete?: () => Promise<void>) => {
    setSyncingTranscripts(true); setTranscriptMsg(null);
    let totalFetched = 0;
    let totalNoTrack = 0;
    let totalErrors = 0;
    const startTime = Date.now();

    try {
      while (true) {
        const res = await authFetch("/api/videos/transcripts?batch=10", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transcript sync failed");

        totalFetched += data.fetched;
        totalNoTrack += data.noTrack;
        totalErrors += data.errors;
        setTranscriptMsg(`Fetching transcripts… ${totalFetched} found, ${totalNoTrack} no track, ${data.remaining} remaining`);

        if (!data.hasMore) break;
      }

      const durationMs = Date.now() - startTime;
      await authFetch("/api/videos/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "transcripts", status: "completed", synced: totalFetched, updated: 0, errors: totalErrors, totalProcessed: totalFetched + totalNoTrack + totalErrors, durationMs }),
      }).catch((err) => console.error("Transcript sync log save:", err));

      setTranscriptMsg(`Done! ${totalFetched} transcripts fetched, ${totalNoTrack} had no captions (${(durationMs / 1000).toFixed(1)}s)`);
      setTimeout(() => setTranscriptMsg(null), 10000);
      if (onComplete) await onComplete();
    } catch (err) {
      throw err;
    } finally { setSyncingTranscripts(false); }
  };

  return { syncingTranscripts, transcriptMsg, setTranscriptMsg, handleTranscriptSync };
}
