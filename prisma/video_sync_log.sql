-- Track video sync history
CREATE TABLE IF NOT EXISTS "VideoSyncLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL DEFAULT 'demo',
  "type" TEXT NOT NULL DEFAULT 'videos', -- 'videos' or 'transcripts'
  "status" TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed'
  "synced" INT NOT NULL DEFAULT 0,
  "updated" INT NOT NULL DEFAULT 0,
  "errors" INT NOT NULL DEFAULT 0,
  "totalProcessed" INT NOT NULL DEFAULT 0,
  "durationMs" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "VideoSyncLog_companyId_idx" ON "VideoSyncLog" ("companyId");
CREATE INDEX IF NOT EXISTS "VideoSyncLog_type_idx" ON "VideoSyncLog" ("type");

ALTER TABLE "VideoSyncLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_sync_log_select" ON "VideoSyncLog" FOR SELECT USING (true);
CREATE POLICY "video_sync_log_insert" ON "VideoSyncLog" FOR INSERT WITH CHECK (true);
