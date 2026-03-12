-- Video categories for organizing Vimeo content
CREATE TABLE IF NOT EXISTS "VideoCategory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL DEFAULT 'demo',
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "VideoCategory_companyId_idx" ON "VideoCategory" ("companyId");

-- Videos synced from Vimeo, assigned to categories
CREATE TABLE IF NOT EXISTS "Video" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL DEFAULT 'demo',
  "categoryId" TEXT REFERENCES "VideoCategory"("id") ON DELETE SET NULL,
  "vimeoId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "thumbnailUrl" TEXT NOT NULL DEFAULT '',
  "duration" INT NOT NULL DEFAULT 0,
  "vimeoUrl" TEXT NOT NULL DEFAULT '',
  "embedHtml" TEXT NOT NULL DEFAULT '',
  "width" INT NOT NULL DEFAULT 0,
  "height" INT NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'available',
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "publishedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("companyId", "vimeoId")
);

CREATE INDEX IF NOT EXISTS "Video_companyId_idx" ON "Video" ("companyId");
CREATE INDEX IF NOT EXISTS "Video_categoryId_idx" ON "Video" ("categoryId");
CREATE INDEX IF NOT EXISTS "Video_vimeoId_idx" ON "Video" ("vimeoId");

-- RLS
ALTER TABLE "VideoCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_category_select" ON "VideoCategory" FOR SELECT USING (true);
CREATE POLICY "video_category_insert" ON "VideoCategory" FOR INSERT WITH CHECK (true);
CREATE POLICY "video_category_update" ON "VideoCategory" FOR UPDATE USING (true);
CREATE POLICY "video_category_delete" ON "VideoCategory" FOR DELETE USING (true);

CREATE POLICY "video_select" ON "Video" FOR SELECT USING (true);
CREATE POLICY "video_insert" ON "Video" FOR INSERT WITH CHECK (true);
CREATE POLICY "video_update" ON "Video" FOR UPDATE USING (true);
CREATE POLICY "video_delete" ON "Video" FOR DELETE USING (true);
