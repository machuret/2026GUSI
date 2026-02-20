"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, Users, Copy, Check, Settings, BookOpen, Loader2, Bot, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";

interface ChatBot {
  id: string;
  name: string;
  widgetTitle: string;
  widgetColor: string;
  avatarEmoji: string;
  welcomeMessage: string;
  apiKey: string;
  active: boolean;
  sessionCount: number;
  leadCount: number;
  createdAt: string;
}

const DEFAULT_PROMPT = `You are a helpful AI assistant. You handle both customer support and sales enquiries professionally and warmly. 
- For support: help troubleshoot issues, answer product questions, and escalate complex problems
- For sales: explain pricing, features, and benefits; capture interest and encourage next steps
Always be concise, friendly, and helpful. If you cannot answer something, offer to connect the visitor with the team.`;

export default function ChatbotsPage() {
  const [bots, setBots] = useState<ChatBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "GUSI Assistant",
    systemPrompt: DEFAULT_PROMPT,
    widgetTitle: "Chat with us",
    widgetColor: "#7c3aed",
    avatarEmoji: "🤖",
    welcomeMessage: "Hi! I can help with support or sales questions. How can I assist you today?",
  });

  const fetchBots = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chatbots");
      const data = await res.json();
      setBots(data.bots ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBots(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setBots((prev) => [data.bot, ...prev]);
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (bot: ChatBot) => {
    await fetch(`/api/chatbots/${bot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !bot.active }),
    });
    setBots((prev) => prev.map((b) => b.id === bot.id ? { ...b, active: !b.active } : b));
  };

  const copySnippet = (bot: ChatBot) => {
    const origin = window.location.origin;
    const snippet = `<script>\n  window.GUSIChat = { botId: "${bot.id}" };\n</script>\n<script src="${origin}/api/chatbots/${bot.id}/widget.js" async></script>`;
    navigator.clipboard.writeText(snippet);
    setCopied(bot.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chatbots</h1>
          <p className="mt-1 text-gray-500">AI-powered chat widgets — embed on any website</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Chatbot
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Create New Chatbot</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Bot Name</label>
                  <input className={inputCls} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Widget Title</label>
                  <input className={inputCls} value={form.widgetTitle} onChange={(e) => setForm((p) => ({ ...p, widgetTitle: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.widgetColor} onChange={(e) => setForm((p) => ({ ...p, widgetColor: e.target.value }))} className="h-9 w-14 cursor-pointer rounded border border-gray-300" />
                    <input className={inputCls} value={form.widgetColor} onChange={(e) => setForm((p) => ({ ...p, widgetColor: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Avatar Emoji</label>
                  <input className={inputCls} value={form.avatarEmoji} onChange={(e) => setForm((p) => ({ ...p, avatarEmoji: e.target.value }))} maxLength={2} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Preview</label>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-xl" style={{ background: form.widgetColor }}>
                    {form.avatarEmoji}
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Welcome Message</label>
                <input className={inputCls} value={form.welcomeMessage} onChange={(e) => setForm((p) => ({ ...p, welcomeMessage: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">System Prompt (AI personality & instructions)</label>
                <textarea rows={5} className={inputCls} value={form.systemPrompt} onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? "Creating…" : "Create Chatbot"}
              </button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
      ) : bots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-24 text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400">No chatbots yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bots.map((bot) => (
            <div key={bot.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ background: bot.widgetColor }}>
                    {bot.avatarEmoji}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                    <p className="text-sm text-gray-500">{bot.widgetTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(bot)} title={bot.active ? "Deactivate" : "Activate"} className="text-gray-400 hover:text-brand-600">
                    {bot.active ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                  <Link href={`/chatbots/${bot.id}/knowledge`} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <BookOpen className="h-3.5 w-3.5" /> Train
                  </Link>
                  <Link href={`/chatbots/${bot.id}/conversations`} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <MessageSquare className="h-3.5 w-3.5" /> Conversations
                  </Link>
                  <Link href={`/chatbots/${bot.id}`} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center gap-6">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MessageSquare className="h-4 w-4" />
                  <span><strong className="text-gray-900">{bot.sessionCount}</strong> conversations</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span><strong className="text-gray-900">{bot.leadCount}</strong> leads captured</span>
                </div>
                <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bot.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {bot.active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Embed snippet */}
              <div className="mt-4 rounded-lg bg-gray-900 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">WordPress embed snippet</span>
                  <button onClick={() => copySnippet(bot)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                    {copied === bot.id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === bot.id ? "Copied!" : "Copy"}
                  </button>
                </div>
                <code className="text-xs text-green-400 whitespace-pre">{`<script>\n  window.GUSIChat = { botId: "${bot.id}" };\n</script>\n<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/chatbots/${bot.id}/widget.js" async></script>`}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
