"use client";

import React from "react";
import { AlertTriangle, XCircle, Info, AlertCircle } from "lucide-react";
import type { ValidationResult } from "./useBuilderValidation";

interface ValidationWarningsProps {
  validation: ValidationResult;
  onProceedAnyway?: () => void;
  showProceedButton?: boolean;
}

export function ValidationWarnings({ 
  validation, 
  onProceedAnyway,
  showProceedButton = false 
}: ValidationWarningsProps) {
  if (validation.issues.length === 0) return null;

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <div className="space-y-3">
      {/* Errors (blocking) */}
      {validation.errors.length > 0 && (
        <div className="rounded-lg border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
                Cannot Generate Application ({validation.errors.length} critical {validation.errors.length === 1 ? "issue" : "issues"})
              </h3>
              <ul className="space-y-1.5">
                {validation.errors.map((issue, i) => (
                  <li key={i} className="text-sm text-red-800 dark:text-red-300 flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-500 shrink-0">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-700 dark:text-red-400 mt-3 font-medium">
                Fix these issues before generating the application.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings (allow with confirmation) */}
      {validation.warnings.length > 0 && (
        <div className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                {validation.warnings.length} {validation.warnings.length === 1 ? "Warning" : "Warnings"}
              </h3>
              <ul className="space-y-1.5">
                {validation.warnings.map((issue, i) => (
                  <li key={i} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-500 shrink-0">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
              {showProceedButton && onProceedAnyway && !hasErrors && (
                <button
                  onClick={onProceedAnyway}
                  className="mt-3 rounded-md bg-amber-600 dark:bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors"
                >
                  Proceed Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info (non-blocking suggestions) */}
      {validation.infos.length > 0 && !hasErrors && !hasWarnings && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Suggestions for Better Results
              </h3>
              <ul className="space-y-1.5">
                {validation.infos.map((issue, i) => (
                  <li key={i} className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-500 shrink-0">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Summary badge */}
      {(hasErrors || hasWarnings) && (
        <div className="flex items-center gap-2 text-xs">
          {hasErrors && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1 text-red-700 dark:text-red-400 font-medium">
              <XCircle className="h-3 w-3" />
              {validation.errors.length} {validation.errors.length === 1 ? "Error" : "Errors"}
            </span>
          )}
          {hasWarnings && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-amber-700 dark:text-amber-400 font-medium">
              <AlertCircle className="h-3 w-3" />
              {validation.warnings.length} {validation.warnings.length === 1 ? "Warning" : "Warnings"}
            </span>
          )}
          {validation.infos.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-blue-700 dark:text-blue-400 font-medium">
              <Info className="h-3 w-3" />
              {validation.infos.length} {validation.infos.length === 1 ? "Suggestion" : "Suggestions"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
