-- Author profiles
create table if not exists "Author" (
  id           text primary key default gen_random_uuid()::text,
  "companyId"  text not null references "Company"(id) on delete cascade,
  name         text not null,
  bio          text,
  avatar       text,
  "postCount"  integer not null default 0,
  "wordCount"  integer not null default 0,
  "analysedAt" timestamptz,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);
create index if not exists "Author_companyId_idx" on "Author"("companyId");

-- Raw content samples uploaded for each author
create table if not exists "AuthorPost" (
  id           text primary key default gen_random_uuid()::text,
  "authorId"   text not null references "Author"(id) on delete cascade,
  "companyId"  text not null,
  title        text,
  body         text not null,
  "contentType" text not null default 'blog',
  platform     text not null default 'website',
  "wordCount"  integer not null default 0,
  "createdAt"  timestamptz not null default now()
);
create index if not exists "AuthorPost_authorId_idx" on "AuthorPost"("authorId");

-- Deep style profile per author (AI-generated)
create table if not exists "AuthorStyleProfile" (
  id                  text primary key default gen_random_uuid()::text,
  "authorId"          text not null unique references "Author"(id) on delete cascade,
  "companyId"         text not null,
  tone                text,
  "avgWordCount"      integer,
  vocabulary          jsonb default '[]',
  "commonPhrases"     jsonb default '[]',
  "preferredFormats"  jsonb default '[]',
  "sentencePatterns"  jsonb default '[]',
  "rhetoricalDevices" jsonb default '[]',
  "openingHooks"      jsonb default '[]',
  "closingPatterns"   jsonb default '[]',
  "emotionalRange"    text,
  "uniqueQuirks"      text,
  summary             text,
  "systemPrompt"      text,
  "tokenCount"        integer default 0,
  "updatedAt"         timestamptz not null default now()
);
