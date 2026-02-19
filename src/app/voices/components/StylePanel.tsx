"use client";

import { Brain, Loader2, RefreshCw, Tag, MessageSquare, Zap, Eye, BookOpen, Smile, Star } from "lucide-react";
import type { StyleProfile } from "./AuthorDetail";

interface Props {
  style: StyleProfile | null;
  authorName: string;
  onAnalyse: () => void;
  analysing: boolean;
  postCount: number;
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700">
      {label}
    </span>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Icon className="h-4 w-4 text-brand-500" /> {title}
      </h4>
      {children}
    </div>
  );
}

export function StylePanel({ style, authorName, onAnalyse, analysing, postCount }: Props) {
  if (!style) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
        <Brain className="mx-auto h-12 w-12 text-gray-200 mb-3" />
        <p className="font-semibold text-gray-400">No style profile yet</p>
        <p className="mt-1 text-sm text-gray-400 mb-5">
          {postCount === 0
            ? "Upload content samples first, then run analysis"
            : `${postCount} sample${postCount !== 1 ? "s" : ""} ready — run analysis to build the voice profile`}
        </p>
        <button onClick={onAnalyse} disabled={analysing || postCount === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {analysing ? "Analysing…" : "Analyse Style Now"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 mb-1">Voice Fingerprint</p>
            <h3 className="text-xl font-bold text-brand-900">{authorName}</h3>
            {style.tone && (
              <span className="mt-1 inline-block rounded-full bg-brand-200 px-3 py-0.5 text-xs font-semibold text-brand-800 capitalize">
                {style.tone}
              </span>
            )}
          </div>
          <div className="text-right text-xs text-brand-500">
            {style.avgWordCount && <p>Avg {style.avgWordCount} words/piece</p>}
            {style.tokenCount && <p>{style.tokenCount.toLocaleString()} tokens used</p>}
            {style.updatedAt && <p>Updated {new Date(style.updatedAt).toLocaleDateString()}</p>}
          </div>
        </div>
        {style.summary && (
          <p className="mt-3 text-sm text-brand-800 leading-relaxed italic">"{style.summary}"</p>
        )}
        <button onClick={onAnalyse} disabled={analysing}
          className="mt-3 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50">
          {analysing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {analysing ? "Re-analysing…" : "Re-analyse"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Vocabulary */}
        {style.vocabulary?.length ? (
          <Section icon={Tag} title="Signature Vocabulary">
            <div className="flex flex-wrap gap-1.5">
              {style.vocabulary.map((w, i) => <Chip key={i} label={w} />)}
            </div>
          </Section>
        ) : null}

        {/* Common phrases */}
        {style.commonPhrases?.length ? (
          <Section icon={MessageSquare} title="Common Phrases">
            <ul className="space-y-1.5">
              {style.commonPhrases.map((p, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-brand-400 mt-0.5">›</span>"{p}"
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Sentence patterns */}
        {style.sentencePatterns?.length ? (
          <Section icon={Zap} title="Sentence Patterns">
            <ul className="space-y-1.5">
              {style.sentencePatterns.map((p, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-brand-400 mt-0.5">›</span>{p}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Rhetorical devices */}
        {style.rhetoricalDevices?.length ? (
          <Section icon={BookOpen} title="Rhetorical Devices">
            <ul className="space-y-1.5">
              {style.rhetoricalDevices.map((d, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-brand-400 mt-0.5">›</span>{d}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Opening hooks */}
        {style.openingHooks?.length ? (
          <Section icon={Eye} title="Opening Hooks">
            <ul className="space-y-1.5">
              {style.openingHooks.map((h, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-brand-400 mt-0.5">›</span>{h}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Closing patterns */}
        {style.closingPatterns?.length ? (
          <Section icon={Star} title="Closing Patterns">
            <ul className="space-y-1.5">
              {style.closingPatterns.map((c, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-brand-400 mt-0.5">›</span>{c}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Preferred formats */}
        {style.preferredFormats?.length ? (
          <Section icon={BookOpen} title="Preferred Formats">
            <div className="flex flex-wrap gap-1.5">
              {style.preferredFormats.map((f, i) => <Chip key={i} label={f} />)}
            </div>
          </Section>
        ) : null}

        {/* Emotional range */}
        {style.emotionalRange ? (
          <Section icon={Smile} title="Emotional Range">
            <p className="text-xs text-gray-600 leading-relaxed">{style.emotionalRange}</p>
          </Section>
        ) : null}
      </div>

      {/* Unique quirks */}
      {style.uniqueQuirks && (
        <Section icon={Star} title="Unique Quirks — What Makes This Voice Unmistakable">
          <p className="text-sm text-gray-700 leading-relaxed">{style.uniqueQuirks}</p>
        </Section>
      )}

      {/* System prompt */}
      {style.systemPrompt && (
        <div className="rounded-xl border border-gray-200 bg-gray-900 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">AI Clone System Prompt</p>
          <pre className="whitespace-pre-wrap text-xs text-green-400 leading-relaxed font-mono">{style.systemPrompt}</pre>
        </div>
      )}
    </div>
  );
}
