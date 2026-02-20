-- Ideas table: stores AI-generated content ideas
create table if not exists "Idea" (
  id            text primary key default gen_random_uuid()::text,
  "companyId"   text not null references "Company"(id) on delete cascade,
  title         text not null,
  summary       text not null,
  "contentType" text not null,  -- newsletter | social_media | blog_post
  category      text not null,  -- Education | Touching Base | Company Win | Company Blog Post
  status        text not null default 'saved',  -- saved | approved | archived
  "contentId"   text,           -- FK to the generated content row (set on approve)
  "contentTable" text,          -- which content table the draft lives in
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

create index if not exists "Idea_companyId_idx" on "Idea"("companyId");
create index if not exists "Idea_status_idx"    on "Idea"(status);
