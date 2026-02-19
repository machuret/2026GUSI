"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CATEGORIES } from "./CategoryPicker";

const SOCIAL_PLATFORMS = [
  { id: "all",       label: "All Platforms",  desc: "Adapt for Facebook, LinkedIn & Instagram" },
  { id: "linkedin",  label: "LinkedIn",        desc: "Professional, thought-leadership tone" },
  { id: "facebook",  label: "Facebook",        desc: "Conversational, community-focused" },
  { id: "instagram", label: "Instagram",       desc: "Visual-first, short captions & hashtags" },
];

interface Props {
  category: string;
  prompt: string;
  loading: boolean;
  onChange: (value: string) => void;
  onGenerate: (platform?: string) => void;
}

export function PromptInput({ category, prompt, loading, onChange, onGenerate }: Props) {
  const selectedCat = CATEGORIES.find((c) => c.key === category);
  const isSocial = category === "social_media";
  const [platform, setPlatform] = useState("all");

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
        <label className="text-sm font-semibold text-gray-700">Describe what you need</label>
      </div>

      {/* Social media platform picker */}
      {isSocial && (
        <div className="mt-3 mb-3">
          <p className="mb-2 text-xs font-medium text-gray-500">Which platform?</p>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                title={p.desc}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  platform === p.id
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {platform !== "all" && (
            <p className="mt-1 text-xs text-gray-400">
              {SOCIAL_PLATFORMS.find((p) => p.id === platform)?.desc}
            </p>
          )}
        </div>
      )}

      <textarea
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g., ${selectedCat?.prompts[0] ?? ""}`}
        rows={3}
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {selectedCat?.prompts.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <button
          onClick={() => onGenerate(isSocial ? platform : undefined)}
          disabled={loading || !prompt.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating..." : `Generate ${isSocial && platform !== "all" ? SOCIAL_PLATFORMS.find(p => p.id === platform)?.label : selectedCat?.label ?? "Content"}`}
        </button>
      </div>
    </div>
  );
}
