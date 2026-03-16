"use client";

import { RefreshCw, Loader2, FolderOpen, MessageSquareText, X, Play } from "lucide-react";
import { SyncProgress, SyncLogEntry } from "../types";
import { timeAgo } from "../helpers";

interface Props {
  syncing: boolean;
  syncProgress: SyncProgress | null;
  syncMsg: string | null;
  setSyncMsg: (msg: string | null) => void;
  syncingTranscripts: boolean;
  transcriptMsg: string | null;
  setTranscriptMsg: (msg: string | null) => void;
  error: string | null;
  setError: (msg: string | null) => void;
  lastVideoSync: SyncLogEntry | null;
  lastTranscriptSync: SyncLogEntry | null;
  onSync: () => void;
  onTranscriptSync: () => void;
  onAddCategory: () => void;
}

export function SyncControls({
  syncing, syncProgress, syncMsg, setSyncMsg,
  syncingTranscripts, transcriptMsg, setTranscriptMsg,
  error, setError,
  lastVideoSync, lastTranscriptSync,
  onSync, onTranscriptSync, onAddCategory,
}: Props) {
  return (
    <>
      {/* Header row */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Play className="h-7 w-7 text-indigo-600" /> Videos
          </h1>
          <p className="mt-1 text-gray-500">Sync and organize your Vimeo video library by category</p>
          <div className="mt-1.5 flex gap-4 text-[10px] text-gray-400">
            {lastVideoSync && <span>Last sync: {timeAgo(lastVideoSync.createdAt)} ({lastVideoSync.totalProcessed ?? 0} videos, {((lastVideoSync.durationMs ?? 0) / 1000).toFixed(1)}s)</span>}
            {lastTranscriptSync && <span>Transcripts: {timeAgo(lastTranscriptSync.createdAt)} ({lastTranscriptSync.synced ?? 0} fetched)</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onAddCategory}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <FolderOpen className="h-4 w-4" /> Add Category
          </button>
          <button onClick={onTranscriptSync} disabled={syncingTranscripts || syncing}
            className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
            {syncingTranscripts ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            {syncingTranscripts ? "Fetching…" : "Fetch Transcripts"}
          </button>
          <button onClick={onSync} disabled={syncing || syncingTranscripts}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync from Vimeo"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {syncProgress && (
        <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-indigo-700">
              Syncing page {syncProgress.page} of {syncProgress.totalPages} ({syncProgress.total} videos)
            </span>
            <span className="text-xs text-indigo-500">{syncProgress.synced} new, {syncProgress.updated} updated</span>
          </div>
          <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.round((syncProgress.page / syncProgress.totalPages) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Messages */}
      {syncMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium flex items-center justify-between">
          {syncMsg}
          <button onClick={() => setSyncMsg(null)} className="text-green-400 hover:text-green-600"><X className="h-4 w-4" /></button>
        </div>
      )}
      {transcriptMsg && (
        <div className="mb-4 rounded-lg bg-purple-50 border border-purple-200 px-4 py-2 text-sm text-purple-700 font-medium flex items-center justify-between">
          {transcriptMsg}
          <button onClick={() => setTranscriptMsg(null)} className="text-purple-400 hover:text-purple-600"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 font-medium flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}
    </>
  );
}
