-- Add rating fields to Idea table
alter table "Idea"
  add column if not exists "rating" text check ("rating" in ('up', 'down')) default null,
  add column if not exists "ratingFeedback" text default null;

-- Add 'done' as a valid status (extend existing check if any, otherwise just document)
-- status values: saved | approved | archived | done
