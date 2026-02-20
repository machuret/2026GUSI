"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, CheckCircle, ArrowLeft, Copy, Check } from "lucide-react";
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
}

export default function ChatbotSettingsPage({ params }: { params: { id: string } }) {
  const [bot, setBot] = useState<ChatBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/chatbots/${params.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.bot) setBot(d.bot); })
      .finally(() => setLoading(false));
  }, [params.id]);

  const set = (key: keyof ChatBot, value: unknown) =>
    setBot((b) => b ? { ...b, [key]: value } : b);

  const handleSave = async () => {
    if (!bot) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/chatbots/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bot.name,
          systemPrompt: bot.systemPrompt,
          widgetTitle: bot.widgetTitle,
          widgetColor: bot.widgetColor,
          avatarEmoji: bot.avatarEmoji,
          welcomeMessage: bot.welcomeMessage,
          active: bot.active,
        }),
      });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally {
      setSaving(false);
    }
  };

  const copySnippet = () => {
    const origin = window.location.origin;
    const snippet = `<script>\n  window.GUSIChat = { botId: "${params.id}" };\n</script>\n<script src="${origin}/api/chatbots/${params.id}/widget.js" async></script>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>;
  if (!bot) return <div className="py-32 text-center text-gray-400">Bot not found</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/chatbots" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{bot.name}</h1>
          <p className="text-sm text-gray-500">Bot settings & appearance</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="space-y-5">
        {/* Identity */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Identity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Bot Name</label>
              <input className={inputCls} value={bot.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Widget Title</label>
              <input className={inputCls} value={bot.widgetTitle} onChange={(e) => set("widgetTitle", e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-700">Welcome Message</label>
            <input className={inputCls} value={bot.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} />
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Appearance</h2>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Brand Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={bot.widgetColor} onChange={(e) => set("widgetColor", e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-gray-300" />
                <input className={inputCls} value={bot.widgetColor} onChange={(e) => set("widgetColor", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Avatar Emoji</label>
              <input className={inputCls} value={bot.avatarEmoji} onChange={(e) => set("avatarEmoji", e.target.value)} maxLength={2} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Preview</label>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-md" style={{ background: bot.widgetColor }}>
                  {bot.avatarEmoji}
                </div>
                <div className="rounded-xl px-3 py-1.5 text-xs font-medium text-white" style={{ background: bot.widgetColor }}>
                  {bot.widgetTitle}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">AI System Prompt</h2>
          <p className="mb-3 text-xs text-gray-500">Defines the bot's personality, tone, and behaviour. Be specific about how it should handle support vs sales.</p>
          <textarea rows={8} className={inputCls} value={bot.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} />
        </div>

        {/* Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Bot Status</h2>
              <p className="text-xs text-gray-500">Inactive bots will not respond to visitors</p>
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <div onClick={() => set("active", !bot.active)} className={`relative h-6 w-11 rounded-full transition-colors ${bot.active ? "bg-green-500" : "bg-gray-300"}`}>
                <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${bot.active ? "translate-x-6" : "translate-x-1"}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">{bot.active ? "Active" : "Inactive"}</span>
            </label>
          </div>
        </div>

        {/* Embed snippet */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">WordPress Embed Snippet</h2>
              <p className="text-xs text-gray-500">Paste into your WordPress theme header or a Custom HTML block</p>
            </div>
            <button onClick={copySnippet} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="rounded-lg bg-gray-900 p-4">
            <code className="text-xs text-green-400 whitespace-pre">{`<script>\n  window.GUSIChat = { botId: "${params.id}" };\n</script>\n<script src="${typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/chatbots/${params.id}/widget.js" async></script>`}</code>
          </div>
          <p className="mt-2 text-xs text-gray-400">In WordPress: go to <strong>Appearance → Theme Editor → header.php</strong> and paste before <code>&lt;/head&gt;</code>, or use a plugin like <strong>Insert Headers and Footers</strong>.</p>
        </div>
      </div>
    </div>
  );
}
