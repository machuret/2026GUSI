"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Plus, Trash2, Send, Sparkles, CheckCircle2, Link2, FileText, AlignLeft, BarChart3, RefreshCw, X, ChevronDown, ChevronUp } from "lucide-react";

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

interface PostEntry { title: string; body: string; contentType: string; platform: string; tags: string; }
interface TrainingStats { totalPosts: number; totalWords: number; avgWords: number; coverage: Record<string, number>; readiness: number; styleProfile: any; recommendations: string[]; }

const emptyPost = (): PostEntry => ({ title: "", body: "", contentType: "blog", platform: "website", tags: "" });
const CID = "demo";
const IC = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function ReadinessRing({ score }: { score: number }) {
  const r = 28, circ = 2 * Math.PI * r, fill = circ - (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

export default function IngestPage() {
  const [mode, setMode] = useState<"manual"|"bulk"|"url"|"file">("manual");
  const [posts, setPosts] = useState<PostEntry[]>([emptyPost()]);
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState("blog");
  const [bulkPlatform, setBulkPlatform] = useState("website");
  const [bulkParsed, setBulkParsed] = useState<PostEntry[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlScraping, setUrlScraping] = useState(false);
  const [urlPosts, setUrlPosts] = useState<PostEntry[]>([]);
  const [urlError, setUrlError] = useState<string|null>(null);
  const [fileParsing, setFileParsing] = useState(false);
  const [filePosts, setFilePosts] = useState<PostEntry[]>([]);
  const [fileError, setFileError] = useState<string|null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [ingestedCount, setIngestedCount] = useState<number|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [stats, setStats] = useState<TrainingStats|null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showStyle, setShowStyle] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await fetch(`/api/content/training-stats?companyId=${CID}`);
      if (!r.ok) throw new Error(`Failed to load stats (${r.status})`);
      const d = await r.json();
      if (d.success) setStats(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training stats");
    } finally { setStatsLoading(false); }
  }, []);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const addPost = () => setPosts(p => [...p, emptyPost()]);
  const removePost = (i: number) => setPosts(p => p.filter((_, idx) => idx !== i));
  const updatePost = (i: number, f: keyof PostEntry, v: string) =>
    setPosts(p => { const u = [...p]; u[i] = { ...u[i], [f]: v }; return u; });

  const parseBulk = useCallback(() => {
    const chunks = bulkText.split(/\n---+\n|\n\n\n+/).map(s => s.trim()).filter(Boolean);
    setBulkParsed(chunks.map(body => ({ title: "", body, contentType: bulkType, platform: bulkPlatform, tags: "" })));
  }, [bulkText, bulkType, bulkPlatform]);

  const scrapeUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlScraping(true); setUrlError(null);
    try {
      const r = await fetch("/api/content/scrape-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.trim() }) });
      const d = await r.json();
      if (d.success) { setUrlPosts(p => [...p, { title: d.title, body: d.body, contentType: "blog", platform: d.platform, tags: "" }]); setUrlInput(""); }
      else setUrlError(d.error);
    } finally { setUrlScraping(false); }
  };

  const parseFile = async (file: File) => {
    setFileParsing(true); setFileError(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/content/parse-file", { method: "POST", body: fd });
      const d = await r.json();
      if (d.success) setFilePosts(p => [...p, { title: file.name.replace(/\.[^.]+$/, ""), body: d.text, contentType: "blog", platform: "document", tags: "" }]);
      else setFileError(d.error);
    } finally { setFileParsing(false); }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(f => parseFile(f));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getActive = (): PostEntry[] => {
    if (mode === "manual") return posts.filter(p => p.body.trim());
    if (mode === "bulk") return bulkParsed.filter(p => p.body.trim());
    if (mode === "url") return urlPosts.filter(p => p.body.trim());
    if (mode === "file") return filePosts.filter(p => p.body.trim());
    return [];
  };

  const handleSubmit = async () => {
    const active = getActive();
    if (!active.length) return;
    setLoading(true); setError(null); setIngestedCount(null);
    try {
      const r = await fetch("/api/content/ingest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: CID, posts: active.map(p => ({ ...p, tags: p.tags.split(",").map(t => t.trim()).filter(Boolean) })) }),
      });
      const d = await r.json();
      if (d.success) {
        setIngestedCount(d.postsCreated);
        if (mode === "manual") setPosts([emptyPost()]);
        if (mode === "bulk") { setBulkText(""); setBulkParsed([]); }
        if (mode === "url") setUrlPosts([]);
        if (mode === "file") setFilePosts([]);
        fetchStats();
      } else setError(d.error || "Ingest failed");
    } catch { setError("Failed to submit."); }
    finally { setLoading(false); }
  };

  const handleAnalyse = async () => {
    setAnalysing(true);
    setError(null);
    try {
      const r = await fetch("/api/style/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: CID }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Style analysis failed (${r.status})`);
      }
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Style analysis failed");
    } finally { setAnalysing(false); }
  };

  const active = getActive();
  const sp = stats?.styleProfile;
  const MODES = [
    { id: "manual" as const, label: "Manual", icon: AlignLeft },
    { id: "bulk"   as const, label: "Bulk Paste", icon: FileText },
    { id: "url"    as const, label: "From URL", icon: Link2 },
    { id: "file"   as const, label: "Upload File", icon: Upload },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Train the AI</h1>
        <p className="mt-1 text-gray-500">Feed the AI your existing content. More examples = better output.</p>
      </div>

      {/* Training Quality Dashboard */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-600" />
            <h2 className="font-semibold text-gray-800">Training Quality</h2>
          </div>
          <button onClick={fetchStats} className="text-gray-400 hover:text-gray-600">
            <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {statsLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : stats ? (
          <>
            <div className="flex items-start gap-6">
              <ReadinessRing score={stats.readiness} />
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: "Posts ingested", value: stats.totalPosts },
                    { label: "Total words", value: stats.totalWords.toLocaleString() },
                    { label: "Avg words/post", value: stats.avgWords },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                    </div>
                  ))}
                </div>
                {stats.recommendations.map((rec, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <span className="mt-0.5 shrink-0">&#8594;</span>{rec}
                  </p>
                ))}
              </div>
              {sp && (
                <div className="shrink-0 w-52">
                  <button onClick={() => setShowStyle(v => !v)} className="flex w-full items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100">
                    <span>&#10003; Style profile active</span>
                    {showStyle ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {showStyle && (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-xs space-y-2">
                      <div><span className="font-medium text-gray-600">Tone: </span>{sp.tone}</div>
                      <div><span className="font-medium text-gray-600">Avg words: </span>{sp.avgWordCount}</div>
                      {sp.vocabulary?.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-600 mb-1">Vocabulary</p>
                          <div className="flex flex-wrap gap-1">
                            {sp.vocabulary.slice(0, 12).map((v: string) => (
                              <span key={v} className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{v}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {sp.commonPhrases?.length > 0 && (
                        <div>
                          <p className="font-medium text-gray-600 mb-1">Common phrases</p>
                          {sp.commonPhrases.slice(0, 4).map((ph: string) => (
                            <p key={ph} className="text-gray-500 italic">&ldquo;{ph}&rdquo;</p>
                          ))}
                        </div>
                      )}
                      {sp.summary && <p className="text-gray-600 border-t border-gray-100 pt-2">{sp.summary}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
            {stats.totalPosts > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-medium text-gray-500">Content type coverage</p>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map(ct => {
                    const count = stats.coverage[ct.value] ?? 0;
                    return (
                      <div key={ct.value} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${count > 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                        {count > 0 ? "&#10003;" : "&#9675;"} {ct.label}{count > 0 && <span className="opacity-60 ml-0.5">({count})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Mode tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${mode === m.id ? "border-brand-500 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"}`}>
            <m.icon className="h-4 w-4" /> {m.label}
          </button>
        ))}
      </div>

      {/* Manual */}
      {mode === "manual" && (
        <div className="space-y-4">
          {posts.map((post, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Post {i + 1}</h3>
                {posts.length > 1 && <button onClick={() => removePost(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Content Type</label>
                  <select value={post.contentType} onChange={e => updatePost(i, "contentType", e.target.value)} className={IC}>
                    {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Platform</label>
                  <input value={post.platform} onChange={e => updatePost(i, "platform", e.target.value)} placeholder="website, linkedin..." className={IC} />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-600">Title (optional)</label>
                <input value={post.title} onChange={e => updatePost(i, "title", e.target.value)} placeholder="Post headline" className={IC} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Content *</label>
                  {post.body && <span className="text-xs text-gray-400">{post.body.trim().split(/\s+/).length} words</span>}
                </div>
                <textarea value={post.body} onChange={e => updatePost(i, "body", e.target.value)} placeholder="Paste the full post content here..." rows={6} className={IC} />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-600">Tags (comma-separated)</label>
                <input value={post.tags} onChange={e => updatePost(i, "tags", e.target.value)} placeholder="clinical, education, ultrasound" className={IC} />
              </div>
            </div>
          ))}
          <button onClick={addPost} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Add Another Post
          </button>
        </div>
      )}

      {/* Bulk paste */}
      {mode === "bulk" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-sm text-gray-600">Paste multiple posts separated by <code className="rounded bg-gray-100 px-1">---</code> or three blank lines, then click Parse.</p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Content Type (all)</label>
              <select value={bulkType} onChange={e => setBulkType(e.target.value)} className={IC}>
                {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Platform (all)</label>
              <input value={bulkPlatform} onChange={e => setBulkPlatform(e.target.value)} placeholder="website, linkedin..." className={IC} />
            </div>
          </div>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"Post one...\n\n---\n\nPost two...\n\n---\n\nPost three..."} rows={12} className={IC} />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={parseBulk} disabled={!bulkText.trim()} className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              <AlignLeft className="h-4 w-4" /> Parse {bulkText.trim() ? `(~${bulkText.split(/\n---+\n|\n\n\n+/).filter(s => s.trim()).length} posts)` : ""}
            </button>
            {bulkParsed.length > 0 && <span className="text-sm text-green-700 font-medium">&#10003; {bulkParsed.length} posts ready</span>}
          </div>
          {bulkParsed.length > 0 && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {bulkParsed.map((p, i) => (
                <div key={i} className="flex items-start justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                  <span className="text-gray-700 flex-1 line-clamp-2">{p.body.slice(0, 120)}...</span>
                  <span className="ml-3 shrink-0 text-gray-400">{p.body.trim().split(/\s+/).length}w</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* URL */}
      {mode === "url" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-sm text-gray-600">Paste any public URL and we will extract the text content automatically.</p>
          <div className="flex gap-2">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && scrapeUrl()} placeholder="https://example.com/blog/post" className={`${IC} flex-1`} />
            <button onClick={scrapeUrl} disabled={urlScraping || !urlInput.trim()} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              <Link2 className="h-4 w-4" />{urlScraping ? "Fetching..." : "Fetch"}
            </button>
          </div>
          {urlError && <p className="mt-2 text-xs text-red-600">{urlError}</p>}
          {urlPosts.length > 0 && (
            <div className="mt-4 space-y-2">
              {urlPosts.map((p, i) => (
                <div key={i} className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title || p.platform}</p>
                    <p className="text-xs text-gray-400">{p.body.trim().split(/\s+/).length} words &middot; {p.platform}</p>
                  </div>
                  <button onClick={() => setUrlPosts(prev => prev.filter((_, idx) => idx !== i))} className="ml-3 text-gray-300 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File upload */}
      {mode === "file" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragOver ? "border-brand-400 bg-brand-50" : "border-gray-300 hover:border-brand-300 hover:bg-gray-50"}`}
          >
            <Upload className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-gray-400">Supports PDF, DOCX, TXT, MD</p>
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden" onChange={e => Array.from(e.target.files ?? []).forEach(f => parseFile(f))} />
          </div>
          {fileParsing && <p className="mt-3 text-sm text-brand-600 animate-pulse">Parsing file...</p>}
          {fileError && <p className="mt-2 text-xs text-red-600">{fileError}</p>}
          {filePosts.length > 0 && (
            <div className="mt-4 space-y-2">
              {filePosts.map((p, i) => (
                <div key={i} className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.body.trim().split(/\s+/).length} words</p>
                  </div>
                  <button onClick={() => setFilePosts(prev => prev.filter((_, idx) => idx !== i))} className="ml-3 text-gray-300 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit bar */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || active.length === 0}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {loading ? "Submitting..." : `Submit ${active.length > 0 ? active.length : ""} Post${active.length !== 1 ? "s" : ""}`}
        </button>
        {active.length > 0 && (
          <span className="text-sm text-gray-500">
            {active.reduce((s, p) => s + p.body.trim().split(/\s+/).length, 0).toLocaleString()} words total
          </span>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* Post-ingest success */}
      {ingestedCount !== null && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="font-semibold text-green-800">{ingestedCount} post{ingestedCount !== 1 ? "s" : ""} ingested successfully</p>
          </div>
          <p className="text-sm text-green-700 mb-4">Now run style analysis to extract your writing fingerprint and activate it for all future content generation.</p>
          <button onClick={handleAnalyse} disabled={analysing} className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" />{analysing ? "Analysing..." : "Run Style Analysis"}
          </button>
          {sp && <p className="mt-2 text-sm text-green-700 font-medium">&#10003; Style profile updated</p>}
        </div>
      )}
    </div>
  );
}
