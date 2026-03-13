-- Add transcript column to Video table for storing Vimeo caption/subtitle text
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "transcript" TEXT DEFAULT NULL;
