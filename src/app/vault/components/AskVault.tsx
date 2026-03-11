"use client";

import { useCallback, useRef, useState } from "react";
import { Send, Loader2, MessageSquare, FileText, Sparkles, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

interface Source {
  documentId: string;
  filename: string;
  similarity: number;
  chunkIndex: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  tokens?: number;
}

export function AskVault() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAsk = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await authFetch("/api/vault/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to get answer");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          tokens: data.tokens,
        },
      ]);

      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <Sparkles className="h-5 w-5 text-brand-600" />
        <div>
          <h3 className="text-sm font-bold text-gray-900">Ask the Vault</h3>
          <p className="text-xs text-gray-400">Ask any question about your documents</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-[200px] max-h-[500px]">
        {messages.length === 0 && !loading && (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">
              Ask anything about your vault documents.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {[
                "What products does our company offer?",
                "Summarize our brand guidelines",
                "What are our key achievements?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-50 border border-gray-200 text-gray-800"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="space-y-2">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Sources:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((s, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-50 border border-brand-200 px-2 py-0.5 text-xs text-brand-700"
                          >
                            <FileText className="h-3 w-3" />
                            {s.filename}
                            <span className="text-brand-400">
                              ({Math.round(s.similarity * 100)}%)
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {msg.tokens && (
                    <p className="text-xs text-gray-300 mt-1">{msg.tokens} tokens used</p>
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching vault & generating answer…
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your vault…"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            style={{ minHeight: "38px", maxHeight: "120px" }}
          />
          <button
            onClick={handleAsk}
            disabled={!input.trim() || loading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
