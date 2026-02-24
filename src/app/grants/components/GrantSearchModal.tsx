"use client";

import { useState } from "react";
import {
  Search, Loader2, X, Plus, ExternalLink, Globe, Calendar, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, ShieldAlert, BadgeCheck,
} from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { authFetch } from "@/lib/authFetch";
import type { Grant } from "@/hooks/useGrants";
import {
  type SearchResult,
  GEO_SCOPES, ORG_TYPES, FUNDING_SIZES, DEADLINE_URGENCIES,
  ELIGIBILITY_TYPES, GRANT_TYPES, APPLICANT_COUNTRIES,
  CONFIDENCE_STYLES, inputCls, labelCls,
} from "./grantTypes";
import { EffortBadge } from "./GrantBadges";
import { fuzzyMatchesExisting } from "@/lib/fuzzyMatch";

interface Props {
  onClose: () => void;
  onAdded: (g: Grant) => void;
  companyDNA: string;
  existingNames: Set<string>;
}

export function GrantSearchModal({ onClose, onAdded, companyDNA, existingNames }: Props) {
  const [query, setQuery] = useState("");
  const [geographicScope, setGeographicScope] = useState("");
  const [applicantCountry, setApplicantCountry] = useState("");
  const [orgType, setOrgType] = useState("");
  const [fundingSize, setFundingSize] = useState("");
  const [deadlineUrgency, setDeadlineUrgency] = useState("");
  const [eligibilityType, setEligibilityType] = useState("");
  const [grantType, setGrantType] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchPhase, setSearchPhase] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<number, boolean>>({});
  const [added, setAdded] = useState<Record<number, boolean>>({});

  const activeFilterCount = [geographicScope, applicantCountry, orgType, fundingSize, deadlineUrgency, eligibilityType, grantType].filter(Boolean).length;

  const handleSearch = async () => {
    if (!query.trim() && !grantType && !orgType && !geographicScope) {
      setError("Enter a keyword, grant type, org type, or region to search");
      return;
    }
    setSearching(true); setError(null); setResults([]); setNewCount(0);
    setSearchPhase("Asking AI to find matching grants…");
    try {
      const res = await authFetch("/api/grants/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query || undefined,
          geographicScope: geographicScope || undefined,
          applicantCountry: applicantCountry || undefined,
          orgType: orgType || undefined,
          fundingSize: fundingSize || undefined,
          deadlineUrgency: deadlineUrgency || undefined,
          eligibilityType: eligibilityType || undefined,
          grantType: grantType || undefined,
          companyDNA,
          existingNames: Array.from(existingNames),
        }),
      });
      setSearchPhase("Filtering results…");
      const data = await res.json();
      if (data.success) {
        const fresh = (data.results ?? []) as SearchResult[];
        setResults(fresh);
        setNewCount(fresh.filter((r) => !fuzzyMatchesExisting(r.name, existingNames)).length);
      } else setError(data.error || "Search failed");
    } catch (err) { setError(err instanceof Error ? err.message : "Network error"); }
    finally { setSearching(false); setSearchPhase(""); }
  };

  const handleAdd = async (result: SearchResult, idx: number) => {
    setAdding((p) => ({ ...p, [idx]: true }));
    try {
      const res = await authFetch("/api/grants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: DEMO_COMPANY_ID,
          name: result.name, founder: result.founder, url: result.url,
          deadlineDate: result.deadlineDate || null,
          geographicScope: result.geographicScope || null,
          amount: result.amount || null,
          eligibility: result.eligibility || null,
          howToApply: result.howToApply || null,
          projectDuration: result.projectDuration || null,
          submissionEffort: result.submissionEffort || null,
          decision: "Maybe",
          notes: result.fitReason ? `AI search note: ${result.fitReason}` : null,
        }),
      });
      const data = await res.json();
      if (data.success) { onAdded(data.grant); setAdded((p) => ({ ...p, [idx]: true })); }
      else setError(data.error || "Failed to add");
    } catch { setError("Network error"); }
    finally { setAdding((p) => ({ ...p, [idx]: false })); }
  };

  const sel = (value: string, onChange: (v: string) => void, placeholder: string, options: string[]) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Grant Search</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered discovery — the more filters you set, the better the results</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="border-b border-gray-100 px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className={labelCls}>Keywords / Topic</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className={inputCls} placeholder="e.g. women founders, climate tech, digital health…" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Grant Type</label>{sel(grantType, setGrantType, "Any grant type", GRANT_TYPES)}</div>
            <div><label className={labelCls}>Our Organisation Type</label>{sel(orgType, setOrgType, "Any org type", ORG_TYPES)}</div>
          </div>

          <button onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Advanced filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">{activeFilterCount}</span>
            )}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div><label className={labelCls}>Where the grant funds (scope)</label>{sel(geographicScope, setGeographicScope, "Any region", GEO_SCOPES)}</div>
              <div><label className={labelCls}>Our country (where we are based)</label>{sel(applicantCountry, setApplicantCountry, "Any country", APPLICANT_COUNTRIES)}</div>
              <div><label className={labelCls}>Funding Size</label>{sel(fundingSize, setFundingSize, "Any amount", FUNDING_SIZES)}</div>
              <div><label className={labelCls}>Deadline</label>{sel(deadlineUrgency, setDeadlineUrgency, "Any deadline", DEADLINE_URGENCIES)}</div>
              <div className="sm:col-span-2"><label className={labelCls}>Eligibility</label>{sel(eligibilityType, setEligibilityType, "Any eligibility", ELIGIBILITY_TYPES)}</div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSearch} disabled={searching}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? (searchPhase || "Searching…") : "Search Grants"}
            </button>
            {!companyDNA && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Fill in Company Info for personalised ranking
              </p>
            )}
            {companyDNA && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Company DNA active — results ranked by fit
              </p>
            )}
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {searching && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-400" />
              <p className="text-sm font-medium text-brand-600">{searchPhase || "Searching…"}</p>
              <p className="text-xs text-gray-400 mt-1">This can take 10–20 seconds</p>
            </div>
          )}
          {!searching && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Globe className="h-10 w-10 mb-3" />
              <p className="text-sm text-gray-400">Enter a topic and click Search to discover grants</p>
            </div>
          )}
          {!searching && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{results.length}</span> grant{results.length !== 1 ? "s" : ""} found
                {newCount < results.length && <span className="ml-1 text-amber-600">· {results.length - newCount} already in your list</span>}
                {newCount > 0 && <span className="ml-1 text-green-600">· <strong>{newCount} new</strong></span>}
              </p>
              {results.map((r, idx) => {
                const fuzzyMatch = fuzzyMatchesExisting(r.name, existingNames);
                const alreadyInList = !!fuzzyMatch;
                const isAdded = added[idx] || alreadyInList;
                const confidenceCls = CONFIDENCE_STYLES[r.confidence ?? "Low"] ?? CONFIDENCE_STYLES.Low;
                return (
                  <div key={idx} className={`rounded-xl border p-4 transition-colors ${isAdded ? "border-green-200 bg-green-50" : "border-gray-200 bg-white hover:border-brand-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                          {r.confidence && (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceCls}`}>{r.confidence} confidence</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{r.founder}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {r.geographicScope && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{r.geographicScope}</span>}
                          {r.amount && <span className="font-medium text-gray-700">{r.amount}</span>}
                          {r.deadlineDate && (() => {
                            const dl = new Date(r.deadlineDate);
                            const diff = dl.getTime() - Date.now();
                            const days = Math.ceil(diff / 86400000);
                            const fmtd = dl.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
                            if (days < 0) return (
                              <span className="flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-red-700 font-semibold">
                                <AlertTriangle className="h-3 w-3" /> Expired {fmtd}
                              </span>
                            );
                            if (days <= 14) return (
                              <span className="flex items-center gap-1 rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-orange-700 font-semibold">
                                <Calendar className="h-3 w-3" /> {fmtd} ({days}d left)
                              </span>
                            );
                            return (
                              <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-green-700 font-medium">
                                <Calendar className="h-3 w-3" /> {fmtd}
                              </span>
                            );
                          })()}
                          {!r.deadlineDate && (
                            <span className="flex items-center gap-1 text-gray-400 italic">
                              <Calendar className="h-3 w-3" /> No deadline listed
                            </span>
                          )}
                          {r.submissionEffort && <EffortBadge value={r.submissionEffort} />}
                        </div>
                        {r.fitReason && <p className="mt-2 text-xs text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 border border-brand-100">✦ {r.fitReason}</p>}
                        {r.eligibility && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{r.eligibility}</p>}
                        {alreadyInList && fuzzyMatch && fuzzyMatch.toLowerCase() !== r.name.toLowerCase() && (
                          <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                            Similar to: <span className="font-medium">{fuzzyMatch}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700"><ExternalLink className="h-4 w-4" /></a>}
                        <button onClick={() => !isAdded && handleAdd(r, idx)} disabled={isAdded || adding[idx]}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isAdded ? "bg-green-100 text-green-700 cursor-default" : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"}`}>
                          {adding[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAdded ? <BadgeCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {isAdded ? "Added" : "Add to List"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
