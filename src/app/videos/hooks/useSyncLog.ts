"use client";

import { useState, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { SyncLogEntry } from "../types";

export function useSyncLog() {
  const [lastVideoSync, setLastVideoSync] = useState<SyncLogEntry | null>(null);
  const [lastTranscriptSync, setLastTranscriptSync] = useState<SyncLogEntry | null>(null);

  const fetchSyncLog = useCallback(async () => {
    try {
      const res = await authFetch("/api/videos/sync-log");
      const data = await res.json();
      setLastVideoSync(data.lastVideoSync ?? null);
      setLastTranscriptSync(data.lastTranscriptSync ?? null);
    } catch { /* ignore */ }
  }, []);

  return { lastVideoSync, lastTranscriptSync, fetchSyncLog };
}
