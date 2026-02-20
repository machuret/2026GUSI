"use client";

import { useEffect, useRef, useState } from "react";

interface BotInfo {
  name: string;
  widgetTitle: string;
  widgetColor: string;
  avatarEmoji: string;
  welcomeMessage: string;
  botBubbleColor: string;
  botTextColor: string;
  userBubbleColor: string;
  userTextColor: string;
  widgetFontSize: number;
  widgetBorderRadius: number;
  placeholderText: string;
  showBranding: boolean;
}

interface Message {
  role: "user" | "bot";
  content: string;
  typing?: boolean;
}

export default function ChatPreviewPage({ params }: { params: { id: string } }) {
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initError, setInitError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const visitorId = useRef<string>("preview_visitor");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let vid = localStorage.getItem("gusi_visitor_id");
    if (!vid) {
      vid = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("gusi_visitor_id", vid);
    }
    visitorId.current = vid;

    fetch(`/api/chat/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: params.id, visitorId: visitorId.current, lang: "en" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setInitError(true); return; }
        setSessionId(data.sessionId);
        setBot(data.bot);
        if (data.isNew) {
          setMessages([{ role: "bot", content: data.bot.welcomeMessage }]);
        } else {
          setMessages((data.messages || []).map((m: { role: string; content: string }) => ({
            role: m.role === "user" ? "user" : "bot",
            content: m.content,
          })));
          if (data.messages?.length === 0) {
            setMessages([{ role: "bot", content: data.bot.welcomeMessage }]);
          }
        }
      })
      .catch(() => setInitError(true));
  }, [params.id]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "bot", content: "…", typing: true }]);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: params.id, sessionId, message: text, lang: "en" }),
      });
      const data = await res.json();
      setMessages((prev) => {
        const without = prev.filter((m) => !m.typing);
        return [...without, { role: "bot", content: data.error ? "Sorry, something went wrong. Please try again." : data.reply }];
      });
    } catch {
      setMessages((prev) => {
        const without = prev.filter((m) => !m.typing);
        return [...without, { role: "bot", content: "Connection error. Please try again." }];
      });
    } finally {
      setLoading(false);
    }
  };

  if (initError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Bot not found or inactive.</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
      </div>
    );
  }

  const userBubble = bot.userBubbleColor || bot.widgetColor;
  const radius = bot.widgetBorderRadius ?? 16;
  const fontSize = bot.widgetFontSize ?? 14;

  return (
    <div
      className="flex h-screen flex-col"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize }}
    >
      {/* Header */}
      <div
        style={{ background: bot.widgetColor, color: bot.userTextColor ?? "#fff", flexShrink: 0 }}
        className="flex items-center gap-3 px-4 py-3.5"
      >
        <span style={{ fontSize: 22 }}>{bot.avatarEmoji}</span>
        <span style={{ fontWeight: 600, flex: 1 }}>{bot.widgetTitle}</span>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-white p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              maxWidth: "82%",
              padding: "10px 13px",
              borderRadius: radius,
              ...(msg.role === "bot"
                ? { borderBottomLeftRadius: 4, background: bot.botBubbleColor || "#f3f4f6", color: bot.botTextColor || "#111", alignSelf: "flex-start" }
                : { borderBottomRightRadius: 4, background: userBubble, color: bot.userTextColor || "#fff", alignSelf: "flex-end" }),
              fontSize,
              lineHeight: 1.5,
              wordBreak: "break-word",
              fontStyle: msg.typing ? "italic" : "normal",
              opacity: msg.typing ? 0.6 : 1,
            }}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2.5" style={{ flexShrink: 0 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={bot.placeholderText || "Type a message…"}
          disabled={loading}
          className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-400 disabled:opacity-50"
          style={{ fontSize }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{ background: bot.widgetColor, color: "#fff", borderRadius: "50%", width: 36, height: 36, border: "none", cursor: "pointer", fontSize: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          className="disabled:opacity-50"
        >
          ➤
        </button>
      </div>

      {bot.showBranding && (
        <div className="bg-white py-1 text-center text-xs text-gray-400" style={{ flexShrink: 0 }}>
          Powered by GUSI AI
        </div>
      )}
    </div>
  );
}
