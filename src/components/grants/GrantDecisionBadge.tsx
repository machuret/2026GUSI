"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface GrantDecisionBadgeProps {
  aiRecommendation?: "Apply" | "Maybe" | "No" | null;
  decision?: "Apply" | "Maybe" | "No" | "Rejected" | null;
  decisionReason?: string | null;
  aiScore?: number | null;
  showOverrideWarning?: boolean;
}

export function GrantDecisionBadge({
  aiRecommendation,
  decision,
  decisionReason,
  aiScore,
  showOverrideWarning = true,
}: GrantDecisionBadgeProps) {
  const isOverride = aiRecommendation && decision && aiRecommendation !== decision;

  const getBadgeColor = (value: string) => {
    switch (value) {
      case "Apply":
        return "bg-emerald-100 text-emerald-700 border-emerald-300";
      case "Maybe":
        return "bg-amber-100 text-amber-700 border-amber-300";
      case "No":
      case "Rejected":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <div className="space-y-2">
      {/* AI Recommendation */}
      {aiRecommendation && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">AI Recommends:</span>
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeColor(aiRecommendation)}`}>
            {aiRecommendation}
            {aiScore !== null && aiScore !== undefined && (
              <span className="opacity-70">({aiScore}%)</span>
            )}
          </span>
        </div>
      )}

      {/* User Decision */}
      {decision && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Your Decision:</span>
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeColor(decision)}`}>
            {decision}
          </span>
        </div>
      )}

      {/* Override Warning */}
      {isOverride && showOverrideWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-900">
              You overrode AI recommendation
            </p>
            {decisionReason && (
              <p className="text-xs text-amber-700 mt-0.5">
                Reason: {decisionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* No AI Recommendation Yet */}
      {!aiRecommendation && !decision && (
        <div className="text-xs text-gray-400 italic">
          Run AI analysis to get recommendation
        </div>
      )}
    </div>
  );
}
