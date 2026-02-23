"use client";

import { useState, useCallback } from "react";
import { Sparkles, Plus, Trash2, CheckCircle2, XCircle, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { CategoryPicker } from "@/components/generate/CategoryPicker";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";

const SOCIAL_PLATFORMS = [
  { id: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "facebook",  label: "Facebook",  emoji: "👥" },
  { id: "twitter",   label: "Twitter/X", emoji: "🐦" },
];

const TONE_LABELS = ["Very Formal", "Formal", "Balanced", "Casual", "Very Casual"];
const LENGTH_LABELS = ["Very Short", "Short", "Medium", "Long", "Very Long"];

interface BulkResult {
  topic: string;
  id: string;
  output: string;
  error?: string;
}

interface ResultCard {
  result: BulkResult;
}

function ResultCard({ result }: ResultCard) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result.error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-800">{result.topic}</p>
          <p className="text-xs text-red-600">{result.error}</p>
        </div>
      </div>
    );
  }

  const preview = result.output.slice(0, 180);
  const wordCount = result.output.trim().split(/\s+/).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <p className="text-sm font-medium text-gray-800 truncate max-w-xs">{result.topic}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{wordCount}w</span>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-white"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-gray-200 p-1 text-gray-400 hover:bg-white"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {expanded ? result.output : preview + (result.output.length > 180 ? "…" : "")}
        </p>
      </div>
    </div>
  );
}

export default function BulkPage() {
  const [category, setCategory] = useState("social_media");
  const [topics, setTopics] = useState<string[]>(["", "", ""]);
  const [platform, setPlatform] = useState("");
  const [tone, setTone] = useState(2);
  const [length, setLength] = useState(2);
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [cta, setCta] = useState("");
  const [keywords, setKeywords] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSocial = category === "social_media";
  const validTopics = topics.filter((t) => t.trim().length > 0);

  const addTopic = () => setTopics((prev) => [...prev, ""]);
  const removeTopic = (i: number) => setTopics((prev) => prev.filter((_, idx) => idx !== i));
  const updateTopic = (i: number, val: string) =>
    setTopics((prev) => { const u = [...prev]; u[i] = val; return u; });

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const lines = e.clipboardData.getData("text").split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      setTopics(lines.slice(0, 20));
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!validTopics.length) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(0);

    try {
      const res = await authFetch("/api/content/generate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          category,
          topics: validTopics,
          brief: {
            audience: audience || undefined,
            goal: goal || undefined,
            cta: cta || undefined,
            keywords: keywords || undefined,
            tone,
            length,
            platform: platform || undefined,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      } else {
        setError(data.error || "Bulk generation failed");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [validTopics, category, audience, goal, cta, keywords, tone, length, platform]);

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bulk Generate</h1>
        <p className="mt-1 text-gray-500">
          Enter up to 20 topics and generate all posts in one batch
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        {/* Category */}
        <CategoryPicker
          selected={category}
          onChange={(key) => { setCategory(key); setPlatform(""); }}
        />

        {/* Platform picker for social */}
        {isSocial && (
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Platform</p>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(platform === p.id ? "" : p.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    platform === p.id
                      ? "border-brand-500 bg-brand-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  <span>{p.emoji}</span> {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tone + Length */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Tone</label>
              <span className="text-xs text-brand-600 font-medium">{TONE_LABELS[tone]}</span>
            </div>
            <input type="range" min={0} max={4} value={tone} onChange={(e) => setTone(Number(e.target.value))} className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>Formal</span><span>Casual</span></div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Length</label>
              <span className="text-xs text-brand-600 font-medium">{LENGTH_LABELS[length]}</span>
            </div>
            <input type="range" min={0} max={4} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>Short</span><span>Long</span></div>
          </div>
        </div>

        {/* Advanced */}
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAdvanced ? "Hide" : "Show"} shared brief (audience, goal, CTA, keywords)
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Target Audience</label>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Small business owners" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Goal</label>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Drive sign-ups" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Call to Action</label>
              <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="e.g. Book a free call" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Keywords / Hashtags</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. AI, automation" className={inputCls} />
            </div>
          </div>
        )}

        {/* Topics */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">
              Topics <span className="ml-1 text-xs font-normal text-gray-400">({validTopics.length} / 20)</span>
            </label>
            <span className="text-xs text-gray-400">Tip: paste a list and it auto-splits by line</span>
          </div>
          <div className="space-y-2">
            {topics.map((topic, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-gray-400">{i + 1}</span>
                <textarea
                  value={topic}
                  onChange={(e) => updateTopic(i, e.target.value)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  placeholder={i === 0 ? "Paste a list here or type topics one by one…" : `Topic ${i + 1}`}
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {topics.length > 1 && (
                  <button onClick={() => removeTopic(i)} className="text-gray-300 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {topics.length < 20 && (
            <button onClick={addTopic} className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600">
              <Plus className="h-3.5 w-3.5" /> Add topic
            </button>
          )}
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={handleGenerate}
            disabled={loading || validTopics.length === 0}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {loading
              ? `Generating… (this may take a minute)`
              : `Generate ${validTopics.length} post${validTopics.length !== 1 ? "s" : ""}`}
          </button>
          {loading && (
            <div className="flex-1 rounded-full bg-gray-100 h-2 overflow-hidden">
              <div className="h-2 bg-brand-500 animate-pulse rounded-full w-full" />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {results && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Results — {results.filter((r) => !r.error).length} generated
              {results.filter((r) => r.error).length > 0 && (
                <span className="ml-2 text-sm font-normal text-red-500">
                  ({results.filter((r) => r.error).length} failed)
                </span>
              )}
            </h2>
            <a href="/history" className="text-xs text-brand-600 hover:underline">
              View in History →
            </a>
          </div>
          {results.map((r, i) => (
            <ResultCard key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}
