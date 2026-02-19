"use client";

import { useState } from "react";
import { Link2, X } from "lucide-react";
import type { PostEntry } from "./ManualPanel";

const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const CONTENT_TYPES = [
  { value: "blog",          label: "Blog Post" },
  { value: "newsletter",    label: "Newsletter" },
  { value: "announcement",  label: "Announcement" },
  { value: "linkedin",      label: "LinkedIn Post" },
  { value: "facebook",      label: "Facebook Post" },
  { value: "instagram",     label: "Instagram Post" },
  { value: "twitter",       label: "Twitter / X Post" },
  { value: "email",         label: "Email Campaign" },
  { value: "press-release", label: "Press Release" },
  { value: "case-study",    label: "Case Study" },
  { value: "video-script",  label: "Video Script" },
  { value: "webinar",       label: "Webinar / Talk" },
  { value: "course",        label: "Course Content" },
  { value: "testimonial",   label: "Testimonial / Review" },
];

const PLATFORMS = [
  "website", "linkedin", "instagram", "facebook", "twitter",
  "youtube", "email", "podcast", "other",
];

interface Props {
  urlPosts: PostEntry[];
  onRemove: (i: number) => void;
  onAdded: (post: PostEntry) => void;
}

export function UrlPanel({ urlPosts, onRemove, onAdded }: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [contentType, setContentType] = useState("blog");
  const [platform, setPlatform] = useState("website");
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
        onAdded({ title: d.title, body: d.body, contentType, platform, tags: "" });
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <p className="text-sm text-gray-600">Paste any public URL — we extract the text and tag it so the AI learns the right style for each content type.</p>

      {/* Content type + platform selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Content Type *</label>
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

      {/* URL input */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">URL *</label>
        <div className="flex gap-2">
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && scrape()}
            placeholder="https://example.com/blog/post"
            className={`${IC} flex-1`} />
          <button onClick={scrape} disabled={scraping || !urlInput.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            <Link2 className="h-4 w-4" />{scraping ? "Fetching…" : "Fetch"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {urlPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">{urlPosts.length} URL{urlPosts.length !== 1 ? "s" : ""} queued</p>
          {urlPosts.map((p, i) => (
            <div key={i} className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.title || p.platform}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.body.trim().split(/\s+/).length} words
                  <span className="mx-1.5">·</span>
                  <span className="capitalize">{p.contentType.replace("-", " ")}</span>
                  <span className="mx-1.5">·</span>
                  {p.platform}
                </p>
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
