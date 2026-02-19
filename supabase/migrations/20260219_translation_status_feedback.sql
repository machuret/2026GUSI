-- Add status and feedback columns to Translation table
alter table "Translation"
  add column if not exists status text not null default 'draft',
  add column if not exists feedback text;

create index if not exists "Translation_status_idx" on "Translation"(status);
