"use client";

import { useState } from "react";
import { Sparkles, Loader2, Send, Eye, EyeOff, RefreshCw, CheckCircle } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { MCAudience } from "./types";

interface Props {
  audiences: MCAudience[];
  connected: boolean;
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "block text-xs font-medium text-gray-700 mb-1.5";

export default function ComposeTab({ audiences, connected }: Props) {
  const [audienceId,   setAudienceId]   = useState(audiences[0]?.id ?? "");
  const [goal,         setGoal]         = useState("");
  const [tone,         setTone]         = useState<"warm" | "formal" | "casual">("warm");
  const [length,       setLength]       = useState<"short" | "medium" | "long">("medium");
  const [extraContext, setExtraContext] = useState("");
  const [fromName,     setFromName]     = useState("");
  const [replyTo,      setReplyTo]      = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const [generating,   setGenerating]   = useState(false);
  const [genError,     setGenError]     = useState<string | null>(null);

  const [subjectLine,  setSubjectLine]  = useState("");
  const [previewText,  setPreviewText]  = useState("");
  const [htmlBody,     setHtmlBody]     = useState("");
  const [showPreview,  setShowPreview]  = useState(false);

  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState<string | null>(null);
  const [sendSuccess,  setSendSuccess]  = useState<string | null>(null);

  const hasContent = subjectLine && htmlBody;

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setGenerating(true); setGenError(null);
    setSubjectLine(""); setPreviewText(""); setHtmlBody(""); setShowPreview(false);
    try {
      const res  = await authFetch("/api/mailchimp/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId, goal, tone, length, extraContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setSubjectLine(data.subjectLine ?? "");
      setPreviewText(data.previewText ?? "");
      setHtmlBody(data.htmlBody ?? "");
      setShowPreview(true);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!hasContent || !audienceId) return;
    setSending(true); setSendError(null); setSendSuccess(null);
    try {
      const res  = await authFetch("/api/mailchimp/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId, subjectLine, htmlBody,
          title:        subjectLine,
          fromName:     fromName  || undefined,
          replyTo:      replyTo   || undefined,
          scheduleTime: scheduleTime || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setSendSuccess(
        data.scheduled
          ? `✓ Campaign scheduled for ${scheduleTime}`
          : "✓ Campaign sent successfully!"
      );
      setSubjectLine(""); setPreviewText(""); setHtmlBody(""); setGoal(""); setShowPreview(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (!connected) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-24 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm font-medium">Connect Mailchimp first</p>
        <p className="text-gray-300 text-xs mt-1">Go to the Connect tab to add your API key.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Left: config */}
      <div className="w-80 shrink-0 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Campaign Setup</h2>

          {/* Audience */}
          <div>
            <label className={labelCls}>Audience</label>
            {audiences.length === 0 ? (
              <p className="text-xs text-amber-600">No audiences synced — go to Connect → Sync Now</p>
            ) : (
              <select value={audienceId} onChange={(e) => setAudienceId(e.target.value)} className={inputCls}>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.memberCount.toLocaleString()} subscribers)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Goal */}
          <div>
            <label className={labelCls}>Campaign goal / brief</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="e.g. Announce our new program launching in March, drive registrations"
              className={inputCls}
            />
          </div>

          {/* Tone */}
          <div>
            <label className={labelCls}>Tone</label>
            <div className="flex gap-2">
              {(["warm", "formal", "casual"] as const).map((t) => (
                <button key={t} onClick={() => setTone(t)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${tone === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Length */}
          <div>
            <label className={labelCls}>Length</label>
            <div className="flex gap-2">
              {(["short", "medium", "long"] as const).map((l) => (
                <button key={l} onClick={() => setLength(l)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${length === l ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {length === "short" ? "~150" : length === "medium" ? "~300" : "~500"} words
            </p>
          </div>

          {/* Extra context */}
          <div>
            <label className={labelCls}>Extra context <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              rows={2}
              placeholder="Specific details, links, dates, offers…"
              className={inputCls}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !goal.trim() || audiences.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Writing campaign…" : "Generate Campaign"}
          </button>

          {genError && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{genError}</p>
          )}
        </div>

        {/* Send settings — only show when content is ready */}
        {hasContent && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Send Settings</h2>
            <div>
              <label className={labelCls}>From name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Organisation" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Reply-to email <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="hello@yourorg.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Schedule time <span className="text-gray-400 font-normal">(leave blank to send now)</span></label>
              <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={inputCls} />
            </div>

            {sendError   && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{sendError}</p>}
            {sendSuccess && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 flex items-center gap-1.5"><CheckCircle className="h-4 w-4" />{sendSuccess}</p>}

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : scheduleTime ? "Schedule Campaign" : "Send Campaign"}
            </button>
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex-1 min-w-0 space-y-4">
        {!hasContent && !generating ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-32 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm font-medium">Your campaign will appear here</p>
            <p className="text-gray-300 text-xs mt-1">Fill in the brief and click Generate Campaign</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Subject + preview text */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div>
                <label className={labelCls}>Subject line</label>
                <input type="text" value={subjectLine} onChange={(e) => setSubjectLine(e.target.value)} className={inputCls} placeholder="Subject line…" />
              </div>
              <div>
                <label className={labelCls}>Preview text</label>
                <input type="text" value={previewText} onChange={(e) => setPreviewText(e.target.value)} className={inputCls} placeholder="Preview / preheader text…" />
              </div>
            </div>

            {/* HTML body */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-800">Email Body</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPreview ? "Edit HTML" : "Preview"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              </div>

              {showPreview ? (
                <div className="p-4 bg-gray-50">
                  <div className="mx-auto max-w-[600px] rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <iframe
                      srcDoc={htmlBody}
                      className="w-full"
                      style={{ height: "600px", border: "none" }}
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={20}
                  className="w-full px-4 py-3 text-xs text-gray-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-200 resize-y"
                  placeholder="HTML email body…"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
