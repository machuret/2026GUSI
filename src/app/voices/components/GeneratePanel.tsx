"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, AlertCircle, Sliders } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { StyleProfile } from "./AuthorDetail";

const CONTENT_TYPES = [
  { value: "blog",          label: "Blog Post" },
  { value: "newsletter",    label: "Newsletter" },
  { value: "linkedin",      label: "LinkedIn Post" },
  { value: "facebook",      label: "Facebook Post" },
  { value: "instagram",     label: "Instagram Post" },
  { value: "twitter",       label: "Twitter / X" },
  { value: "email",         label: "Email Campaign" },
  { value: "press-release", label: "Press Release" },
  { value: "essay",         label: "Essay / Article" },
  { value: "speech",        label: "Speech / Talk" },
  { value: "video-script",  label: "Video Script" },
  { value: "podcast",       label: "Podcast Script" },
];

const PLATFORMS = ["website","linkedin","instagram","facebook","twitter","youtube","email","podcast","other"];

const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface Props {
  authorId: string;
  authorName: string;
  style: StyleProfile | null;
}

export function GeneratePanel({ authorId, authorName, style }: Props) {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("blog");
  const [platform, setPlatform] = useState("website");
  const [targetWords, setTargetWords] = useState(400);
  const [temperature, setTemperature] = useState(0.75);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [meta, setMeta] = useState<{ wordCount: number; tokensUsed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true); setError(null); setOutput(""); setMeta(null);
    try {
      const res = await authFetch(`/api/voices/${authorId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), contentType, platform, targetWords, temperature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setOutput(data.output);
      setMeta({ wordCount: data.wordCount, tokensUsed: data.tokensUsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally { setGenerating(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!style?.systemPrompt) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-gray-200 mb-3" />
        <p className="font-semibold text-gray-400">Style analysis required</p>
        <p className="mt-1 text-sm text-gray-400">
          Go to the Style Profile tab and run analysis before generating content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Voice badge */}
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-200 text-brand-700 font-bold text-lg shrink-0">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-900">Writing as {authorName}</p>
          {style.tone && <p className="text-xs text-brand-600 capitalize">{style.tone}</p>}
        </div>
        {style.tokenCount && (
          <span className="ml-auto text-xs text-brand-500">{style.tokenCount.toLocaleString()} token profile</span>
        )}
      </div>

      {/* Config */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Content Type</label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value)} className={IC}>
              {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={IC}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Target Length (words)</label>
          <div className="flex items-center gap-3">
            <input type="range" min={50} max={2000} step={50} value={targetWords}
              onChange={(e) => setTargetWords(Number(e.target.value))}
              className="flex-1 accent-brand-600" />
            <span className="w-16 text-right text-sm font-medium text-gray-700">{targetWords} words</span>
          </div>
        </div>

        {/* Advanced toggle */}
        <button onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600">
          <Sliders className="h-3.5 w-3.5" />
          {showAdvanced ? "Hide" : "Show"} advanced settings
        </button>

        {showAdvanced && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Creativity / Temperature: {temperature.toFixed(2)}
              <span className="ml-2 text-gray-400">(lower = more faithful to style, higher = more creative)</span>
            </label>
            <input type="range" min={0.1} max={1.0} step={0.05} value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-brand-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Faithful clone</span><span>Creative interpretation</span>
            </div>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <label className="mb-2 block text-sm font-semibold text-gray-800">
          What should {authorName} write about?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={`e.g. "Write a LinkedIn post about why most people fail at building habits" or "Write a newsletter intro about the future of AI in healthcare"`}
          className={IC}
        />
        <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
          className="mt-3 flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? `Generating in ${authorName}'s voice…` : `Generate as ${authorName}`}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      {output && (
        <div className="rounded-xl border border-green-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Generated in {authorName}'s voice</p>
              {meta && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {meta.wordCount} words · {meta.tokensUsed.toLocaleString()} tokens used
                </p>
              )}
            </div>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">{output}</pre>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="mt-3 flex items-center gap-1.5 text-xs text-brand-600 hover:underline disabled:opacity-50">
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
