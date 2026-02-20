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

  var ORIGIN  = "${origin}";
  var BOT_ID  = "${botId}";
  var COLOR   = "${color}";
  var TITLE   = "${title}";
  var EMOJI   = "${emoji}";
  var WELCOME = "${welcome}";

  // ── Language detection ───────────────────────────────────────────────────────
  var browserLang = (navigator.language || "en").toLowerCase();
  var isSpanish = browserLang.startsWith("es");
  var LANG = isSpanish ? "es" : "en";

  var T = {
    typing:        isSpanish ? "Escribiendo…"                                             : "Typing…",
    errorGeneric:  isSpanish ? "Lo sentimos, algo salió mal. Inténtalo de nuevo."         : "Sorry, something went wrong. Please try again.",
    errorConn:     isSpanish ? "Error de conexión. Inténtalo de nuevo."                   : "Connection error. Please try again.",
    errorSession:  isSpanish ? "¡Hola! ¿En qué puedo ayudarte hoy?"                      : "Hi! How can I help you today?",
    leadPrompt:    isSpanish ? "✉️ ¡Déjanos tus datos y te contactaremos!"                : "✉️ Leave your details and we'll follow up!",
    leadName:      isSpanish ? "Tu nombre"                                                : "Your name",
    leadEmail:     isSpanish ? "Correo electrónico *"                                     : "Email address *",
    leadPhone:     isSpanish ? "Teléfono (opcional)"                                      : "Phone number (optional)",
    leadCompany:   isSpanish ? "Empresa (opcional)"                                       : "Company (optional)",
    leadSubmit:    isSpanish ? "Enviar mis datos"                                         : "Send my details",
    leadSkip:      isSpanish ? "Omitir por ahora"                                         : "Skip for now",
    leadNeedEmail: isSpanish ? "Por favor ingresa tu correo para que podamos contactarte." : "Please enter your email so we can follow up!",
    leadThanks:    isSpanish ? "¡Gracias{name}! Te contactaremos a {email}. ¿Puedo ayudarte en algo más?" : "Thanks{name}! We'll be in touch at {email}. Is there anything else I can help with?",
    leadSkipped:   isSpanish ? "¡Sin problema! Puedes seguir chateando."                  : "No problem! Feel free to keep chatting.",
    placeholder:   isSpanish ? "Escribe un mensaje…"                                      : "Type a message…",
    close:         isSpanish ? "Cerrar"                                                   : "Close",
  };

  function init() {
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

    // ── Styles ─────────────────────────────────────────────────────────────────
    // NOTE: We use .gusi-hidden instead of .hidden to avoid conflict with
    // WordPress core's .hidden { display: none !important } rule.
    // All selectors are prefixed with #gusi-chat-widget to survive WP theme resets.
    var style = document.createElement("style");
    style.textContent = \`
      #gusi-chat-btn {
        position: fixed !important; bottom: 24px !important; right: 24px !important; z-index: 2147483647 !important;
        width: 56px !important; height: 56px !important; border-radius: 50% !important;
        background: \${COLOR} !important; border: none !important; cursor: pointer !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important; padding: 0 !important; margin: 0 !important;
        font-size: 24px !important; display: flex !important; align-items: center !important; justify-content: center !important;
        transition: transform 0.2s !important; line-height: 1 !important; text-decoration: none !important;
        box-sizing: border-box !important; float: none !important;
      }
      #gusi-chat-btn:hover { transform: scale(1.08) !important; }
      #gusi-chat-window {
        position: fixed !important; bottom: 90px !important; right: 24px !important; z-index: 2147483646 !important;
        width: 360px !important; max-width: calc(100vw - 32px) !important;
        height: 520px !important; max-height: calc(100vh - 120px) !important;
        border-radius: 16px !important; overflow: hidden !important;
        box-shadow: 0 8px 40px rgba(0,0,0,0.2) !important;
        display: flex !important; flex-direction: column !important;
        background: #fff !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        transition: opacity 0.2s, transform 0.2s !important; box-sizing: border-box !important;
        margin: 0 !important; padding: 0 !important; float: none !important;
      }
      #gusi-chat-window.gusi-hidden { opacity: 0 !important; pointer-events: none !important; transform: translateY(12px) !important; }
      #gusi-chat-header {
        background: \${COLOR} !important; color: #fff !important; padding: 14px 16px !important;
        display: flex !important; align-items: center !important; gap: 10px !important; flex-shrink: 0 !important;
        box-sizing: border-box !important; margin: 0 !important;
      }
      #gusi-chat-header span { font-weight: 600 !important; font-size: 15px !important; flex: 1 !important; color: #fff !important; }
      #gusi-chat-close {
        background: none !important; border: none !important; color: #fff !important; cursor: pointer !important;
        font-size: 20px !important; padding: 0 !important; line-height: 1 !important; margin: 0 !important;
        box-shadow: none !important; text-decoration: none !important; float: none !important;
      }
      #gusi-chat-messages {
        flex: 1 !important; overflow-y: auto !important; padding: 14px !important;
        display: flex !important; flex-direction: column !important; gap: 10px !important;
        background: #fff !important; margin: 0 !important; box-sizing: border-box !important;
      }
      .gusi-msg {
        max-width: 82% !important; padding: 10px 13px !important; border-radius: 12px !important;
        font-size: 14px !important; line-height: 1.5 !important; word-break: break-word !important;
        box-sizing: border-box !important; margin: 0 !important; float: none !important;
      }
      .gusi-msg.gusi-user { background: \${COLOR} !important; color: #fff !important; align-self: flex-end !important; border-bottom-right-radius: 4px !important; }
      .gusi-msg.gusi-bot  { background: #f3f4f6 !important; color: #111 !important; align-self: flex-start !important; border-bottom-left-radius: 4px !important; }
      .gusi-msg.gusi-bot.gusi-typing { color: #9ca3af !important; font-style: italic !important; }
      #gusi-lead-form {
        padding: 12px 14px !important; background: #faf5ff !important;
        border-top: 1px solid #e9d5ff !important; flex-shrink: 0 !important;
        box-sizing: border-box !important; margin: 0 !important;
      }
      #gusi-lead-form p { font-size: 13px !important; color: #6b21a8 !important; margin: 0 0 8px !important; font-weight: 500 !important; }
      #gusi-lead-form input {
        width: 100% !important; box-sizing: border-box !important; border: 1px solid #d8b4fe !important;
        border-radius: 8px !important; padding: 7px 10px !important; font-size: 13px !important;
        margin: 0 0 6px !important; outline: none !important; background: #fff !important;
        color: #111 !important; box-shadow: none !important; display: block !important;
        height: auto !important; line-height: normal !important;
      }
      #gusi-lead-form input:focus { border-color: \${COLOR} !important; box-shadow: none !important; outline: none !important; }
      #gusi-lead-submit {
        width: 100% !important; background: \${COLOR} !important; color: #fff !important;
        border: none !important; border-radius: 8px !important; padding: 8px !important;
        font-size: 13px !important; font-weight: 600 !important; cursor: pointer !important;
        box-shadow: none !important; text-decoration: none !important; display: block !important;
        box-sizing: border-box !important; margin: 0 !important; line-height: normal !important;
      }
      #gusi-lead-skip {
        background: none !important; border: none !important; color: #9ca3af !important;
        font-size: 12px !important; cursor: pointer !important; width: 100% !important;
        margin: 4px 0 0 !important; padding: 0 !important; box-shadow: none !important;
        text-decoration: none !important; display: block !important; line-height: normal !important;
      }
      #gusi-chat-input-row {
        display: flex !important; gap: 8px !important; padding: 10px 12px !important;
        border-top: 1px solid #f3f4f6 !important; flex-shrink: 0 !important;
        box-sizing: border-box !important; margin: 0 !important; background: #fff !important;
      }
      #gusi-chat-input {
        flex: 1 !important; border: 1px solid #e5e7eb !important; border-radius: 20px !important;
        padding: 8px 14px !important; font-size: 14px !important; outline: none !important;
        resize: none !important; background: #fff !important; color: #111 !important;
        box-shadow: none !important; height: auto !important; line-height: normal !important;
        box-sizing: border-box !important; margin: 0 !important;
      }
      #gusi-chat-input:focus { border-color: \${COLOR} !important; box-shadow: none !important; outline: none !important; }
      #gusi-chat-send {
        background: \${COLOR} !important; color: #fff !important; border: none !important;
        border-radius: 50% !important; width: 36px !important; height: 36px !important;
        cursor: pointer !important; font-size: 16px !important; flex-shrink: 0 !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        padding: 0 !important; margin: 0 !important; box-shadow: none !important;
        text-decoration: none !important; box-sizing: border-box !important; line-height: 1 !important;
      }
      #gusi-chat-send:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }
    \`;
    document.head.appendChild(style);

    // ── DOM ───────────────────────────────────────────────────────────────────
    var btn = document.createElement("button");
    btn.id = "gusi-chat-btn";
    btn.innerHTML = EMOJI;
    btn.title = TITLE;
    btn.setAttribute("type", "button"); // prevent WP form submission if inside a form

    var win = document.createElement("div");
    win.id = "gusi-chat-window";
    win.className = "gusi-hidden"; // NOT "hidden" — WP core uses .hidden { display:none !important }
    win.innerHTML = \`
      <div id="gusi-chat-header">
        <span>\${EMOJI} \${TITLE}</span>
        <button id="gusi-chat-close" type="button" title="\${T.close}">×</button>
      </div>
      <div id="gusi-chat-messages"></div>
      <div id="gusi-lead-form" style="display:none">
        <p>\${T.leadPrompt}</p>
        <input id="gusi-lead-name" type="text" placeholder="\${T.leadName}" autocomplete="name" />
        <input id="gusi-lead-email" type="email" placeholder="\${T.leadEmail}" autocomplete="email" />
        <input id="gusi-lead-phone" type="tel" placeholder="\${T.leadPhone}" autocomplete="tel" />
        <input id="gusi-lead-company" type="text" placeholder="\${T.leadCompany}" autocomplete="organization" />
        <button id="gusi-lead-submit" type="button">\${T.leadSubmit}</button>
        <button id="gusi-lead-skip" type="button">\${T.leadSkip}</button>
      </div>
      <div id="gusi-chat-input-row">
        <input id="gusi-chat-input" type="text" placeholder="\${T.placeholder}" autocomplete="off" />
        <button id="gusi-chat-send" type="button">➤</button>
      </div>
    \`;

    document.body.appendChild(btn);
    document.body.appendChild(win);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function addMessage(role, text) {
      var msgs = document.getElementById("gusi-chat-messages");
      var div = document.createElement("div");
      div.className = "gusi-msg gusi-" + role.replace(/ /g, " gusi-");
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

    // ── Session init ───────────────────────────────────────────────────────────
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

    // ── Send message ───────────────────────────────────────────────────────────
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

    // ── Lead capture ───────────────────────────────────────────────────────────
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

    // ── Event listeners ────────────────────────────────────────────────────────
    btn.addEventListener("click", function() {
      isOpen = !isOpen;
      win.classList.toggle("gusi-hidden", !isOpen);
      if (isOpen && !sessionId) initSession();
    });

    document.getElementById("gusi-chat-close").addEventListener("click", function() {
      isOpen = false;
      win.classList.add("gusi-hidden");
    });

    document.getElementById("gusi-chat-send").addEventListener("click", function() {
      sendMessage(document.getElementById("gusi-chat-input").value);
    });

    document.getElementById("gusi-chat-input").addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(this.value); }
    });

    document.getElementById("gusi-lead-submit").addEventListener("click", function() { submitLead(false); });
    document.getElementById("gusi-lead-skip").addEventListener("click", function() { submitLead(true); });
  } // end init()

  // ── DOMContentLoaded guard ────────────────────────────────────────────────────
  // Handles scripts loaded in <head> without defer (common in WordPress)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
