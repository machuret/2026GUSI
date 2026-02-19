"use client";

import { BarChart3, ChevronDown, ChevronUp, RefreshCw, Sparkles } from "lucide-react";

const CONTENT_TYPES = [
  { value: "blog", label: "Blog Post" },
  { value: "newsletter", label: "Newsletter" },
  { value: "announcement", label: "Announcement" },
  { value: "linkedin", label: "LinkedIn Post" },
  { value: "facebook", label: "Facebook Post" },
  { value: "instagram", label: "Instagram Post" },
  { value: "twitter", label: "Twitter / X Post" },
  { value: "email", label: "Email Campaign" },
  { value: "press-release", label: "Press Release" },
  { value: "case-study", label: "Case Study" },
];

interface StyleProfile {
  tone: string;
  avgWordCount: number;
  vocabulary: string[];
  commonPhrases: string[];
  summary?: string;
}

export interface TrainingStats {
  totalPosts: number;
  totalWords: number;
  avgWords: number;
  coverage: Record<string, number>;
  readiness: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styleProfile: any;
  recommendations: string[];
}

function ReadinessRing({ score }: { score: number }) {
  const r = 28, circ = 2 * Math.PI * r, fill = circ - (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

interface Props {
  stats: TrainingStats | null;
  statsLoading: boolean;
  analysing: boolean;
  showStyle: boolean;
  onToggleStyle: () => void;
  onRefresh: () => void;
  onAnalyse: () => void;
  ingestedCount: number | null;
}

export function TrainingDashboard({
  stats, statsLoading, analysing, showStyle,
  onToggleStyle, onRefresh, onAnalyse, ingestedCount,
}: Props) {
  const sp: StyleProfile | null = stats?.styleProfile ?? null;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-600" />
          <h2 className="font-semibold text-gray-800">Training Quality</h2>
        </div>
        <button onClick={onRefresh} className="text-gray-400 hover:text-gray-600">
          <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {statsLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : stats ? (
        <>
          <div className="flex items-start gap-6">
            <ReadinessRing score={stats.readiness} />
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: "Posts ingested", value: stats.totalPosts },
                  { label: "Total words", value: stats.totalWords.toLocaleString() },
                  { label: "Avg words/post", value: stats.avgWords },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-lg font-bold text-gray-900">{s.value}</p>
                  </div>
                ))}
              </div>
              {stats.recommendations.map((rec, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                  <span className="mt-0.5 shrink-0">→</span>{rec}
                </p>
              ))}
            </div>
            {sp && (
              <div className="shrink-0 w-52">
                <button onClick={onToggleStyle}
                  className="flex w-full items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100">
                  <span>✓ Style profile active</span>
                  {showStyle ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showStyle && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-xs space-y-2">
                    <div><span className="font-medium text-gray-600">Tone: </span>{sp.tone}</div>
                    <div><span className="font-medium text-gray-600">Avg words: </span>{sp.avgWordCount}</div>
                    {sp.vocabulary?.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-600 mb-1">Vocabulary</p>
                        <div className="flex flex-wrap gap-1">
                          {sp.vocabulary.slice(0, 12).map((v: string) => (
                            <span key={v} className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {sp.commonPhrases?.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-600 mb-1">Common phrases</p>
                        {sp.commonPhrases.slice(0, 4).map((ph: string) => (
                          <p key={ph} className="text-gray-500 italic">&ldquo;{ph}&rdquo;</p>
                        ))}
                      </div>
                    )}
                    {sp.summary && <p className="text-gray-600 border-t border-gray-100 pt-2">{sp.summary}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {stats.totalPosts > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-medium text-gray-500">Content type coverage</p>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((ct) => {
                  const count = stats.coverage[ct.value] ?? 0;
                  return (
                    <div key={ct.value}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${count > 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                      {count > 0 ? "✓" : "○"} {ct.label}
                      {count > 0 && <span className="opacity-60 ml-0.5">({count})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}

      {ingestedCount !== null && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="font-semibold text-green-800 mb-1">✓ {ingestedCount} post{ingestedCount !== 1 ? "s" : ""} ingested successfully</p>
          <p className="text-sm text-green-700 mb-4">Run style analysis to extract your writing fingerprint and activate it for all future content generation.</p>
          <button onClick={onAnalyse} disabled={analysing}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" />{analysing ? "Analysing..." : "Run Style Analysis"}
          </button>
          {sp && <p className="mt-2 text-sm text-green-700 font-medium">✓ Style profile updated</p>}
        </div>
      )}
    </div>
  );
}
