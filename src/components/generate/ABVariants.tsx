"use client";

import { useState } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";

export interface ABVariant {
  id: string;
  output: string;
  category: string;
}

interface Props {
  variantA: ABVariant;
  variantB: ABVariant;
  onPick: (chosen: ABVariant, rejected: ABVariant) => void;
  onCreateAnother: () => void;
}

function VariantCard({
  label,
  variant,
  onPick,
  onReject,
}: {
  label: string;
  variant: ABVariant;
  onPick: () => void;
  onReject: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(variant.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = variant.output.trim().split(/\s+/).length;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {label}
          </span>
          <span className="text-sm font-medium text-gray-700">Version {label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{wordCount} words</span>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{variant.output}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
        <button
          onClick={onPick}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <ThumbsUp className="h-4 w-4" />
          Use this version
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ABVariants({ variantA, variantB, onPick, onCreateAnother }: Props) {
  const [picked, setPicked] = useState<"A" | "B" | null>(null);

  const handlePick = (chosen: ABVariant, rejected: ABVariant) => {
    setPicked(chosen.id === variantA.id ? "A" : "B");
    onPick(chosen, rejected);
  };

  if (picked) {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="font-semibold text-green-800">Version {picked} approved ✓</p>
        <p className="mt-1 text-sm text-green-700">The other version has been rejected and a lesson saved.</p>
        <button
          onClick={onCreateAnother}
          className="mt-4 rounded-lg border border-green-300 bg-white px-5 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pick the better version</h2>
        <button onClick={onCreateAnother} className="text-xs text-gray-400 hover:text-gray-600">
          Start over
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VariantCard
          label="A"
          variant={variantA}
          onPick={() => handlePick(variantA, variantB)}
          onReject={() => handlePick(variantB, variantA)}
        />
        <VariantCard
          label="B"
          variant={variantB}
          onPick={() => handlePick(variantB, variantA)}
          onReject={() => handlePick(variantA, variantB)}
        />
      </div>
    </div>
  );
}
