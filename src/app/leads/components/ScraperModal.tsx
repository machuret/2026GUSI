"use client";

import { useMemo, useState } from "react";
import { X, Zap, Loader2, Globe, AlertCircle, Plus } from "lucide-react";
import { DEMO_COMPANY_ID } from "@/lib/constants";
import { SCRAPE_SOURCES, type ScrapeSrc } from "@/lib/leadSources";
import type { Lead } from "@/hooks/useLeads";
import { TagInput } from "./TagInput";

const SOURCES = SCRAPE_SOURCES;
const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

const PHASE_LABELS: Record<string, string> = {
  starting: "Starting Apify actor…",
  running:  "Actor running — collecting profiles…",
  fetching: "Downloading results…",
  done:     "Done",
};

interface Props {
  onClose: () => void;
  onImported: (leads: Lead[]) => void;
}

export function ScraperModal({ onClose, onImported }: Props) {
  const [selectedSource, setSelectedSource] = useState<ScrapeSrc>(SOURCES[0]);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [runPhase, setRunPhase] = useState<"idle" | "starting" | "running" | "fetching" | "done">("idle");
  const [partialCount, setPartialCount] = useState(0);
  const [results, setResults] = useState<Partial<Lead>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [backgroundRunId, setBackgroundRunId] = useState<string | null>(null);
  const [backgroundDatasetId, setBackgroundDatasetId] = useState<string | null>(null);
  const [backgroundSourceId, setBackgroundSourceId] = useState<string | null>(null);

  const setField = (key: string, value: unknown) => setFields((p) => ({ ...p, [key]: value }));

  const urlPreview = useMemo(() => {
    if (selectedSource.id === "doctolib") {
      const specialty = (fields.specialty as string) || "medecin-generaliste";
      const city = ((fields.city as string) || "paris").toLowerCase().replace(/\s+/g, "-");
      return `doctolib.fr/${specialty}/${city}`;
    }
    if (selectedSource.id === "webmd") {
      const q = (fields.specialty as string) || "doctor";
      const city = (fields.city as string) || "";
      const state = (fields.state as string) || "";
      return `doctor.webmd.com/results?q=${q}${city ? `&city=${city}` : ""}${state ? `&state=${state}` : ""}`;
    }
    return null;
  }, [selectedSource.id, fields]);

  const pollUntilDone = async (runId: string, datasetId: string, sourceId: string) => {
    let attempts = 0;
    while (attempts < 120) {
      await new Promise((r) => setTimeout(r, 3000));
      attempts++;
      try {
        const pollRes = await fetch(
          `/api/leads/scrape?runId=${runId}&datasetId=${datasetId}&sourceId=${encodeURIComponent(sourceId)}`
        );
        const pollData = await pollRes.json();
        if (pollData.error) { setError(`Scraper failed: ${pollData.error}`); return; }
        if (pollData.partialCount) setPartialCount(pollData.partialCount);
        if (pollData.running) continue;
        setRunPhase("fetching");
        setResults(pollData.leads ?? []);
        setPartialCount(pollData.leads?.length ?? 0);
        setRunPhase("done");
        setBackgroundRunId(null);
        return;
      } catch { /* network blip — keep polling */ }
    }
    setError("Timed out after 6 minutes — check your Apify console for results.");
  };

  const handleRun = async () => {
    setRunning(true); setError(null); setResults([]); setImported(false);
    setRunPhase("starting"); setElapsed(0); setPartialCount(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const startRes = await fetch("/api/leads/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: selectedSource.id, inputFields: fields }),
      });
      const startData = await startRes.json();
      if (startData.error) { setError(startData.error); return; }

      const { runId, datasetId, sourceId } = startData;
      setRunPhase("running");
      setBackgroundRunId(runId);
      setBackgroundDatasetId(datasetId);
      setBackgroundSourceId(sourceId);
      await pollUntilDone(runId, datasetId, sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — could not reach server");
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  };

  const handleResumeBackground = async () => {
    if (!backgroundRunId || !backgroundDatasetId || !backgroundSourceId) return;
    setRunning(true); setRunPhase("running"); setError(null);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      await pollUntilDone(backgroundRunId, backgroundDatasetId, backgroundSourceId);
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  };

  const handleImport = async () => {
    if (!results.length) return;
    setImporting(true);
    try {
      const leads = results.map((r) => ({ ...r, companyId: DEMO_COMPANY_ID, status: "new" }));
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (data.success) { onImported(data.leads ?? []); setImported(true); }
      else setError(data.error || "Import failed — please try again");
    } catch { setError("Network error — could not reach server"); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand-500" /> Lead Scraper
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Powered by Apify — configure, scrape, preview, then import</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Source selector */}
          <div>
            <label className={labelCls}>Data Source</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SOURCES.map((src) => (
                <button key={src.id}
                  onClick={() => { setSelectedSource(src); setFields({}); setResults([]); setError(null); setRunPhase("idle"); }}
                  className={`rounded-xl border p-3 text-left transition-colors ${selectedSource.id === src.id ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-brand-200"}`}
                >
                  <p className="text-sm font-semibold text-gray-800">{src.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{src.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic input fields */}
          <div className="space-y-3">
            {selectedSource.inputFields.map((f) => (
              <div key={f.key}>
                <label className={labelCls}>{f.label}</label>
                {f.type === "number" ? (
                  <input type="number" min={f.min} max={f.max}
                    value={(fields[f.key] as number) ?? f.default ?? ""}
                    onChange={(e) => setField(f.key, parseInt(e.target.value))}
                    className={inputCls} />
                ) : f.type === "select" ? (
                  <select value={(fields[f.key] as string) ?? ""} onChange={(e) => setField(f.key, e.target.value)} className={inputCls}>
                    <option value="">{f.placeholder ?? "Select…"}</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "tags" ? (
                  <TagInput
                    tags={Array.isArray(fields[f.key]) ? (fields[f.key] as string[]) : []}
                    onChange={(tags) => setField(f.key, tags)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <input type="text" value={(fields[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={inputCls} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>

          {urlPreview && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500">
              <Globe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>Will scrape: <span className="font-mono text-gray-700">{urlPreview}</span></span>
            </div>
          )}

          {running && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-brand-800">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {PHASE_LABELS[runPhase] ?? "Running…"}
                </span>
                <span className="text-xs text-brand-500">{elapsed}s elapsed</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-brand-200 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-1000"
                  style={{ width: runPhase === "starting" ? "10%" : runPhase === "running" ? `${Math.min(85, 10 + elapsed * 0.8)}%` : runPhase === "fetching" ? "95%" : "100%" }} />
              </div>
              <div className="flex items-center justify-between">
                {partialCount > 0
                  ? <p className="text-xs text-brand-700 font-medium">✓ {partialCount} contacts scraped so far…</p>
                  : <p className="text-xs text-brand-600">Waiting for first results…</p>
                }
                <button
                  onClick={onClose}
                  className="text-xs text-brand-500 hover:text-brand-700 underline"
                >
                  Run in background
                </button>
              </div>
            </div>
          )}

          {/* Resume banner when returning to modal with a background run */}
          {!running && backgroundRunId && runPhase !== "done" && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <span>Scraper is still running in background</span>
              </div>
              <button
                onClick={handleResumeBackground}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                Check results
              </button>
            </div>
          )}

          {runPhase !== "done" && (
            <button onClick={handleRun} disabled={running}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {running ? "Scraping…" : "Run Scraper"}
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{results.length} leads found — preview</p>
                <button onClick={handleImport} disabled={importing || imported}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${imported ? "bg-green-100 text-green-700 cursor-default" : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"}`}>
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {imported ? `✓ Imported ${results.length}` : `Import All ${results.length}`}
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {results.slice(0, 20).map((r, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-medium text-gray-800">{r.fullName || "—"}</p>
                    <p className="text-xs text-gray-500">{[r.jobTitle, r.company, r.location].filter(Boolean).join(" · ")}</p>
                    {r.specialties?.length ? <p className="text-xs text-brand-600 mt-0.5">{r.specialties.slice(0, 3).join(", ")}</p> : null}
                  </div>
                ))}
                {results.length > 20 && <p className="text-xs text-center text-gray-400">+{results.length - 20} more</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
