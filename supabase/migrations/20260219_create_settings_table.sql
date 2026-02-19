create table if not exists "Setting" (
  id          text primary key default gen_random_uuid()::text,
  "companyId" text not null,
  key         text not null,
  value       text not null default '',
  "updatedAt" timestamptz not null default now(),
  unique ("companyId", key)
);

create index if not exists "Setting_companyId_idx" on "Setting" ("companyId");
