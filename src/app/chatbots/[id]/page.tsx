"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, CheckCircle, ArrowLeft, Copy, Check, MessageSquare, Palette, Bot, Code2 } from "lucide-react";
import Link from "next/link";

interface ChatBot {
  id: string;
  name: string;
  systemPrompt: string;
  widgetTitle: string;
  widgetColor: string;
  avatarEmoji: string;
  welcomeMessage: string;
  apiKey: string;
  active: boolean;
  widgetPosition: "bottom-right" | "bottom-left";
  widgetBorderRadius: number;
  widgetFontSize: number;
  headerTextColor: string;
  botBubbleColor: string;
  botTextColor: string;
  userBubbleColor: string;
  userTextColor: string;
  showBranding: boolean;
  placeholderText: string;
  windowHeight: number;
  windowWidth: number;
}

const DEFAULTS: Partial<ChatBot> = {
  widgetPosition: "bottom-right",
  widgetBorderRadius: 16,
  widgetFontSize: 14,
  headerTextColor: "#ffffff",
  botBubbleColor: "#f3f4f6",
  botTextColor: "#111111",
  userBubbleColor: "",
  userTextColor: "#ffffff",
  showBranding: true,
  placeholderText: "Type a message…",
  windowHeight: 520,
  windowWidth: 360,
};

type Tab = "identity" | "widget" | "ai" | "embed";

export default function ChatbotSettingsPage({ params }: { params: { id: string } }) {
  const [bot, setBot] = useState<ChatBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("identity");
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedIframe, setCopiedIframe] = useState(false);

  useEffect(() => {
    fetch(`/api/chatbots/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.bot) setBot({ ...DEFAULTS, ...d.bot } as ChatBot); })
      .finally(() => setLoading(false));
  }, [params.id]);

  const set = (key: keyof ChatBot, value: unknown) =>
    setBot((b) => b ? { ...b, [key]: value } : b);

  const handleSave = async () => {
    if (!bot) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/chatbots/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bot),
      });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";

  const scriptSnippet = `<!-- Paste before </body> in WordPress -->
<script>
  window.GUSIChat = { botId: "${params.id}" };
</script>
<script src="${origin}/api/chatbots/${params.id}/widget.js" async></script>`;

  const iframeSnippet = `<!-- Inline iframe embed -->
<iframe
  src="${origin}/chatbots/${params.id}/preview"
  width="${bot?.windowWidth ?? 360}"
  height="${bot?.windowHeight ?? 520}"
  frameborder="0"
  style="border-radius:${bot?.widgetBorderRadius ?? 16}px; box-shadow:0 4px 24px rgba(0,0,0,0.15);"
></iframe>`;

  const copy = (text: string, which: "script" | "iframe") => {
    navigator.clipboard.writeText(text);
    if (which === "script") { setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }
    else { setCopiedIframe(true); setTimeout(() => setCopiedIframe(false), 2000); }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const labelCls = "mb-1 block text-xs font-medium text-gray-700";

  const ColorField = ({ label, field }: { label: string; field: keyof ChatBot }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={(bot?.[field] as string) || "#ffffff"}
          onChange={(e) => set(field, e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-gray-300 p-0.5" />
        <input className={inputCls} value={(bot?.[field] as string) || ""}
          onChange={(e) => set(field, e.target.value)} placeholder="#rrggbb" />
      </div>
    </div>
  );

  const Toggle = ({ label, desc, field }: { label: string; desc?: string; field: keyof ChatBot }) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-500">{desc}</p>}
      </div>
      <div onClick={() => set(field, !bot?.[field])}
        className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${bot?.[field] ? "bg-brand-600" : "bg-gray-300"}`}>
        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${bot?.[field] ? "translate-x-6" : "translate-x-1"}`} />
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>;
  if (!bot) return <div className="py-32 text-center text-gray-400">Bot not found</div>;

  const userBubble = bot.userBubbleColor || bot.widgetColor;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "identity", label: "Identity", icon: Bot },
    { id: "widget",   label: "Widget",   icon: Palette },
    { id: "ai",       label: "AI",       icon: MessageSquare },
    { id: "embed",    label: "Embed",    icon: Code2 },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/chatbots" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{bot.name}</h1>
          <p className="text-sm text-gray-500">Chatbot settings</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── IDENTITY TAB ── */}
      {tab === "identity" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Bot Identity</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Bot Name</label>
                <input className={inputCls} value={bot.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Widget Title (shown in header)</label>
                <input className={inputCls} value={bot.widgetTitle} onChange={(e) => set("widgetTitle", e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>Welcome Message (first message visitors see)</label>
              <textarea rows={2} className={inputCls} value={bot.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Input Placeholder Text</label>
              <input className={inputCls} value={bot.placeholderText} onChange={(e) => set("placeholderText", e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <Toggle label="Bot Active" desc="Inactive bots will not respond to visitors" field="active" />
          </div>
        </div>
      )}

      {/* ── WIDGET TAB ── */}
      {tab === "widget" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Controls */}
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Colors</h2>
              <div className="grid grid-cols-2 gap-4">
                <ColorField label="Primary / Header Color" field="widgetColor" />
                <ColorField label="Header Text Color" field="headerTextColor" />
                <ColorField label="Bot Bubble Color" field="botBubbleColor" />
                <ColorField label="Bot Text Color" field="botTextColor" />
                <ColorField label="User Bubble Color" field="userBubbleColor" />
                <ColorField label="User Text Color" field="userTextColor" />
              </div>
              <p className="mt-2 text-xs text-gray-400">User Bubble Color defaults to Primary Color if left empty.</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Avatar & Position</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Avatar Emoji</label>
                  <input className={inputCls} value={bot.avatarEmoji} onChange={(e) => set("avatarEmoji", e.target.value)} maxLength={2} placeholder="🤖" />
                </div>
                <div>
                  <label className={labelCls}>Widget Position</label>
                  <select className={inputCls} value={bot.widgetPosition} onChange={(e) => set("widgetPosition", e.target.value)}>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Shape & Size</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Border Radius: {bot.widgetBorderRadius}px</label>
                  <input type="range" min={0} max={24} value={bot.widgetBorderRadius}
                    onChange={(e) => set("widgetBorderRadius", parseInt(e.target.value))} className="w-full accent-brand-600" />
                  <div className="flex justify-between text-xs text-gray-400"><span>Square (0)</span><span>Rounded (24)</span></div>
                </div>
                <div>
                  <label className={labelCls}>Font Size: {bot.widgetFontSize}px</label>
                  <input type="range" min={12} max={18} value={bot.widgetFontSize}
                    onChange={(e) => set("widgetFontSize", parseInt(e.target.value))} className="w-full accent-brand-600" />
                  <div className="flex justify-between text-xs text-gray-400"><span>Small (12)</span><span>Large (18)</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Width: {bot.windowWidth}px</label>
                    <input type="range" min={300} max={480} step={10} value={bot.windowWidth}
                      onChange={(e) => set("windowWidth", parseInt(e.target.value))} className="w-full accent-brand-600" />
                  </div>
                  <div>
                    <label className={labelCls}>Height: {bot.windowHeight}px</label>
                    <input type="range" min={400} max={700} step={10} value={bot.windowHeight}
                      onChange={(e) => set("windowHeight", parseInt(e.target.value))} className="w-full accent-brand-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <Toggle label="Show 'Powered by GUSI' branding" field="showBranding" />
            </div>
          </div>

          {/* Live Preview */}
          <div className="sticky top-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Live Preview</p>
            <div style={{
              width: Math.min(bot.windowWidth, 400),
              height: bot.windowHeight,
              borderRadius: bot.widgetBorderRadius,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: bot.widgetFontSize,
              display: "flex",
              flexDirection: "column",
              border: "1px solid #e5e7eb",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ background: bot.widgetColor, color: bot.headerTextColor, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 22 }}>{bot.avatarEmoji}</span>
                <span style={{ fontWeight: 600, flex: 1 }}>{bot.widgetTitle}</span>
                <span style={{ opacity: 0.7, fontSize: 20 }}>×</span>
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "#fff" }}>
                <div style={{ maxWidth: "82%", padding: "10px 13px", borderRadius: bot.widgetBorderRadius, borderBottomLeftRadius: 4, background: bot.botBubbleColor, color: bot.botTextColor, alignSelf: "flex-start", fontSize: bot.widgetFontSize }}>
                  {bot.welcomeMessage}
                </div>
                <div style={{ maxWidth: "82%", padding: "10px 13px", borderRadius: bot.widgetBorderRadius, borderBottomRightRadius: 4, background: userBubble, color: bot.userTextColor, alignSelf: "flex-end", fontSize: bot.widgetFontSize }}>
                  Hi, I have a question about pricing
                </div>
                <div style={{ maxWidth: "82%", padding: "10px 13px", borderRadius: bot.widgetBorderRadius, borderBottomLeftRadius: 4, background: bot.botBubbleColor, color: bot.botTextColor, alignSelf: "flex-start", fontSize: bot.widgetFontSize }}>
                  Of course! I'd be happy to help. Which program are you interested in?
                </div>
              </div>
              {/* Input */}
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid #f3f4f6", background: "#fff", flexShrink: 0 }}>
                <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 20, padding: "8px 14px", fontSize: bot.widgetFontSize, color: "#9ca3af" }}>
                  {bot.placeholderText}
                </div>
                <div style={{ background: bot.widgetColor, color: bot.headerTextColor, borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  ➤
                </div>
              </div>
              {bot.showBranding && (
                <div style={{ textAlign: "center", padding: "4px 0 6px", fontSize: 10, color: "#9ca3af", background: "#fff", flexShrink: 0 }}>
                  Powered by GUSI AI
                </div>
              )}
            </div>
            {/* Floating button */}
            <div className="mt-4 flex items-center gap-3">
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: bot.widgetColor, color: bot.headerTextColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                {bot.avatarEmoji}
              </div>
              <p className="text-xs text-gray-500">Floating button ({bot.widgetPosition})</p>
            </div>
          </div>
        </div>
      )}

      {/* ── AI TAB ── */}
      {tab === "ai" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">AI System Prompt</h2>
          <p className="mb-3 text-xs text-gray-500">
            Defines the bot's personality, tone, and behaviour. Company Info is automatically injected — no need to repeat it here.
          </p>
          <textarea rows={14} className={inputCls} value={bot.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} />
          <div className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-700">
            <strong>Auto-injected on every message:</strong> Company Info (name, industry, values, philosophy, founders, achievements) + relevant Knowledge Base articles based on the visitor's question.
          </div>
        </div>
      )}

      {/* ── EMBED TAB ── */}
      {tab === "embed" && (
        <div className="space-y-5">
          {/* Script embed */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Script Embed — Floating Bubble (Recommended)</h2>
                <p className="mt-0.5 text-xs text-gray-500">Adds a floating chat button to every page. Paste before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>.</p>
              </div>
              <button onClick={() => copy(scriptSnippet, "script")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                {copiedScript ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedScript ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto">
              <pre className="text-xs text-green-400 whitespace-pre">{scriptSnippet}</pre>
            </div>
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1.5">
              <p className="font-semibold">How to add to WordPress:</p>
              <p>• <strong>Easiest:</strong> Install the free plugin <strong>"Insert Headers and Footers"</strong> → paste in the Footer Scripts box</p>
              <p>• <strong>Theme:</strong> Appearance → Theme File Editor → <code>footer.php</code> → paste before <code>&lt;/body&gt;</code></p>
              <p>• <strong>Per page:</strong> Add a <strong>Custom HTML</strong> block anywhere in the page editor</p>
            </div>
          </div>

          {/* iFrame embed */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">iFrame Embed — Inline Chat Window</h2>
                <p className="mt-0.5 text-xs text-gray-500">Embeds the full chat window inline inside a page section — no floating button.</p>
              </div>
              <button onClick={() => copy(iframeSnippet, "iframe")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                {copiedIframe ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedIframe ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <div className="rounded-lg bg-gray-900 p-4 overflow-x-auto">
              <pre className="text-xs text-green-400 whitespace-pre">{iframeSnippet}</pre>
            </div>
            <p className="mt-2 text-xs text-gray-400">In WordPress: paste into a <strong>Custom HTML</strong> block where you want the chat window to appear on the page.</p>
          </div>

          {/* Direct URL */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">Direct Chat URL</h2>
            <p className="mb-3 text-xs text-gray-500">Share this link directly, open in a popup, or use as the iframe src.</p>
            <div className="flex items-center gap-2">
              <input readOnly className={`${inputCls} bg-gray-50 font-mono text-xs`}
                value={`${origin}/chatbots/${params.id}/preview`} />
              <button onClick={() => navigator.clipboard.writeText(`${origin}/chatbots/${params.id}/preview`)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
