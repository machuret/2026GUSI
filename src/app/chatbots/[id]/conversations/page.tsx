"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquare, User, Loader2, Mail, Phone, Building2, ChevronRight, X } from "lucide-react";
import Link from "next/link";

interface Lead {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface Session {
  id: string;
  visitorId: string;
  status: "active" | "closed" | "escalated";
  detectedIntent: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lead?: Lead | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  closed:    "bg-gray-100 text-gray-500",
  escalated: "bg-red-100 text-red-700",
};

const INTENT_COLORS: Record<string, string> = {
  support: "bg-blue-100 text-blue-700",
  sales:   "bg-purple-100 text-purple-700",
  general: "bg-gray-100 text-gray-500",
};

export default function ConversationsPage({ params }: { params: { id: string } }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [transcriptLead, setTranscriptLead] = useState<Lead | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/chatbots/${params.id}/conversations`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .finally(() => setLoading(false));
  }, [params.id]);

  const openTranscript = async (session: Session) => {
    setSelected(session);
    setTranscriptLoading(true);
    try {
      const res = await fetch(`/api/chatbots/${params.id}/conversations?sessionId=${session.id}`);
      const data = await res.json();
      setTranscript(data.messages ?? []);
      setTranscriptLead(data.lead ?? null);
    } finally {
      setTranscriptLoading(false);
    }
  };

  const updateStatus = async (sessionId: string, status: string) => {
    await fetch(`/api/chatbots/${params.id}/conversations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status }),
    });
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status: status as Session["status"] } : s));
    if (selected?.id === sessionId) setSelected((s) => s ? { ...s, status: status as Session["status"] } : s);
  };

  const leads = sessions.filter((s) => s.lead?.email);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/chatbots" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-sm text-gray-500">{sessions.length} total · {leads.length} leads captured</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Leads panel */}
        <div className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Captured Leads</h2>
          {leads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">No leads yet</div>
          ) : (
            <div className="space-y-2">
              {leads.map((s) => (
                <div key={s.id} onClick={() => openTranscript(s)} className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
                      {(s.lead?.name ?? s.lead?.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{s.lead?.name ?? "Unknown"}</p>
                      <p className="truncate text-xs text-gray-500">{s.lead?.email}</p>
                    </div>
                    {s.detectedIntent && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INTENT_COLORS[s.detectedIntent] ?? INTENT_COLORS.general}`}>
                        {s.detectedIntent}
                      </span>
                    )}
                  </div>
                  {s.lead?.phone && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                      <Phone className="h-3 w-3" />{s.lead.phone}
                    </div>
                  )}
                  {s.lead?.company && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                      <Building2 className="h-3 w-3" />{s.lead.company}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sessions list */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">All Conversations</h2>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">No conversations yet</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {sessions.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => openTranscript(s)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${i < sessions.length - 1 ? "border-b border-gray-100" : ""} ${selected?.id === s.id ? "bg-brand-50" : ""}`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {s.lead?.name ?? s.lead?.email ?? `Visitor ${s.visitorId.slice(-6)}`}
                      </p>
                      {s.lead?.email && <Mail className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400">{s.messageCount} messages · {new Date(s.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.detectedIntent && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INTENT_COLORS[s.detectedIntent] ?? INTENT_COLORS.general}`}>
                        {s.detectedIntent}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transcript drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{selected.lead?.name ?? selected.lead?.email ?? `Visitor ${selected.visitorId.slice(-6)}`}</p>
                <p className="text-xs text-gray-400">{selected.messageCount} messages · {selected.detectedIntent ?? "general"}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected.status !== "closed" && (
                  <button onClick={() => updateStatus(selected.id, "closed")} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">Close</button>
                )}
                {selected.status !== "escalated" && (
                  <button onClick={() => updateStatus(selected.id, "escalated")} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100">Escalate</button>
                )}
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Lead info */}
            {transcriptLead && (
              <div className="border-b border-gray-100 bg-brand-50 px-5 py-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">Lead Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                  {transcriptLead.name && <span><strong>Name:</strong> {transcriptLead.name}</span>}
                  {transcriptLead.email && <span><strong>Email:</strong> {transcriptLead.email}</span>}
                  {transcriptLead.phone && <span><strong>Phone:</strong> {transcriptLead.phone}</span>}
                  {transcriptLead.company && <span><strong>Company:</strong> {transcriptLead.company}</span>}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {transcriptLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
              ) : transcript.length === 0 ? (
                <p className="text-center text-sm text-gray-400">No messages</p>
              ) : transcript.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs rounded-xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={`mt-1 text-xs ${m.role === "user" ? "text-brand-200" : "text-gray-400"}`}>
                      {new Date(m.createdAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
