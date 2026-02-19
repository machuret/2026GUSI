create table if not exists "AiUsageLog" (
  id            text primary key default gen_random_uuid()::text,
  "companyId"   text not null default 'demo',
  "userId"      text,
  model         text not null,
  feature       text not null,
  "promptTokens"     integer not null default 0,
  "completionTokens" integer not null default 0,
  "totalTokens"      integer not null default 0,
  "costUsd"     numeric(10, 6) not null default 0,
  "createdAt"   timestamptz not null default now()
);
create index if not exists "AiUsageLog_companyId_idx" on "AiUsageLog"("companyId");
create index if not exists "AiUsageLog_createdAt_idx" on "AiUsageLog"("createdAt" desc);
create index if not exists "AiUsageLog_feature_idx"   on "AiUsageLog"(feature);
