-- Add missing userId column to Idea table
alter table "Idea" add column if not exists "userId" text references "User"(id) on delete set null;
create index if not exists "Idea_userId_idx" on "Idea"("userId");
