"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Loader2, FileText, Plus, X } from "lucide-react";
import type { AuthorPost } from "./AuthorDetail";

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
  { value: "book",          label: "Book Excerpt" },
  { value: "interview",     label: "Interview" },
  { value: "video-script",  label: "Video Script" },
  { value: "podcast",       label: "Podcast Transcript" },
];

const PLATFORMS = ["website","linkedin","instagram","facebook","twitter","youtube","email","podcast","book","other"];

const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface PendingPost { title: string; body: string; contentType: string; platform: string; }

interface Props {
  authorId: string;
  posts: AuthorPost[];
  onUploaded: () => void;
  onDeleted: () => void;
}

export function UploadPanel({ authorId, posts, onUploaded, onDeleted }: Props) {
  const [pending, setPending] = useState<PendingPost[]>([{ title: "", body: "", contentType: "blog", platform: "website" }]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (i: number, k: keyof PendingPost, v: string) =>
    setPending((p) => { const u = [...p]; u[i] = { ...u[i], [k]: v }; return u; });

  const addRow = () => setPending((p) => [...p, { title: "", body: "", contentType: "blog", platform: "website" }]);
  const removeRow = (i: number) => setPending((p) => p.filter((_, idx) => idx !== i));

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const body = (e.target?.result as string) ?? "";
        setPending((p) => [...p, { title: file.name.replace(/\.[^.]+$/, ""), body, contentType: "blog", platform: "website" }]);
      };
      reader.readAsText(file);
    });
  };

  const handleUpload = async () => {
    const valid = pending.filter((p) => p.body.trim().length > 0);
    if (!valid.length) { setError("Add at least one piece of content"); return; }
    setUploading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/voices/${authorId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSuccess(`✓ ${data.created} sample${data.created !== 1 ? "s" : ""} uploaded`);
      setPending([{ title: "", body: "", contentType: "blog", platform: "website" }]);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    try {
      await fetch(`/api/voices/${authorId}/posts?postId=${postId}`, { method: "DELETE" });
      onDeleted();
    } finally { setDeletingId(null); }
  };

  const totalPendingWords = pending.reduce((s, p) => s + (p.body.trim() ? p.body.trim().split(/\s+/).length : 0), 0);

  return (
    <div className="space-y-6">
      {/* Input area */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Add Content Samples</h3>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Upload className="h-3.5 w-3.5" /> Upload .txt files
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md" multiple className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
          </div>
        </div>

        <div className="space-y-4">
          {pending.map((p, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Sample {i + 1}</span>
                {pending.length > 1 && (
                  <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Content Type</label>
                  <select value={p.contentType} onChange={(e) => update(i, "contentType", e.target.value)} className={IC}>
                    {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Platform</label>
                  <select value={p.platform} onChange={(e) => update(i, "platform", e.target.value)} className={IC}>
                    {PLATFORMS.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Title (optional)</label>
                <input value={p.title} onChange={(e) => update(i, "title", e.target.value)}
                  placeholder="Article or post title…" className={IC} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Content *</label>
                  {p.body && <span className="text-xs text-gray-400">{p.body.trim().split(/\s+/).length} words</span>}
                </div>
                <textarea value={p.body} onChange={(e) => update(i, "body", e.target.value)}
                  rows={8} placeholder="Paste the full text of this piece here…" className={IC} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Add Another
          </button>
          <button onClick={handleUpload} disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : `Upload ${pending.filter(p => p.body.trim()).length > 0 ? pending.filter(p => p.body.trim()).length : ""} Sample${pending.filter(p => p.body.trim()).length !== 1 ? "s" : ""}`}
          </button>
          {totalPendingWords > 0 && <span className="text-xs text-gray-400">{totalPendingWords.toLocaleString()} words</span>}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm font-medium text-green-600">{success}</p>}
      </div>

      {/* Uploaded samples list */}
      {posts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-gray-800">
            Uploaded Samples <span className="text-gray-400 font-normal text-sm">({posts.length})</span>
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {posts.map((post) => (
              <div key={post.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{post.title || `Untitled ${post.contentType}`}</p>
                    <p className="text-xs text-gray-400">
                      {post.contentType} · {post.platform} · {(post.wordCount ?? 0).toLocaleString()} words
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDelete(post.id)} disabled={deletingId === post.id}
                  className="ml-3 shrink-0 text-gray-300 hover:text-red-500 disabled:opacity-40">
                  {deletingId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
