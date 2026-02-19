alter table "CompanyInfo"
  add column if not exists "companyName" text,
  add column if not exists website      text,
  add column if not exists "linkedinUrl"  text,
  add column if not exists "youtubeUrl"   text,
  add column if not exists "facebookUrl"  text,
  add column if not exists hashtags     text,
  add column if not exists products     text;
