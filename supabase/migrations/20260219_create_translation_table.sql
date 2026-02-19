-- Create Translation table for storing translated content
create table if not exists "Translation" (
  id             text primary key default gen_random_uuid()::text,
  "companyId"    text not null references "Company"(id) on delete cascade,
  title          text not null,
  "originalText" text not null default '',
  "translatedText" text not null,
  language       text not null,
  category       text not null default 'General',
  "publishedAt"  timestamptz not null default now(),
  "createdAt"    timestamptz not null default now()
);

create index if not exists "Translation_companyId_idx" on "Translation"("companyId");
create index if not exists "Translation_language_idx" on "Translation"(language);
create index if not exists "Translation_createdAt_idx" on "Translation"("createdAt");
