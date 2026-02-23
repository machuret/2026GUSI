-- Fix Idea_category_check to include all categories (Facts, Motivational)
-- Ensure contentType check includes "carousel"
-- Add style column for tone/voice

-- Drop existing check constraints if they exist
alter table "Idea" drop constraint if exists "Idea_category_check";
alter table "Idea" drop constraint if exists "Idea_contentType_check";

-- Recreate with full set of allowed values
alter table "Idea" add constraint "Idea_category_check"
  check (category in ('Education', 'Touching Base', 'Company Win', 'Company Blog Post', 'Carousel Topic', 'Facts', 'Motivational'));

alter table "Idea" add constraint "Idea_contentType_check"
  check ("contentType" in ('newsletter', 'social_media', 'blog_post', 'carousel'));

-- Add style column (nullable — old ideas won't have one)
alter table "Idea" add column if not exists style text;
