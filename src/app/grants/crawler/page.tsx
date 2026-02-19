"use client";

import { useState, useMemo } from "react";
import {
  Globe, Link, Loader2, Plus, ExternalLink, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, BadgeCheck,
  Rss, Search, Filter, Info, Zap,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { useGrants } from "@/hooks/useGrants";
import {
  KNOWN_GRANT_SITES, GRANT_SITE_CATEGORIES, GRANT_SITE_REGIONS, type GrantSite,
} from "@/lib/grantSites";
import { authFetch } from "@/lib/authFetch";

interface CrawledGrant {
  name: string;
  founder: string;
  url: string;
  deadlineDate?: string | null;
  geographicScope?: string;
  amount?: string;
  eligibility?: string;
  howToApply?: string;
  projectDuration?: string;
  submissionEffort?: "Low" | "Medium" | "High";
  confidence?: "High" | "Medium" | "Low";
}

const CONFIDENCE_STYLES: Record<string, string> = {
  High:   "bg-green-100 text-green-700 border-green-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Low:    "bg-gray-100 text-gray-500 border-gray-300",
};

const EFFORT_STYLES: Record<string, string> = {
  Low:    "bg-blue-50 text-blue-700",
  Medium: "bg-orange-50 text-orange-700",
  High:   "bg-red-50 text-red-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  Business: "bg-blue-50 text-blue-700 border-blue-200",
  Research: "bg-purple-50 text-purple-700 border-purple-200",
  "Health & Medical": "bg-red-50 text-red-700 border-red-200",
  "Arts & Culture": "bg-pink-50 text-pink-700 border-pink-200",
  Innovation: "bg-teal-50 text-teal-700 border-teal-200",
  Government: "bg-gray-100 text-gray-700 border-gray-300",
  Philanthropy: "bg-amber-50 text-amber-700 border-amber-200",
  "International Development": "bg-green-50 text-green-700 border-green-200",
};

function EffortBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_STYLES[value] ?? ""}`}>{value} effort</span>;
}

function CategoryBadge({ cat }: { cat: string }) {
  const cls = CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{cat}</span>;
}

export default function GrantCrawlerPage() {
  const { grants, addGrant } = useGrants();
  const existingNames = new Set(grants.map((g) => g.name.toLowerCase()));

  // Filters
  const [regionFilter, setRegionFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [siteSearch, setSiteSearch] = useState("");

  // Crawl state
  const [customUrl, setCustomUrl] = useState("");
  const [extractionHint, setExtractionHint] = useState("");
  const [crawling, setCrawling] = useState<string | null>(null);
  const [results, setResults] = useState<CrawledGrant[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [jsWarning, setJsWarning] = useState<string | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [htmlLength, setHtmlLength] = useState(0);
  const [lastCrawledSite, setLastCrawledSite] = useState<string>("");

  // Add state
  const [adding, setAdding] = useState<Record<number, boolean>>({});
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const filteredSites = useMemo(() => {
    return KNOWN_GRANT_SITES.filter((s) => {
      if (regionFilter !== "All" && s.region !== regionFilter) return false;
      if (categoryFilter !== "All" && s.category !== categoryFilter) return false;
      if (siteSearch && !s.name.toLowerCase().includes(siteSearch.toLowerCase()) &&
          !s.description.toLowerCase().includes(siteSearch.toLowerCase())) return false;
      return true;
    });
  }, [regionFilter, categoryFilter, siteSearch]);

  const crawl = async (url: string, siteName?: string, siteId?: string) => {
    setCrawling(url);
    setCrawlError(null);
    setJsWarning(null);
    setResults([]);
    setPageTitle("");
    setIsPartial(false);
    setHtmlLength(0);
    setAdded({});
    setLastCrawledSite(siteName || url);
    try {
      const res = await authFetch("/api/grants/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          siteName,
          siteId,
          extractionHint: extractionHint || undefined,
        }),
      });
      const data = await res.json();
      if (data.jsWarning) setJsWarning(data.jsWarning);
      if (data.error) {
        setCrawlError(data.error);
        setIsPartial(data.partial ?? false);
      }
      if (data.grants?.length) {
        setResults(data.grants);
        setPageTitle(data.pageTitle ?? siteName ?? url);
        setHtmlLength(data.htmlLength ?? 0);
      }
    } catch {
      setCrawlError("Network error — could not reach the page.");
    } finally {
      setCrawling(null);
    }
  };

  const handleAdd = async (grant: CrawledGrant, idx: number) => {
    setAdding((p) => ({ ...p, [idx]: true }));
    setAddError(null);
    try {
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          name: grant.name,
          founder: grant.founder,
          url: grant.url,
          deadlineDate: grant.deadlineDate || null,
          geographicScope: grant.geographicScope || null,
          amount: grant.amount || null,
          eligibility: grant.eligibility || null,
          howToApply: grant.howToApply || null,
          projectDuration: grant.projectDuration || null,
          submissionEffort: grant.submissionEffort || null,
          decision: "Maybe",
        }),
      });
      const data = await res.json();
      if (data.success) {
        addGrant(data.grant);
        setAdded((p) => ({ ...p, [idx]: true }));
      } else setAddError(data.error || "Failed to add");
    } catch { setAddError("Network error"); }
    finally { setAdding((p) => ({ ...p, [idx]: false })); }
  };

  const handleAddAll = async () => {
    const toAdd = results
      .map((g, i) => ({ g, i }))
      .filter(({ g, i }) => !added[i] && !existingNames.has(g.name.toLowerCase()));
    for (const { g, i } of toAdd) await handleAdd(g, i);
  };

  const isCrawling = crawling !== null;
  const newCount = results.filter((g, i) => !added[i] && !existingNames.has(g.name.toLowerCase())).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
            <Rss className="h-5 w-5 text-brand-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Grant Crawler</h1>
        </div>
        <p className="text-gray-500 ml-12">
          Scrape grant listing sites — AI extracts up to 30 opportunities and adds them to your list
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Custom URL */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Link className="h-4 w-4 text-brand-500" /> Custom URL
            </h2>
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && customUrl.trim() && crawl(customUrl.trim())}
              placeholder="https://example.com/grants"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-2">
              <label className="mb-1 block text-xs text-gray-500">Extraction hint (optional)</label>
              <input
                value={extractionHint}
                onChange={(e) => setExtractionHint(e.target.value)}
                placeholder="e.g. focus on health grants, ignore news"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button
              onClick={() => customUrl.trim() && crawl(customUrl.trim())}
              disabled={!customUrl.trim() || isCrawling}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isCrawling && crawling === customUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Crawl This URL
            </button>
          </div>

          {/* Known sites with filters */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Globe className="h-4 w-4 text-brand-500" /> Grant Sites
              <span className="ml-auto text-xs font-normal text-gray-400">{filteredSites.length} sites</span>
            </h2>

            {/* Filters */}
            <div className="mb-3 space-y-2">
              <input
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                placeholder="Search sites…"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
                >
                  {GRANT_SITE_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
                >
                  {GRANT_SITE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredSites.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">No sites match your filters</p>
              ) : filteredSites.map((site: GrantSite) => (
                <div key={site.id} className={`rounded-lg border p-3 transition-colors ${site.jsHeavy ? "border-amber-100 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{site.name}</p>
                        {site.jsHeavy && (
                          <span title="May require browser — limited results possible" className="text-amber-500">
                            <Info className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{site.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">{site.region}</span>
                        <CategoryBadge cat={site.category} />
                      </div>
                    </div>
                    <button
                      onClick={() => crawl(site.url, site.name, site.id)}
                      disabled={isCrawling}
                      title="Crawl this site"
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-40"
                    >
                      {isCrawling && crawling === site.url
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Zap className="h-3.5 w-3.5" />}
                      Crawl
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {/* JS Warning */}
          {jsWarning && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-800">{jsWarning}</p>
            </div>
          )}

          {/* Crawling status */}
          {isCrawling && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              <div>
                <p className="text-sm font-medium text-brand-800">Crawling page…</p>
                <p className="text-xs text-brand-600 mt-0.5 truncate max-w-sm">{crawling}</p>
                <p className="text-xs text-brand-400 mt-0.5">Fetching HTML → stripping → AI extraction (up to 20s)</p>
              </div>
            </div>
          )}

          {/* Error */}
          {crawlError && (
            <div className={`mb-4 rounded-xl border px-4 py-3 ${isPartial ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${isPartial ? "text-amber-500" : "text-red-500"}`} />
                <div>
                  <p className={`text-sm font-medium ${isPartial ? "text-amber-800" : "text-red-800"}`}>
                    {isPartial ? "Partial result" : "Crawl failed"}
                  </p>
                  <p className={`text-xs mt-0.5 ${isPartial ? "text-amber-700" : "text-red-700"}`}>{crawlError}</p>
                  {isPartial && (
                    <p className="text-xs mt-1.5 text-amber-600">
                      💡 <strong>Tip:</strong> Try a more specific URL (e.g. a search results page), or use the extraction hint to focus on a topic.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isCrawling && results.length === 0 && !crawlError && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-24 text-center">
              <Rss className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">Select a site or enter a URL to start crawling</p>
              <p className="text-xs text-gray-300 mt-1">AI extracts up to 30 grant listings from the page</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {results.length} grant{results.length !== 1 ? "s" : ""} found
                    {newCount > 0 && <span className="ml-2 text-brand-600">· {newCount} new</span>}
                  </p>
                  {pageTitle && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{pageTitle}</p>}
                  {htmlLength > 0 && <p className="text-xs text-gray-300 mt-0.5">{htmlLength.toLocaleString()} chars parsed</p>}
                </div>
                <div className="flex gap-2">
                  {newCount > 0 && (
                    <button
                      onClick={handleAddAll}
                      disabled={isCrawling}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add All {newCount} New
                    </button>
                  )}
                  <button
                    onClick={() => crawl(lastCrawledSite.startsWith("http") ? lastCrawledSite : customUrl, lastCrawledSite)}
                    disabled={isCrawling || !lastCrawledSite}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Search className="h-3.5 w-3.5" /> Re-crawl
                  </button>
                </div>
              </div>

              {addError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}

              <div className="space-y-2">
                {results.map((grant, idx) => {
                  const alreadyInList = existingNames.has(grant.name.toLowerCase());
                  const isAdded = added[idx] || alreadyInList;
                  const isExpanded = expandedIdx === idx;
                  const confidenceCls = CONFIDENCE_STYLES[grant.confidence ?? "Low"] ?? CONFIDENCE_STYLES.Low;

                  return (
                    <div key={idx} className={`rounded-xl border transition-colors ${isAdded ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-start gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900">{grant.name}</p>
                            {grant.confidence && (
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceCls}`}>
                                {grant.confidence}
                              </span>
                            )}
                            {alreadyInList && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Already saved</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{grant.founder}</p>
                          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-500">
                            {grant.geographicScope && (
                              <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{grant.geographicScope}</span>
                            )}
                            {grant.amount && <span className="font-semibold text-gray-800">{grant.amount}</span>}
                            {grant.deadlineDate && (
                              <span className="text-orange-600">
                                Deadline: {new Date(grant.deadlineDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                            {grant.submissionEffort && <EffortBadge value={grant.submissionEffort} />}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {grant.url && (
                            <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700" title="Open URL">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => !isAdded && handleAdd(grant, idx)}
                            disabled={isAdded || adding[idx]}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              isAdded
                                ? "bg-green-100 text-green-700 cursor-default"
                                : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                            }`}
                          >
                            {adding[idx]
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : isAdded
                              ? <BadgeCheck className="h-3.5 w-3.5" />
                              : <Plus className="h-3.5 w-3.5" />}
                            {isAdded ? "Added" : "Add"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 pb-4 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-gray-600">
                          {grant.eligibility && (
                            <div>
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Eligibility</p>
                              <p className="whitespace-pre-wrap">{grant.eligibility}</p>
                            </div>
                          )}
                          {grant.howToApply && (
                            <div>
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">How to Apply</p>
                              <p className="whitespace-pre-wrap">{grant.howToApply}</p>
                            </div>
                          )}
                          {grant.projectDuration && (
                            <div>
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">Project Duration</p>
                              <p>{grant.projectDuration}</p>
                            </div>
                          )}
                          {grant.url && (
                            <div className="sm:col-span-2">
                              <p className="font-semibold text-gray-400 uppercase tracking-wide mb-1">URL</p>
                              <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all">{grant.url}</a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
