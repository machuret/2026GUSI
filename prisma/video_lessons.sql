-- VideoLesson: stores course lesson schedules with Vimeo references
-- Status (transcript/translation/audio) is resolved at query time by joining with Video + Translation tables

CREATE TABLE IF NOT EXISTS "VideoLesson" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId"       TEXT NOT NULL DEFAULT 'demo',
  "courseName"      TEXT NOT NULL,
  "module"          TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "durationLabel"   TEXT NOT NULL DEFAULT '0:00',
  "vimeoUrl"        TEXT NOT NULL,
  "vimeoId"         TEXT NOT NULL,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "hasAudio"        BOOLEAN NOT NULL DEFAULT false,
  "audioUrl"        TEXT,
  "createdAt"       TIMESTAMPTZ DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videolesson_company   ON "VideoLesson" ("companyId");
CREATE INDEX IF NOT EXISTS idx_videolesson_course    ON "VideoLesson" ("companyId", "courseName");
CREATE INDEX IF NOT EXISTS idx_videolesson_vimeoid   ON "VideoLesson" ("vimeoId");
CREATE INDEX IF NOT EXISTS idx_videolesson_sortorder ON "VideoLesson" ("courseName", "sortOrder");

-- RLS
ALTER TABLE "VideoLesson" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "videolesson_select" ON "VideoLesson";
DROP POLICY IF EXISTS "videolesson_insert" ON "VideoLesson";
DROP POLICY IF EXISTS "videolesson_update" ON "VideoLesson";
DROP POLICY IF EXISTS "videolesson_delete" ON "VideoLesson";
CREATE POLICY "videolesson_select" ON "VideoLesson" FOR SELECT USING (true);
CREATE POLICY "videolesson_insert" ON "VideoLesson" FOR INSERT WITH CHECK (true);
CREATE POLICY "videolesson_update" ON "VideoLesson" FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "videolesson_delete" ON "VideoLesson" FOR DELETE USING (true);
