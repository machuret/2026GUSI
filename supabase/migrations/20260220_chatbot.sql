-- ─── ChatBot ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChatBot" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL DEFAULT 'GUSI Assistant',
  "systemPrompt"  TEXT NOT NULL DEFAULT 'You are a helpful assistant.',
  "widgetTitle"   TEXT NOT NULL DEFAULT 'Chat with us',
  "widgetColor"   TEXT NOT NULL DEFAULT '#7c3aed',
  "avatarEmoji"   TEXT NOT NULL DEFAULT '🤖',
  "welcomeMessage" TEXT NOT NULL DEFAULT 'Hi! How can I help you today?',
  "apiKey"        TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  active          BOOLEAN NOT NULL DEFAULT true,
  "companyId"     TEXT NOT NULL DEFAULT 'demo',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── KnowledgeBase ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "botId"       TEXT NOT NULL REFERENCES "ChatBot"(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',  -- 'support' | 'sales' | 'general'
  source        TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'url' | 'upload' | 'vault'
  "sourceUrl"   TEXT,
  "searchVector" TSVECTOR,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS kb_search_idx ON "KnowledgeBase" USING GIN("searchVector");
CREATE INDEX IF NOT EXISTS kb_bot_idx ON "KnowledgeBase"("botId");

-- Auto-update searchVector on insert/update
CREATE OR REPLACE FUNCTION update_kb_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_search_vector_trigger ON "KnowledgeBase";
CREATE TRIGGER kb_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "KnowledgeBase"
  FOR EACH ROW EXECUTE FUNCTION update_kb_search_vector();

-- ─── ChatSession ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChatSession" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "botId"       TEXT NOT NULL REFERENCES "ChatBot"(id) ON DELETE CASCADE,
  "visitorId"   TEXT NOT NULL,  -- random UUID stored in visitor's localStorage
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'closed' | 'escalated'
  "detectedIntent" TEXT,        -- 'support' | 'sales' | null
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_bot_idx ON "ChatSession"("botId");
CREATE INDEX IF NOT EXISTS session_visitor_idx ON "ChatSession"("visitorId");

-- ─── ChatMessage ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId"   TEXT NOT NULL REFERENCES "ChatSession"(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content       TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msg_session_idx ON "ChatMessage"("sessionId");

-- ─── ChatLead ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ChatLead" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL REFERENCES "ChatSession"(id) ON DELETE CASCADE,
  "botId"     TEXT NOT NULL REFERENCES "ChatBot"(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  notes       TEXT,  -- summary of what they asked about
  intent      TEXT,  -- 'support' | 'sales'
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_bot_idx ON "ChatLead"("botId");
CREATE INDEX IF NOT EXISTS lead_session_idx ON "ChatLead"("sessionId");

-- ─── Seed default bot ────────────────────────────────────────────────────────
INSERT INTO "ChatBot" (id, name, "systemPrompt", "widgetTitle", "welcomeMessage", "companyId")
VALUES (
  'default-bot',
  'GUSI Assistant',
  'You are a helpful AI assistant for Global Ultrasound Institute. You handle both customer support and sales enquiries. Be professional, warm, and concise. When you detect the visitor needs human help, say you will escalate to the team.',
  'Chat with GUSI',
  'Hi! I''m the GUSI Assistant. I can help with support questions or tell you about our programs. How can I help you today?',
  'demo'
) ON CONFLICT (id) DO NOTHING;
