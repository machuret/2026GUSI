"use client";

import { X, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { VERDICT_STYLES, type GrantAnalysis } from "./grantTypes";

export function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#16a34a" : score >= 50 ? "#ca8a04" : score >= 30 ? "#ea580c" : "#dc2626";
  const r = 20, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <svg className="absolute" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 32 32)" />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}%</span>
    </div>
  );
}

export function AnalysisPanel({ analysis, onClose }: { analysis: GrantAnalysis; onClose: () => void }) {
  const verdictCls = VERDICT_STYLES[analysis.verdict] ?? "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <ScoreRing score={analysis.score} />
          <div>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${verdictCls}`}>{analysis.verdict}</span>
            <p className="mt-1.5 text-sm text-gray-700 max-w-lg">{analysis.summary}</p>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Strengths</p>
            <ul className="space-y-1">{analysis.strengths.map((s, i) => <li key={i} className="text-xs text-gray-700">• {s}</li>)}</ul>
          </div>
        )}
        {analysis.gaps.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Gaps</p>
            <ul className="space-y-1">{analysis.gaps.map((g, i) => <li key={i} className="text-xs text-gray-700">• {g}</li>)}</ul>
          </div>
        )}
      </div>
      {analysis.recommendation && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-white px-3 py-2">
          <p className="text-xs font-semibold text-brand-700 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Recommendation</p>
          <p className="mt-0.5 text-xs text-gray-700">{analysis.recommendation}</p>
        </div>
      )}
    </div>
  );
}
