"use client";

import { AlertCircle, RefreshCw, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, onDismiss, className = "" }: ErrorBannerProps) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <span className="flex-1">{message}</span>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="rounded p-0.5 text-red-400 hover:bg-red-100">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
