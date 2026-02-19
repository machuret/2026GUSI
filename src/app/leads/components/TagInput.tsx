"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-[42px] flex-wrap gap-1.5 rounded-lg border border-gray-300 px-3 py-2 cursor-text focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500"
    >
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
          {tag}
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(tags.filter((t) => t !== tag)); }} className="text-brand-500 hover:text-brand-800">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? (placeholder ?? "Type and press Enter or comma") : "Add more…"}
        className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
