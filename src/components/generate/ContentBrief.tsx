"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { CATEGORIES } from "./CategoryPicker";

export interface BriefFields {
  topic: string;
  audience: string;
  goal: string;
  cta: string;
  keywords: string;
  tone: number;
  length: number;
  platform: string;
}

const SOCIAL_PLATFORMS = [
  { id: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "facebook",  label: "Facebook",  emoji: "👥" },
  { id: "twitter",   label: "Twitter/X", emoji: "🐦" },
];

const TONE_LABELS = ["Very Formal", "Formal", "Balanced", "Casual", "Very Casual"];
const LENGTH_LABELS = ["Very Short", "Short", "Medium", "Long", "Very Long"];

const defaultBrief = (): BriefFields => ({
  topic: "",
  audience: "",
  goal: "",
  cta: "",
  keywords: "",
  tone: 2,
  length: 2,
  platform: "",
});

interface Props {
  category: string;
  loading: boolean;
  onGenerate: (brief: BriefFields) => void;
}

export function ContentBrief({ category, loading, onGenerate }: Props) {
  const [brief, setBrief] = useState<BriefFields>(defaultBrief);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const selectedCat = CATEGORIES.find((c) => c.key === category);
  const isSocial = category === "social_media";

  const set = (field: keyof BriefFields, value: string | number) =>
    setBrief((prev) => ({ ...prev, [field]: value }));

  const isValid = brief.topic.trim().length > 0;

  const inputCls =
    "w-full rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <div className="mt-5 space-y-4">
      {/* Step label */}
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
        <label className="text-sm font-semibold text-gray-700">Content Brief</label>
      </div>

      {/* Platform picker for social */}
      {isSocial && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-700">Platform</p>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => set("platform", brief.platform === p.id ? "" : p.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  brief.platform === p.id
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-brand-400 hover:text-brand-700"
                }`}
              >
                <span>{p.emoji}</span> {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Topic — required */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Topic <span className="text-red-500">*</span>
        </label>
        <textarea
          value={brief.topic}
          onChange={(e) => set("topic", e.target.value)}
          placeholder={selectedCat?.prompts[0] ?? "What is this content about?"}
          rows={2}
          className={inputCls}
        />
        {/* Quick-pick prompts */}
        {selectedCat && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedCat.prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("topic", p)}
                className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Audience + Goal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Target Audience</label>
          <input
            value={brief.audience}
            onChange={(e) => set("audience", e.target.value)}
            placeholder="e.g. Small business owners"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Goal</label>
          <input
            value={brief.goal}
            onChange={(e) => set("goal", e.target.value)}
            placeholder="e.g. Drive sign-ups, build trust"
            className={inputCls}
          />
        </div>
      </div>

      {/* Tone + Length sliders */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">Tone</label>
            <span className="text-xs text-brand-600 font-medium">{TONE_LABELS[brief.tone]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            value={brief.tone}
            onChange={(e) => set("tone", Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>Formal</span><span>Casual</span>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">Length</label>
            <span className="text-xs text-brand-600 font-medium">{LENGTH_LABELS[brief.length]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            value={brief.length}
            onChange={(e) => set("length", Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>Short</span><span>Long</span>
          </div>
        </div>
      </div>

      {/* Advanced fields toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
      >
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showAdvanced ? "Hide" : "Show"} advanced fields (CTA, keywords)
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Call to Action</label>
            <input
              value={brief.cta}
              onChange={(e) => set("cta", e.target.value)}
              placeholder="e.g. Book a free call"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Keywords / Hashtags</label>
            <input
              value={brief.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="e.g. AI, automation, growth"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* Generate button */}
      <div>
        <button
          type="button"
          onClick={() => onGenerate(brief)}
          disabled={loading || !isValid}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {loading
            ? "Generating..."
            : `Generate ${isSocial && brief.platform ? SOCIAL_PLATFORMS.find((p) => p.id === brief.platform)?.label ?? "" : selectedCat?.label ?? "Content"}`}
        </button>
      </div>
    </div>
  );
}
