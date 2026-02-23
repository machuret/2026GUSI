"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Layers, Loader2, Sparkles, Copy, Check, ChevronDown, ChevronUp,
  RefreshCw, Download, Palette, BookOpen, List, Brain, MessageSquare,
  Save, Trash2, Lightbulb, FolderOpen,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarouselSlide {
  slideNumber: number;
  role: string;
  headline: string;
  body: string;
  designNote?: string;
}

interface CarouselResult {
  title: string;
  slides: CarouselSlide[];
  hashtags?: string[];
  canvaNote?: string;
}

interface SavedCarousel {
  id: string;
  title: string;
  topic: string;
  carouselType: string;
  slides: CarouselSlide[];
  hashtags?: string[];
  canvaNote?: string;
  createdAt: string;
}

interface CarouselIdea {
  id: string;
  title: string;
  summary: string;
  category: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAROUSEL_TYPES = [
  { key: "educational", label: "Educational", icon: BookOpen,      desc: "Teach step-by-step" },
  { key: "narrative",   label: "Narrative",   icon: MessageSquare, desc: "Tell a story" },
  { key: "list",        label: "List",        icon: List,          desc: "Reveal items one by one" },
  { key: "persuasion",  label: "Persuasion",  icon: Brain,         desc: "Shift beliefs" },
] as const;

type CarouselType = typeof CAROUSEL_TYPES[number]["key"];

const TONE_LABELS  = ["Very Formal", "Formal", "Balanced", "Casual", "Very Casual"];
const SLIDE_COUNTS = ["5 slides", "7 slides", "10 slides", "12 slides", "15 slides"];

const ROLE_COLORS: Record<string, string> = {
  hook:       "bg-brand-600 text-white",
  context:    "bg-indigo-500 text-white",
  body:       "bg-gray-700 text-white",
  resolution: "bg-emerald-600 text-white",
  cta:        "bg-orange-500 text-white",
};

const ROLE_LABEL: Record<string, string> = {
  hook:       "Hook",
  context:    "Context",
  body:       "Body",
  resolution: "Resolution",
  cta:        "CTA",
};

// ── Slide Card ────────────────────────────────────────────────────────────────

function SlideCard({ slide, index }: { slide: CarouselSlide; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const role = slide.role?.toLowerCase() ?? "body";
  const badgeClass = ROLE_COLORS[role] ?? ROLE_COLORS.body;

  const copyText = () => {
    const text = [slide.headline, slide.body].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Slide header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
          {index + 1}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${badgeClass}`}>
          {ROLE_LABEL[role] ?? role}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={copyText} className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700" title="Copy slide text">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {slide.designNote && (
            <button onClick={() => setExpanded(v => !v)} className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700" title="Design note">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Slide content — visual preview */}
      <div className="p-5 space-y-2">
        {slide.headline && (
          <p className="text-base font-bold text-gray-900 leading-snug">{slide.headline}</p>
        )}
        {slide.body && (
          <p className="text-sm text-gray-600 leading-relaxed">{slide.body}</p>
        )}
      </div>

      {/* Design note */}
      {expanded && slide.designNote && (
        <div className="border-t border-gray-100 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" /> Canva Design Note
          </p>
          <p className="text-xs text-amber-800">{slide.designNote}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CarouselCreatorPage() {
  const searchParams = useSearchParams();

  const [topic,        setTopic]        = useState(searchParams.get("topic") ?? "");
  const [audience,     setAudience]     = useState("");
  const [goal,         setGoal]         = useState("");
  const [cta,          setCta]          = useState("");
  const [keywords,     setKeywords]     = useState("");
  const [tone,         setTone]         = useState(2);
  const [slideCount,   setSlideCount]   = useState(1);
  const [carouselType, setCarouselType] = useState<CarouselType>("educational");

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<CarouselResult | null>(null);
  const [allDesignNotes, setAllDesignNotes] = useState(false);

  // Save state
  const [saving, setSaving]               = useState(false);
  const [savedMsg, setSavedMsg]           = useState<string | null>(null);

  // Saved carousels library
  const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
  const [loadingSaved, setLoadingSaved]     = useState(true);
  const [showSaved, setShowSaved]           = useState(false);

  // Carousel ideas from Ideas page
  const [carouselIdeas, setCarouselIdeas]   = useState<CarouselIdea[]>([]);
  const [showIdeas, setShowIdeas]           = useState(false);

  // ── Load saved carousels & carousel ideas ────────────────────────────────

  const fetchSaved = useCallback(async () => {
    try {
      const res = await authFetch("/api/carousel/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedCarousels(data.carousels ?? []);
      }
    } catch { /* silent */ } finally {
      setLoadingSaved(false);
    }
  }, []);

  const fetchCarouselIdeas = useCallback(async () => {
    try {
      const res = await authFetch("/api/ideas?contentType=carousel&category=Carousel+Topic");
      if (res.ok) {
        const data = await res.json();
        setCarouselIdeas((data.ideas ?? []).filter((i: CarouselIdea) => i.title));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchSaved(); fetchCarouselIdeas(); }, [fetchSaved, fetchCarouselIdeas]);

  // ── Save carousel ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await authFetch("/api/carousel/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          topic,
          carouselType,
          slides: result.slides,
          hashtags: result.hashtags,
          canvaNote: result.canvaNote,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedMsg("Carousel saved!");
      fetchSaved();
      setTimeout(() => setSavedMsg(null), 3000);
    } catch {
      setSavedMsg("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete saved carousel ────────────────────────────────────────────────

  const handleDeleteSaved = async (id: string) => {
    if (!confirm("Delete this saved carousel?")) return;
    try {
      await authFetch(`/api/carousel/saved/${id}`, { method: "DELETE" });
      setSavedCarousels((prev) => prev.filter((c) => c.id !== id));
    } catch { /* silent */ }
  };

  // ── Load a saved carousel into the viewer ────────────────────────────────

  const loadSaved = (c: SavedCarousel) => {
    setResult({ title: c.title, slides: c.slides, hashtags: c.hashtags, canvaNote: c.canvaNote });
    setTopic(c.topic);
    setCarouselType((c.carouselType as CarouselType) || "educational");
    setShowSaved(false);
  };

  // ── Use an idea as topic ─────────────────────────────────────────────────

  const useIdea = (idea: CarouselIdea) => {
    setTopic(idea.title);
    setShowIdeas(false);
  };

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await authFetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          audience: audience.trim() || undefined,
          goal: goal.trim() || undefined,
          cta: cta.trim() || undefined,
          keywords: keywords.trim() || undefined,
          tone,
          slideCount,
          carouselType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data.carousel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.slides.map((s, i) =>
      `--- Slide ${i + 1} (${s.role}) ---\n${s.headline ? s.headline + "\n" : ""}${s.body}`
    ).join("\n\n") + (result.hashtags?.length ? `\n\n${result.hashtags.map(h => `#${h.replace(/^#/, "")}`).join(" ")}` : "");
    navigator.clipboard.writeText(text);
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
            <Layers className="h-5 w-5 text-brand-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Carousel Creator</h1>
        </div>
        <p className="text-gray-500 ml-12">
          AI-written slide sequences — reads your vault, company voice, and lessons
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── Left: Brief ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Carousel type */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-gray-800">Carousel Type</p>
            <div className="grid grid-cols-2 gap-2">
              {CAROUSEL_TYPES.map(({ key, label, icon: Icon, desc }) => (
                <button
                  key={key}
                  onClick={() => setCarouselType(key)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                    carouselType === key
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${carouselType === key ? "text-brand-600" : "text-gray-400"}`} />
                  <span className={`text-xs font-semibold ${carouselType === key ? "text-brand-700" : "text-gray-700"}`}>{label}</span>
                  <span className="text-[10px] text-gray-400 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brief */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-800">Content Brief</p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Topic <span className="text-red-500">*</span></label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 5 reasons most startups fail in year one"
                rows={3}
                className={inputCls + " resize-none"}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Target Audience</label>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Early-stage founders" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Goal</label>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Drive profile visits, build authority" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Call to Action (final slide)</label>
              <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="e.g. Follow for more, DM us, Book a call" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Keywords / Hashtags</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. #startup #founder growth" className={inputCls} />
            </div>
          </div>

          {/* Tone + Slide count */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">Tone</label>
                <span className="text-xs font-semibold text-brand-600">{TONE_LABELS[tone]}</span>
              </div>
              <input
                type="range" min={0} max={4} value={tone}
                onChange={(e) => setTone(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Formal</span><span>Balanced</span><span>Casual</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">Slide Count</label>
                <span className="text-xs font-semibold text-brand-600">{SLIDE_COUNTS[slideCount]}</span>
              </div>
              <input
                type="range" min={0} max={4} value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>5</span><span>7</span><span>10</span><span>12</span><span>15</span>
              </div>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || !topic.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating carousel…" : "Generate Carousel"}
          </button>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Carousel Ideas from Ideas page */}
          {carouselIdeas.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
              <button
                onClick={() => setShowIdeas(v => !v)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-orange-500" />
                  Carousel Ideas ({carouselIdeas.length})
                </span>
                {showIdeas ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {showIdeas && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {carouselIdeas.map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => useIdea(idea)}
                      className="w-full text-left rounded-lg border border-orange-200 bg-white px-3 py-2 hover:bg-orange-50 transition-colors"
                    >
                      <p className="text-xs font-semibold text-gray-800 line-clamp-2">{idea.title}</p>
                      {idea.summary && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{idea.summary}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Saved Carousels */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <button
              onClick={() => setShowSaved(v => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-brand-600" />
                Saved Carousels {!loadingSaved && `(${savedCarousels.length})`}
              </span>
              {showSaved ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            {showSaved && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                {loadingSaved ? (
                  <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" /></div>
                ) : savedCarousels.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No saved carousels yet</p>
                ) : (
                  savedCarousels.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors">
                      <button onClick={() => loadSaved(c)} className="flex-1 text-left min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{c.title}</p>
                        <p className="text-[10px] text-gray-400">{c.slides?.length ?? 0} slides · {new Date(c.createdAt).toLocaleDateString()}</p>
                      </button>
                      <button onClick={() => handleDeleteSaved(c.id)} className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Output ── */}
        <div className="lg:col-span-3">
          {!result && !loading && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-400">Your carousel slides will appear here</p>
              <p className="mt-1 text-xs text-gray-300">Fill in the brief and click Generate</p>
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand-400" />
              <p className="text-sm text-gray-500">Writing your carousel…</p>
              <p className="mt-1 text-xs text-gray-400">Reading vault, voice, and lessons</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Result header */}
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{result.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{result.slides?.length ?? 0} slides · {CAROUSEL_TYPES.find(t => t.key === carouselType)?.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  {savedMsg && (
                    <span className={`text-xs font-medium ${savedMsg.includes("saved") ? "text-green-600" : "text-red-500"}`}>
                      {savedMsg}
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </button>
                  <button
                    onClick={() => setAllDesignNotes(v => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    title="Toggle all design notes"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    {allDesignNotes ? "Hide Notes" : "Design Notes"}
                  </button>
                  <button
                    onClick={copyAll}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy All
                  </button>
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                </div>
              </div>

              {/* Slides */}
              <div className="space-y-3">
                {(result.slides ?? []).map((slide, i) => (
                  <SlideCard key={i} slide={slide} index={i} />
                ))}
              </div>

              {/* Hashtags */}
              {result.hashtags && result.hashtags.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <p className="mb-2 text-xs font-semibold text-gray-600">Suggested Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.hashtags.map((tag, i) => (
                      <span key={i} className="rounded-full bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        #{tag.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Canva overall note */}
              {result.canvaNote && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" /> Canva Design Tip
                  </p>
                  <p className="text-xs text-amber-800">{result.canvaNote}</p>
                </div>
              )}

              {/* Export hint */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-start gap-3">
                <Download className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500">
                  Copy each slide's text into your Canva template. Use the design notes as layout guidance for each frame.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
