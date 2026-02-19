"use client";

import { useState } from "react";
import {
  Globe, ExternalLink, ChevronDown, ChevronUp,
  Loader2, Plus, BadgeCheck,
} from "lucide-react";

export interface CrawledGrant {
  name: string;
  founder: string;
  url: string;
  deadlineDate?: string | null;
  geographicScope?: string;
  amount?: string;
  eligibility?: string;
  howToApply?: string;
  projectDuration?: string;
  submissionEffort?: "Low" | "Medium" | "High";
  confidence?: "High" | "Medium" | "Low";
}

const CONFIDENCE_STYLES: Record<string, string> = {
  High:   "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Low:    "bg-gray-100 text-gray-500 border-gray-300",
};

const EFFORT_STYLES: Record<string, string> = {
  Low:    "bg-blue-50 text-blue-700",
  Medium: "bg-orange-50 text-orange-700",
  High:   "bg-red-50 text-red-700",
};

interface Props {
  grant: CrawledGrant;
  idx: number;
  isAdded: boolean;
  adding: boolean;
  onAdd: (grant: CrawledGrant, idx: number) => void;
}

export function CrawlResultCard({ grant, idx, isAdded, adding, onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const confidenceCls = CONFIDENCE_STYLES[grant.confidence ?? "Low"] ?? CONFIDENCE_STYLES.Low;

  return (
    <div className={`rounded-xl border transition-colors ${isAdded ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900">{grant.name}</p>
            {grant.confidence && (
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceCls}`}>{grant.confidence}</span>
            )}
            {isAdded && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Added</span>
            )}
          </div>
          <p className="text-xs text-gray-500">{grant.founder}</p>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-500">
            {grant.geographicScope && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{grant.geographicScope}</span>}
            {grant.amount && <span className="font-semibold text-gray-800">{grant.amount}</span>}
            {grant.deadlineDate && (
              <span className="text-orange-600">
                Deadline: {new Date(grant.deadlineDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {grant.submissionEffort && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_STYLES[grant.submissionEffort] ?? ""}`}>
                {grant.submissionEffort} effort
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {grant.url && (
            <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700" title="Open URL">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={() => !isAdded && onAdd(grant, idx)}
            disabled={isAdded || adding}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isAdded ? "bg-green-100 text-green-700 cursor-default" : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            }`}
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAdded ? <BadgeCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {isAdded ? "Added" : "Add"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-gray-600">
          {grant.eligibility && (
            <div>
              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Eligibility</p>
              <p className="whitespace-pre-wrap">{grant.eligibility}</p>
            </div>
          )}
          {grant.howToApply && (
            <div>
              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">How to Apply</p>
              <p className="whitespace-pre-wrap">{grant.howToApply}</p>
            </div>
          )}
          {grant.projectDuration && (
            <div>
              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Project Duration</p>
              <p>{grant.projectDuration}</p>
            </div>
          )}
          {grant.url && (
            <div className="sm:col-span-2">
              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">URL</p>
              <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all">{grant.url}</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
