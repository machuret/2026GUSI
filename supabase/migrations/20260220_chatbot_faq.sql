-- FAQ table: structured Q&A pairs for chatbot training
-- Separate from KnowledgeBase (long-form articles) — FAQs are short, precise answers
CREATE TABLE IF NOT EXISTS "ChatFAQ" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "botId"       TEXT NOT NULL REFERENCES "ChatBot"(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',  -- 'support' | 'sales' | 'general'
  tags          TEXT[],
  active        BOOLEAN NOT NULL DEFAULT true,
  "searchVector" TSVECTOR,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faq_bot_idx ON "ChatFAQ"("botId");
CREATE INDEX IF NOT EXISTS faq_search_idx ON "ChatFAQ" USING GIN("searchVector");

CREATE OR REPLACE FUNCTION update_faq_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english',
    COALESCE(NEW.question, '') || ' ' || COALESCE(NEW.answer, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS faq_search_vector_trigger ON "ChatFAQ";
CREATE TRIGGER faq_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "ChatFAQ"
  FOR EACH ROW EXECUTE FUNCTION update_faq_search_vector();

-- ChatBotRule: explicit rules/guardrails for the bot (separate from system prompt)
-- Makes rules manageable without editing the full system prompt
CREATE TABLE IF NOT EXISTS "ChatBotRule" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "botId"     TEXT NOT NULL REFERENCES "ChatBot"(id) ON DELETE CASCADE,
  rule        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'behaviour',  -- 'behaviour' | 'tone' | 'escalation' | 'restriction'
  priority    INTEGER NOT NULL DEFAULT 0,          -- higher = applied first in prompt
  active      BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_bot_idx ON "ChatBotRule"("botId");

-- Seed default GUSI rules
INSERT INTO "ChatBotRule" ("botId", rule, category, priority) VALUES
  ('default-bot', 'Always refer to the organisation as "Global Ultrasound Institute" or "GUSI" — never use abbreviations like "GUS" or "the institute".', 'tone', 100),
  ('default-bot', 'When discussing courses or programs, always emphasise the clinical excellence and hands-on training approach.', 'tone', 90),
  ('default-bot', 'Never quote specific prices unless they are explicitly provided in the knowledge base. Instead say "Please contact us for current pricing".', 'restriction', 80),
  ('default-bot', 'If a visitor asks about enrolment, always offer to connect them with the admissions team and capture their contact details.', 'escalation', 70),
  ('default-bot', 'If a visitor is a healthcare professional, acknowledge their background and tailor responses to their clinical context.', 'behaviour', 60),
  ('default-bot', 'Never make medical diagnoses or give clinical advice. Redirect clinical questions to qualified practitioners.', 'restriction', 100),
  ('default-bot', 'If the visitor seems frustrated or upset, acknowledge their concern empathetically before providing information.', 'behaviour', 50),
  ('default-bot', 'Always end conversations by asking if there is anything else you can help with.', 'behaviour', 10)
ON CONFLICT DO NOTHING;
