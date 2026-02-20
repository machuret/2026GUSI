export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/chatbots/[id]/widget.js — serves the embeddable chat widget script
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: bot } = await db
    .from("ChatBot")
    .select("id, widgetTitle, widgetColor, avatarEmoji, welcomeMessage, active")
    .eq("id", params.id)
    .maybeSingle();

  if (!bot || !bot.active) {
    return new NextResponse("// Bot not found or inactive", {
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const origin = req.nextUrl.origin;
  const color = bot.widgetColor ?? "#7c3aed";
  const title = (bot.widgetTitle ?? "Chat with us").replace(/"/g, '\\"');
  const emoji = bot.avatarEmoji ?? "🤖";
  const welcome = (bot.welcomeMessage ?? "Hi! How can I help?").replace(/"/g, '\\"');
  const botId = bot.id;

  const script = `
(function() {
  if (window.__GUSIChatLoaded) return;
  window.__GUSIChatLoaded = true;

  var ORIGIN = "${origin}";
  var BOT_ID = "${botId}";
  var COLOR  = "${color}";
  var TITLE  = "${title}";
  var EMOJI  = "${emoji}";
  var WELCOME = "${welcome}";

  // Generate or retrieve visitor ID
  var visitorId = localStorage.getItem("gusi_visitor_id");
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("gusi_visitor_id", visitorId);
  }

  var sessionId = null;
  var messageCount = 0;
  var leadCaptured = localStorage.getItem("gusi_lead_" + BOT_ID) === "1";
  var isOpen = false;
  var isLoading = false;

  // ── Language detection ───────────────────────────────────────────────────────
  var browserLang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  var isSpanish = browserLang.startsWith("es");
  var LANG = isSpanish ? "es" : "en";

  var T = {
    typing:          isSpanish ? "Escribiendo…"                                         : "Typing…",
    errorGeneric:    isSpanish ? "Lo sentimos, algo salió mal. Inténtalo de nuevo."     : "Sorry, something went wrong. Please try again.",
    errorConn:       isSpanish ? "Error de conexión. Inténtalo de nuevo."               : "Connection error. Please try again.",
    errorSession:    isSpanish ? "¡Hola! ¿En qué puedo ayudarte hoy?"                  : "Hi! How can I help you today?",
    leadPrompt:      isSpanish ? "✉️ ¡Déjanos tus datos y te contactaremos!"            : "✉️ Leave your details and we'll follow up!",
    leadName:        isSpanish ? "Tu nombre"                                            : "Your name",
    leadEmail:       isSpanish ? "Correo electrónico *"                                 : "Email address *",
    leadPhone:       isSpanish ? "Teléfono (opcional)"                                  : "Phone number (optional)",
    leadCompany:     isSpanish ? "Empresa (opcional)"                                   : "Company (optional)",
    leadSubmit:      isSpanish ? "Enviar mis datos"                                     : "Send my details",
    leadSkip:        isSpanish ? "Omitir por ahora"                                     : "Skip for now",
    leadNeedEmail:   isSpanish ? "Por favor ingresa tu correo para que podamos contactarte." : "Please enter your email so we can follow up!",
    leadThanks:      isSpanish ? "¡Gracias{name}! Te contactaremos a {email}. ¿Puedo ayudarte en algo más?" : "Thanks{name}! We'll be in touch at {email}. Is there anything else I can help with?",
    leadSkipped:     isSpanish ? "¡Sin problema! Puedes seguir chateando."              : "No problem! Feel free to keep chatting.",
    placeholder:     isSpanish ? "Escribe un mensaje…"                                  : "Type a message…",
    close:           isSpanish ? "Cerrar"                                               : "Close",
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = \`
    #gusi-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: \${COLOR}; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      font-size: 24px; display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    #gusi-chat-btn:hover { transform: scale(1.08); }
    #gusi-chat-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 99998;
      width: 360px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px);
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.2);
      display: flex; flex-direction: column;
      background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transition: opacity 0.2s, transform 0.2s;
    }
    #gusi-chat-window.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
    #gusi-chat-header {
      background: \${COLOR}; color: #fff; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #gusi-chat-header span { font-weight: 600; font-size: 15px; flex: 1; }
    #gusi-chat-close { background: none; border: none; color: #fff; cursor: pointer; font-size: 20px; padding: 0; line-height: 1; }
    #gusi-chat-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .gusi-msg { max-width: 82%; padding: 10px 13px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-break: break-word; }
    .gusi-msg.user { background: \${COLOR}; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .gusi-msg.bot  { background: #f3f4f6; color: #111; align-self: flex-start; border-bottom-left-radius: 4px; }
    .gusi-msg.bot.typing { color: #9ca3af; font-style: italic; }
    #gusi-lead-form { padding: 12px 14px; background: #faf5ff; border-top: 1px solid #e9d5ff; flex-shrink: 0; }
    #gusi-lead-form p { font-size: 13px; color: #6b21a8; margin: 0 0 8px; font-weight: 500; }
    #gusi-lead-form input {
      width: 100%; box-sizing: border-box; border: 1px solid #d8b4fe; border-radius: 8px;
      padding: 7px 10px; font-size: 13px; margin-bottom: 6px; outline: none;
    }
    #gusi-lead-form input:focus { border-color: \${COLOR}; }
    #gusi-lead-submit {
      width: 100%; background: \${COLOR}; color: #fff; border: none; border-radius: 8px;
      padding: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    #gusi-lead-skip { background: none; border: none; color: #9ca3af; font-size: 12px; cursor: pointer; width: 100%; margin-top: 4px; }
    #gusi-chat-input-row {
      display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #f3f4f6; flex-shrink: 0;
    }
    #gusi-chat-input {
      flex: 1; border: 1px solid #e5e7eb; border-radius: 20px; padding: 8px 14px;
      font-size: 14px; outline: none; resize: none;
    }
    #gusi-chat-input:focus { border-color: \${COLOR}; }
    #gusi-chat-send {
      background: \${COLOR}; color: #fff; border: none; border-radius: 50%;
      width: 36px; height: 36px; cursor: pointer; font-size: 16px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    #gusi-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
  \`;
  document.head.appendChild(style);

  // ── DOM ─────────────────────────────────────────────────────────────────────
  var btn = document.createElement("button");
  btn.id = "gusi-chat-btn";
  btn.innerHTML = EMOJI;
  btn.title = TITLE;

  var win = document.createElement("div");
  win.id = "gusi-chat-window";
  win.className = "hidden";
  win.innerHTML = \`
    <div id="gusi-chat-header">
      <span>\${EMOJI} \${TITLE}</span>
      <button id="gusi-chat-close" title="\${T.close}">×</button>
    </div>
    <div id="gusi-chat-messages"></div>
    <div id="gusi-lead-form" style="display:none">
      <p>\${T.leadPrompt}</p>
      <input id="gusi-lead-name" placeholder="\${T.leadName}" />
      <input id="gusi-lead-email" type="email" placeholder="\${T.leadEmail}" />
      <input id="gusi-lead-phone" placeholder="\${T.leadPhone}" />
      <input id="gusi-lead-company" placeholder="\${T.leadCompany}" />
      <button id="gusi-lead-submit">\${T.leadSubmit}</button>
      <button id="gusi-lead-skip">\${T.leadSkip}</button>
    </div>
    <div id="gusi-chat-input-row">
      <input id="gusi-chat-input" placeholder="\${T.placeholder}" />
      <button id="gusi-chat-send">➤</button>
    </div>
  \`;

  document.body.appendChild(btn);
  document.body.appendChild(win);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function addMessage(role, text) {
    var msgs = document.getElementById("gusi-chat-messages");
    var div = document.createElement("div");
    div.className = "gusi-msg " + role;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showLeadForm() {
    document.getElementById("gusi-lead-form").style.display = "block";
    document.getElementById("gusi-chat-input-row").style.display = "none";
  }

  function hideLeadForm() {
    document.getElementById("gusi-lead-form").style.display = "none";
    document.getElementById("gusi-chat-input-row").style.display = "flex";
  }

  // ── Session init ─────────────────────────────────────────────────────────────
  async function initSession() {
    try {
      var res = await fetch(ORIGIN + "/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: BOT_ID, visitorId: visitorId, lang: LANG }),
      });
      var data = await res.json();
      sessionId = data.sessionId;
      messageCount = data.messageCount || 0;

      if (data.isNew) {
        addMessage("bot", WELCOME);
      } else {
        (data.messages || []).forEach(function(m) {
          addMessage(m.role === "user" ? "user" : "bot", m.content);
        });
      }
    } catch(e) {
      addMessage("bot", T.errorSession);
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;
    isLoading = true;
    document.getElementById("gusi-chat-send").disabled = true;
    document.getElementById("gusi-chat-input").value = "";

    addMessage("user", text);
    var typingDiv = addMessage("bot typing", T.typing);

    try {
      var res = await fetch(ORIGIN + "/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: BOT_ID, sessionId: sessionId, message: text, lang: LANG }),
      });
      var data = await res.json();
      typingDiv.remove();

      if (data.error) {
        addMessage("bot", T.errorGeneric);
      } else {
        addMessage("bot", data.reply);
        messageCount = data.messageCount || messageCount + 1;
        if (data.askForLead && !leadCaptured) showLeadForm();
      }
    } catch(e) {
      typingDiv.remove();
      addMessage("bot", T.errorConn);
    }

    isLoading = false;
    document.getElementById("gusi-chat-send").disabled = false;
  }

  // ── Lead capture ─────────────────────────────────────────────────────────────
  async function submitLead(skip) {
    hideLeadForm();
    leadCaptured = true;
    localStorage.setItem("gusi_lead_" + BOT_ID, "1");

    if (skip) {
      addMessage("bot", T.leadSkipped);
      return;
    }

    var name    = document.getElementById("gusi-lead-name").value.trim();
    var email   = document.getElementById("gusi-lead-email").value.trim();
    var phone   = document.getElementById("gusi-lead-phone").value.trim();
    var company = document.getElementById("gusi-lead-company").value.trim();

    if (!email) {
      addMessage("bot", T.leadNeedEmail);
      showLeadForm();
      leadCaptured = false;
      localStorage.removeItem("gusi_lead_" + BOT_ID);
      return;
    }

    try {
      await fetch(ORIGIN + "/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: BOT_ID, sessionId: sessionId, message: "[Lead captured]", lang: LANG, leadName: name, leadEmail: email, leadPhone: phone, leadCompany: company }),
      });
      var thanks = T.leadThanks
        .replace("{name}", name ? ", " + name : "")
        .replace("{email}", email);
      addMessage("bot", thanks);
    } catch(e) {
      addMessage("bot", isSpanish ? "¡Gracias! Nos pondremos en contacto pronto." : "Thanks! We'll be in touch soon.");
    }
  }

  // ── Event listeners ──────────────────────────────────────────────────────────
  btn.addEventListener("click", function() {
    isOpen = !isOpen;
    win.classList.toggle("hidden", !isOpen);
    if (isOpen && !sessionId) initSession();
  });

  document.getElementById("gusi-chat-close").addEventListener("click", function() {
    isOpen = false;
    win.classList.add("hidden");
  });

  document.getElementById("gusi-chat-send").addEventListener("click", function() {
    sendMessage(document.getElementById("gusi-chat-input").value);
  });

  document.getElementById("gusi-chat-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(this.value); }
  });

  document.getElementById("gusi-lead-submit").addEventListener("click", function() { submitLead(false); });
  document.getElementById("gusi-lead-skip").addEventListener("click", function() { submitLead(true); });

})();
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
