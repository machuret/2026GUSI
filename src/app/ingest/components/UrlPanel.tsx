"use client";

import { useState } from "react";
import { Link2, X } from "lucide-react";
import type { PostEntry } from "./ManualPanel";

const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface Props {
  urlPosts: PostEntry[];
  onRemove: (i: number) => void;
  onAdded: (post: PostEntry) => void;
}

export function UrlPanel({ urlPosts, onRemove, onAdded }: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrape = async () => {
    if (!urlInput.trim()) return;
    setScraping(true); setError(null);
    try {
      const r = await fetch("/api/content/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        onAdded({ title: d.title, body: d.body, contentType: "blog", platform: d.platform, tags: "" });
        setUrlInput("");
      } else {
        setError(d.error);
      }
    } catch {
      setError("Network error");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="mb-3 text-sm text-gray-600">Paste any public URL and we will extract the text content automatically.</p>
      <div className="flex gap-2">
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scrape()}
          placeholder="https://example.com/blog/post"
          className={`${IC} flex-1`} />
        <button onClick={scrape} disabled={scraping || !urlInput.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          <Link2 className="h-4 w-4" />{scraping ? "Fetching..." : "Fetch"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {urlPosts.length > 0 && (
        <div className="mt-4 space-y-2">
          {urlPosts.map((p, i) => (
            <div key={i} className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.title || p.platform}</p>
                <p className="text-xs text-gray-400">{p.body.trim().split(/\s+/).length} words · {p.platform}</p>
              </div>
              <button onClick={() => onRemove(i)} className="ml-3 text-gray-300 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
