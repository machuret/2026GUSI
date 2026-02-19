# Full Function Audit Report
_Generated: Feb 19 2026 — tested against live DB + code_

---

## Legend
- ✅ PASS — works correctly
- ⚠️ WARN — works but has a blindspot or fragility
- ❌ FAIL — broken or will break under realistic conditions

---

## 1. `PUT /api/company` — Save Company Info

| Test | Result | Notes |
|---|---|---|
| Save with all fields filled | ✅ FIXED | Was 500 — `updatedAt NOT NULL` with no default. Fixed. |
| Save with empty fields | ✅ | All fields optional in Zod schema |
| Save when CompanyInfo row doesn't exist yet | ✅ | Upsert creates it |
| Company upsert overwrites name/industry | ⚠️ WARN | `ignoreDuplicates: true` now set, but only prevents overwrite on conflict — safe |
| Error shown to user on failure | ❌ FAIL | `handleSave` only checks `res.ok`, never shows the error message to the user. Silent failure. |

**Fix needed:** Company page `handleSave` must show the error response to the user.

---

## 2. `GET /api/company` — Load Company Info

| Test | Result | Notes |
|---|---|---|
| Returns company + info | ✅ | Works |
| No CompanyInfo row yet | ✅ | Returns `info: null`, page shows empty form |
| Auth check | ✅ | `requireAuth()` in place |

---

## 3. `POST /api/content/generate` — Generate Content

| Test | Result | Notes |
|---|---|---|
| Valid category + prompt | ✅ | Works |
| Invalid category | ✅ | Zod enum rejects it |
| Company not found | ✅ | Returns 404 |
| OpenAI returns empty string | ⚠️ WARN | `output` saved as `""` — no guard against empty AI response |
| `createContent` fails (DB error) | ⚠️ WARN | Error thrown but `logActivity` already ran — activity logged for content that wasn't saved |
| `brief` fields not passed | ✅ | Optional, defaults gracefully |
| `extraFields` with invalid keys | ⚠️ WARN | Passed directly to DB insert — could inject unexpected columns |

---

## 4. `POST /api/content/generate-bulk` — Bulk Generate

| Test | Result | Notes |
|---|---|---|
| 1–20 topics | ✅ | Validated by Zod |
| 21+ topics | ✅ | Zod rejects |
| One topic fails, others succeed | ✅ | Per-topic try/catch, partial results returned |
| All topics fail | ✅ | Returns `{ generated: 0, failed: N }` |
| Sequential generation (rate limit safe) | ✅ | Uses `for` loop not `Promise.all` |
| No timeout on bulk (20 × GPT-4o calls) | ❌ FAIL | 20 topics × ~5s each = 100s. Vercel Pro limit is 60s. Will time out on large batches. |

---

## 5. `POST /api/content/generate-ab` — A/B Generate

| Test | Result | Notes |
|---|---|---|
| Generates 2 variants in parallel | ✅ | `Promise.all` on 2 OpenAI calls |
| One variant fails | ❌ FAIL | `Promise.all` rejects entirely — no partial result. User gets 500, both variants lost. |
| Both saved to DB | ✅ | Works |

---

## 6. `POST /api/content/review` — Approve/Reject/Edit/Publish

| Test | Result | Notes |
|---|---|---|
| Approve | ✅ | Sets status APPROVED |
| Reject without feedback | ✅ | Returns 400 |
| Reject with feedback | ✅ | Creates Lesson automatically |
| Edit without output | ✅ | Returns 400 |
| Edit with output | ✅ | Updates content |
| Publish | ✅ | Sets status PUBLISHED |
| Content not found | ✅ | Returns 404 |
| Lesson insert on reject — `Lesson.active` column | ⚠️ WARN | Insert doesn't pass `active` — relies on DB default. Need to verify default exists. |
| `category` param ignored — uses found category | ✅ | `findContentById` resolves the real category |

---

## 7. `POST /api/content/revise` — Revise Rejected Content

| Test | Result | Notes |
|---|---|---|
| Content not found | ✅ | Returns 404 |
| No feedback on original | ⚠️ WARN | `original.feedback` could be null — `allFeedback` becomes empty string, AI has nothing to fix |
| `original.revisionNumber` undefined | ❌ FAIL | `revisionNumber + 1` — if DB column is null/undefined, result is `NaN`. Content saved with `revisionNumber: NaN`. |
| Lessons fetched correctly | ✅ | Parallel fetch, filtered by category |
| `(l as any).severity` cast | ⚠️ WARN | Unsafe cast — if severity is null, `.toUpperCase()` throws |

---

## 8. `POST /api/content/schedule` — Schedule Content

| Test | Result | Notes |
|---|---|---|
| Schedule with valid ISO date | ✅ | Works |
| Clear schedule (null) | ✅ | Passes null |
| Invalid date string | ⚠️ WARN | Zod accepts any string for `scheduledAt` — no datetime validation |
| Content not found | ✅ | Returns 404 |

---

## 9. `GET /api/content/history` — Content History

| Test | Result | Notes |
|---|---|---|
| Returns paginated history | ✅ | Works |
| No companyId | ✅ | Returns 400 |
| Large dataset | ⚠️ WARN | `getAllHistory` fetches ALL rows from all 9 tables then slices in memory — no DB-level pagination. With 10k+ records this will be slow/OOM. |
| page/limit parsing | ✅ | Clamped correctly |

---

## 10. `GET /api/content/stats` — Content Stats

| Test | Result | Notes |
|---|---|---|
| Returns counts per status | ✅ | Works |
| No companyId | ✅ | Returns 400 |
| Fires 45 parallel DB queries (9 tables × 5 statuses) | ⚠️ WARN | Works but hammers Supabase connection pool. Should be a single aggregated SQL query. |

---

## 11. `GET /api/content/calendar` — Calendar View

| Test | Result | Notes |
|---|---|---|
| Returns scheduled content | ✅ | Works |
| `from`/`to` date filtering | ✅ | Applied to query |
| No companyId | ✅ | Returns 400 |
| Items with no `scheduledAt` | ⚠️ WARN | Falls back to `createdAt` for sort — unscheduled items appear in calendar mixed with scheduled ones |

---

## 12. `POST /api/content/ingest` — Ingest Posts/Docs

| Test | Result | Notes |
|---|---|---|
| Ingest posts | ✅ | Works |
| Ingest documents | ✅ | Works |
| Empty posts + docs arrays | ✅ | Returns `{ postsCreated: 0, documentsCreated: 0 }` |
| Company auto-created on ingest | ⚠️ WARN | Creates company with name "My Company" — overwrites real name if company already exists (no `ignoreDuplicates`) |
| `publishedAt` not ISO datetime | ⚠️ WARN | Zod validates `.datetime()` but only if provided — empty string passes |

---

## 13. `POST /api/content/scrape-url` — URL Scraper

| Test | Result | Notes |
|---|---|---|
| Valid URL | ✅ | Works |
| No URL | ✅ | Returns 400 |
| URL times out (>10s) | ✅ | `AbortSignal.timeout(10000)` in place |
| URL returns non-200 | ✅ | Returns 400 |
| No auth check | ❌ FAIL | **No `requireAuth()` call** — anyone can use this endpoint to proxy-fetch any URL through your server |
| Malformed URL | ❌ FAIL | `new URL(url)` throws — caught by outer catch but returns 500 instead of 400 |
| Very large HTML page | ⚠️ WARN | No size limit on response — a 50MB page would be read entirely into memory |

---

## 14. `POST /api/content/parse-file` — File Parser

| Test | Result | Notes |
|---|---|---|
| .txt / .md | ✅ | Works |
| .docx | ✅ | Uses mammoth |
| .pdf | ✅ | Uses pdf-parse |
| Unsupported extension | ✅ | Returns 400 |
| No auth check | ❌ FAIL | **No `requireAuth()` call** — open file parsing endpoint |
| No file size limit | ❌ FAIL | A 500MB PDF upload would be accepted and processed |
| `pdf-parse` uses `require()` | ⚠️ WARN | Dynamic require in ESM context — works but fragile, could break on edge runtime |

---

## 15. `GET /api/content/training-stats` — Training Stats

| Test | Result | Notes |
|---|---|---|
| Returns stats | ✅ | Works |
| No auth check | ❌ FAIL | **No `requireAuth()` call** — open endpoint |
| Fetches ALL ContentPost rows | ⚠️ WARN | No limit — if 10k posts exist, all are loaded into memory for word counting |
| `companyId` defaults to `"demo"` | ⚠️ WARN | Silently uses demo company if param missing — should return 400 |

---

## 16. `GET/POST/DELETE /api/content/comments` — Comments

| Test | Result | Notes |
|---|---|---|
| Get comments for content | ✅ | Works |
| Add comment | ✅ | Works |
| Delete comment | ⚠️ WARN | **No ownership check** — any authenticated user can delete any comment by ID |
| No contentId on GET | ✅ | Returns 400 |
| No id on DELETE | ✅ | Returns 400 |

---

## 17. `GET/POST /api/grants` — Grants CRUD

| Test | Result | Notes |
|---|---|---|
| Get grants | ✅ | Works |
| Create grant | ✅ | Works |
| No companyId on GET | ✅ | Returns 400 |
| `deadlineDate` as invalid date string | ⚠️ WARN | Zod accepts any string — DB column is `date` type, invalid string will 500 |
| `fitScore` out of range | ✅ | Zod validates 1–5 |

---

## 18. `PATCH/DELETE /api/grants/[id]` — Grant Update/Delete

| Test | Result | Notes |
|---|---|---|
| Update grant fields | ✅ | Works |
| Delete grant | ✅ | Works |
| No ownership check | ⚠️ WARN | Any authenticated user can patch/delete any grant by ID |
| Update with invalid `submissionEffort` | ✅ | Zod enum rejects |

---

## 19. `POST /api/grants/analyse` — AI Grant Analysis

| Test | Result | Notes |
|---|---|---|
| Valid grant + DNA | ✅ | Works |
| DNA too short | ✅ | Zod min(20) rejects |
| AI returns malformed JSON | ✅ FIXED | try/catch around JSON.parse now |
| `persistScore` fails | ✅ | Non-fatal, wrapped in try/catch |
| No auth | ❌ FAIL | **No auth check** — open endpoint burns OpenAI credits |

---

## 20. `POST /api/grants/research` — AI Grant Research

| Test | Result | Notes |
|---|---|---|
| Name or URL required | ✅ | Zod refine check |
| AI returns malformed JSON | ✅ FIXED | try/catch now |
| No auth | ❌ FAIL | **No auth check** |

---

## 21. `POST /api/grants/search` — AI Grant Search

| Test | Result | Notes |
|---|---|---|
| Valid filters | ✅ | Works |
| No filters provided | ⚠️ WARN | Returns results but with no meaningful filters — AI guesses |
| AI returns malformed JSON | ✅ FIXED | try/catch now |
| No auth | ❌ FAIL | **No auth check** |

---

## 22. `POST /api/grants/crawl` — AI Grant Crawl

| Test | Result | Notes |
|---|---|---|
| Valid URL | ✅ | Works |
| URL fetch fails | ✅ | Returns error |
| AI returns malformed JSON | ✅ FIXED | try/catch now |
| No auth | ❌ FAIL | **No auth check** |
| No URL size limit | ⚠️ WARN | Large pages loaded fully into memory |

---

## 23. `GET/POST /api/leads` — Leads CRUD

| Test | Result | Notes |
|---|---|---|
| Get leads with filters | ✅ | Works |
| Bulk insert | ✅ | Works |
| Single insert | ✅ | Works |
| No companyId | ✅ | Returns 400 |
| `rating` out of range | ✅ | Zod validates 1–5 |
| Search injection via `ilike` | ✅ | Supabase parameterises — safe |

---

## 24. `PATCH/DELETE /api/leads/[id]` — Lead Update/Delete

| Test | Result | Notes |
|---|---|---|
| Update lead | ✅ | Works |
| Delete lead | ✅ | Works |
| No ownership check | ⚠️ WARN | Any authenticated user can patch/delete any lead by ID |

---

## 25. `POST /api/leads/scrape` — Start Apify Run

| Test | Result | Notes |
|---|---|---|
| Valid sourceId | ✅ | Returns runId immediately |
| Unknown sourceId | ✅ | Returns 400 |
| Apify token missing | ⚠️ WARN | `APIFY_API_TOKEN!` — non-null assertion, will throw at runtime with unhelpful message |
| No auth check | ❌ FAIL | **No auth check** — anyone can trigger Apify runs and burn credits |

---

## 26. `GET /api/leads/scrape` — Poll Apify Run

| Test | Result | Notes |
|---|---|---|
| Poll running run | ✅ | Returns `{ running: true }` |
| Poll completed run | ✅ | Returns leads |
| Poll failed run | ✅ | Returns 500 with status |
| No runId → returns sources | ✅ | Falls back to source list |
| No auth check | ❌ FAIL | **No auth check** |

---

## 27. `GET/POST /api/lessons` — Lessons

| Test | Result | Notes |
|---|---|---|
| Get lessons | ✅ | Works |
| Create lesson | ✅ | Works |
| Empty feedback | ✅ | Zod min(1) rejects |
| Invalid severity | ✅ | Zod enum rejects |
| `user` variable declared but unused in GET | ⚠️ WARN | `const { user, response }` — `user` never used in GET handler |

---

## 28. `PATCH/DELETE /api/lessons/[id]` — Lesson Update/Delete

| Test | Result | Notes |
|---|---|---|
| Toggle active | ✅ | Works |
| Update feedback/severity | ✅ | Works |
| Delete lesson | ✅ | Works |
| Empty patch body | ⚠️ WARN | `patch = {}` — update with empty object is a no-op, returns current record silently |
| Uses `Record<string, any>` | ⚠️ WARN | Should be `Record<string, unknown>` |

---

## 29. `GET/POST /api/prompts` — Prompt Templates

| Test | Result | Notes |
|---|---|---|
| Get prompts | ✅ | Works |
| Create prompt | ✅ FIXED | Was missing `updatedAt` — now included |
| Empty systemPrompt | ✅ | Zod min(1) rejects |

---

## 30. `PATCH/DELETE /api/prompts/[id]` — Prompt Update/Delete

| Test | Result | Notes |
|---|---|---|
| Update prompt | ✅ FIXED | Now includes `updatedAt` |
| Delete prompt | ✅ | Works |
| Empty patch body | ⚠️ WARN | Same as lessons — no-op silently |

---

## 31. `GET/POST /api/users` — User Management

| Test | Result | Notes |
|---|---|---|
| List users (SUPER_ADMIN only) | ✅ | Role check in place |
| Create user | ✅ FIXED | Now includes `updatedAt` |
| Non-admin tries to list | ✅ | Returns 403 |
| Created user has `authId: pending-xxx` | ⚠️ WARN | Placeholder authId — this user can never log in until manually linked in Supabase Auth |

---

## 32. `PATCH /api/users/[id]` — User Update

| Test | Result | Notes |
|---|---|---|
| Update role/active | ✅ FIXED | Now includes `updatedAt` |
| Non-admin tries to update | ✅ | `requireRole` throws |

---

## 33. `POST /api/style/analyze` — Style Analysis

| Test | Result | Notes |
|---|---|---|
| Runs analysis | ✅ | Works |
| Company not found | ✅ | Returns 404 |
| StyleProfile upsert | ✅ FIXED | Now includes `updatedAt` |
| StyleProfile `onConflict: "companyId"` | ⚠️ WARN | Need to verify unique constraint exists on StyleProfile.companyId |

---

## 34. `GET /api/activity` — Activity Log

| Test | Result | Notes |
|---|---|---|
| Returns logs | ✅ | Works |
| Auth check | ✅ | In place |

---

## Summary of Bugs by Severity

### ❌ CRITICAL — Will break in production

| # | Issue | File |
|---|---|---|
| 1 | `scrape-url` has no auth — open proxy | `api/content/scrape-url/route.ts` |
| 2 | `parse-file` has no auth — open file processor + no size limit | `api/content/parse-file/route.ts` |
| 3 | `training-stats` has no auth | `api/content/training-stats/route.ts` |
| 4 | All 4 grants AI routes have no auth — burns OpenAI credits | `api/grants/analyse,research,search,crawl` |
| 5 | `leads/scrape` has no auth — burns Apify credits | `api/leads/scrape/route.ts` |
| 6 | `revise` — `revisionNumber + 1` on null/undefined = NaN saved to DB | `api/content/revise/route.ts` |
| 7 | `generate-ab` — `Promise.all` means one OpenAI failure kills both variants | `api/content/generate-ab/route.ts` |
| 8 | Company page never shows save errors to user | `app/company/page.tsx` |

### ⚠️ MEDIUM — Fragile or will degrade under load

| # | Issue |
|---|---|
| 9 | `getAllHistory` loads ALL rows from 9 tables into memory — no DB pagination |
| 10 | `stats` fires 45 parallel DB queries — should be one SQL aggregate |
| 11 | `generate-bulk` with 20 topics will hit Vercel 60s timeout |
| 12 | `scrape-url` / `crawl` have no response size limit |
| 13 | `ingest` Company upsert overwrites name with "My Company" |
| 14 | `schedule` accepts any string for `scheduledAt` — no datetime validation |
| 15 | `deadlineDate` on grants accepts any string — DB is `date` type, will 500 on bad input |
| 16 | Comments DELETE has no ownership check |
| 17 | Grants/Leads PATCH/DELETE have no ownership check |
| 18 | StyleProfile upsert — need to verify unique constraint on `companyId` |

### ℹ️ LOW — Code quality / minor

| # | Issue |
|---|---|
| 19 | `revise` uses `(l as any).severity` — unsafe cast |
| 20 | `lessons/route.ts` GET declares `user` but never uses it |
| 21 | `lessons/[id]` and `prompts/[id]` use `Record<string, any>` |
| 22 | `training-stats` defaults companyId to `"demo"` silently |
| 23 | `generate` — `extraFields` passed directly to DB with no column whitelist |
| 24 | User created via API has placeholder `authId` — can never log in |
