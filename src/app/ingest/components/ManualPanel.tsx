"use client";

import { Plus, Trash2 } from "lucide-react";

const CONTENT_TYPES = [
  { value: "blog", label: "Blog Post" },
  { value: "newsletter", label: "Newsletter" },
  { value: "announcement", label: "Announcement" },
  { value: "linkedin", label: "LinkedIn Post" },
  { value: "facebook", label: "Facebook Post" },
  { value: "instagram", label: "Instagram Post" },
  { value: "twitter", label: "Twitter / X Post" },
  { value: "email", label: "Email Campaign" },
  { value: "press-release", label: "Press Release" },
  { value: "case-study", label: "Case Study" },
];

export interface PostEntry {
  title: string;
  body: string;
  contentType: string;
  platform: string;
  tags: string;
}

const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface Props {
  posts: PostEntry[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: keyof PostEntry, value: string) => void;
}

export function ManualPanel({ posts, onAdd, onRemove, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      {posts.map((post, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Post {i + 1}</h3>
            {posts.length > 1 && (
              <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Content Type</label>
              <select value={post.contentType} onChange={(e) => onUpdate(i, "contentType", e.target.value)} className={IC}>
                {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Platform</label>
              <input value={post.platform} onChange={(e) => onUpdate(i, "platform", e.target.value)} placeholder="website, linkedin..." className={IC} />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Title (optional)</label>
            <input value={post.title} onChange={(e) => onUpdate(i, "title", e.target.value)} placeholder="Post headline" className={IC} />
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Content *</label>
              {post.body && <span className="text-xs text-gray-400">{post.body.trim().split(/\s+/).length} words</span>}
            </div>
            <textarea value={post.body} onChange={(e) => onUpdate(i, "body", e.target.value)}
              placeholder="Paste the full post content here..." rows={6} className={IC} />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Tags (comma-separated)</label>
            <input value={post.tags} onChange={(e) => onUpdate(i, "tags", e.target.value)}
              placeholder="clinical, education, ultrasound" className={IC} />
          </div>
        </div>
      ))}
      <button onClick={onAdd}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        <Plus className="h-4 w-4" /> Add Another Post
      </button>
    </div>
  );
}
