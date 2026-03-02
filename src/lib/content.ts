import { db } from "./db";

export interface ContentRecord {
  id: string;
  companyId: string;
  userId: string;
  prompt: string;
  output: string;
  status: string;
  feedback?: string | null;
  revisionOf?: string | null;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ContentWithMeta extends ContentRecord {
  category: string;
  categoryLabel: string;
  user?: { name: string; email: string } | null;
  auditPassed?: boolean | null;
}

/**
 * The 9 content categories — each maps to its own Supabase table.
 * Table names use the exact Prisma-generated names (PascalCase).
 */
export const CATEGORIES = [
  { key: "newsletter",     label: "Newsletter",     table: "Newsletter" },
  { key: "offer",          label: "Offer",          table: "Offer" },
  { key: "webinar",        label: "Webinar",        table: "Webinar" },
  { key: "social_media",   label: "Social Media",   table: "SocialMedia" },
  { key: "announcement",   label: "Announcement",   table: "Announcement" },
  { key: "blog_post",      label: "Blog Post",      table: "BlogPost" },
  { key: "course_content", label: "Course Content", table: "CourseContent" },
  { key: "sales_page",     label: "Sales Page",     table: "SalesPage" },
  { key: "cold_email",     label: "Cold Email",     table: "ColdEmail" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

function getTable(category: string): string {
  const cat = CATEGORIES.find((c) => c.key === category);
  if (!cat) throw new Error(`Invalid content category: "${category}"`);
  return cat.table;
}

/**
 * Create a new content record in the correct category table.
 */
export async function createContent(category: string, data: Record<string, unknown>) {
  const table = getTable(category);
  const { data: record, error } = await db.from(table).insert(data).select().single();
  if (error) throw new Error(`createContent(${category}): ${error.message}`);
  return record as ContentRecord;
}

/**
 * Update a content record in the correct category table.
 */
export async function updateContent(category: string, id: string, data: Record<string, unknown>) {
  const table = getTable(category);
  const { data: record, error } = await db.from(table).update(data).eq("id", id).select().single();
  if (error) throw new Error(`updateContent(${category}): ${error.message}`);
  return record as ContentRecord;
}

export interface HistoryOptions {
  page?: number;
  limit?: number;
  category?: string;
}

/**
 * Fetch history for a company.
 *
 * When `category` is provided: queries a single table with DB-level LIMIT+OFFSET
 * — zero in-memory sorting needed, scales to any number of rows.
 *
 * When no category: queries all 9 tables with a per-table fetch cap of
 * (page * limit) rows, merges in memory, then slices. This is acceptable
 * for the first few pages; for deep pagination always pass a category filter.
 */
export async function getAllHistory(
  companyId: string,
  { page = 1, limit = 50, category }: HistoryOptions = {}
): Promise<{ items: ContentWithMeta[]; total: number }> {
  const offset = (page - 1) * limit;

  // ── Single-category path: true DB pagination, no in-memory work ──────────
  if (category) {
    const cat = CATEGORIES.find((c) => c.key === category);
    if (!cat) throw new Error(`Invalid content category: "${category}"`);

    const [{ data: items }, { count }] = await Promise.all([
      db
        .from(cat.table)
        .select("*, user:User(name, email)")
        .eq("companyId", companyId)
        .order("createdAt", { ascending: false })
        .range(offset, offset + limit - 1),
      db
        .from(cat.table)
        .select("id", { count: "exact", head: true })
        .eq("companyId", companyId),
    ]);

    return {
      items: (items ?? []).map((item) => ({
        ...(item as ContentRecord),
        category: cat.key,
        categoryLabel: cat.label,
      })),
      total: count ?? 0,
    };
  }

  // ── All-categories path: cap per-table fetch, merge, slice ───────────────
  // Fetch enough rows from each table to cover the requested page.
  // Hard cap at 500 per table to prevent accidental full-table scans.
  const fetchLimit = Math.min(page * limit, 500);

  const [results, countResults] = await Promise.all([
    Promise.all(
      CATEGORIES.map(async (cat) => {
        const { data: items } = await db
          .from(cat.table)
          .select("*, user:User(name, email)")
          .eq("companyId", companyId)
          .order("createdAt", { ascending: false })
          .limit(fetchLimit);

        return (items ?? []).map((item) => ({
          ...(item as ContentRecord),
          category: cat.key,
          categoryLabel: cat.label,
        }));
      })
    ),
    Promise.all(
      CATEGORIES.map(async (cat) => {
        const { count } = await db
          .from(cat.table)
          .select("id", { count: "exact", head: true })
          .eq("companyId", companyId);
        return count ?? 0;
      })
    ),
  ]);

  const total = countResults.reduce((sum, c) => sum + c, 0);
  const all = results.flat().sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return { items: all.slice(offset, offset + limit), total };
}

export interface LibraryOptions {
  page?: number;
  limit?: number;
  category?: string;   // filter to one category key
  status?: string;     // "APPROVED" | "PUBLISHED" | "all" (default: both)
  search?: string;
}

/**
 * Fetch library items — only APPROVED and PUBLISHED, not soft-deleted.
 * Supports category, status, search, and pagination.
 */
export async function getLibrary(
  companyId: string,
  { page = 1, limit = 50, category, status, search }: LibraryOptions = {}
): Promise<{ items: ContentWithMeta[]; total: number }> {
  const fetchLimit = page * limit;

  const targetCategories = category
    ? CATEGORIES.filter((c) => c.key === category)
    : CATEGORIES;

  // ContentStatus enum: PENDING, APPROVED, REJECTED, REVISED (PUBLISHED may not exist yet)
  // Use .eq per status instead of .in to avoid Postgres enum errors for missing values
  const wantedStatuses = !status || status === "all"
    ? ["APPROVED", "PUBLISHED"]
    : [status];

  const [results, countResults] = await Promise.all([
    Promise.all(
      targetCategories.flatMap((cat) =>
        wantedStatuses.map(async (s) => {
          let q = db
            .from(cat.table)
            .select("*, user:User(name, email)")
            .eq("companyId", companyId)
            .eq("status", s)
            .order("createdAt", { ascending: false })
            .limit(fetchLimit);

          if (search) {
            q = q.ilike("output", `%${search}%`);
          }

          const { data: items, error } = await q;
          if (error) {
            // Silently skip — status value may not exist in enum yet
            return [];
          }
          const filtered = (items ?? []).filter((item: Record<string, unknown>) => !item.deletedAt);
          return filtered.map((item) => ({
            ...(item as ContentRecord),
            category: cat.key,
            categoryLabel: cat.label,
          }));
        })
      )
    ),
    Promise.all(
      targetCategories.flatMap((cat) =>
        wantedStatuses.map(async (s) => {
          let q = db
            .from(cat.table)
            .select("id", { count: "exact", head: true })
            .eq("companyId", companyId)
            .eq("status", s);

          if (search) {
            q = q.ilike("output", `%${search}%`);
          }

          const { count, error } = await q;
          if (error) return 0;
          return count ?? 0;
        })
      )
    ),
  ]);

  const total = countResults.reduce((sum, c) => sum + c, 0);
  const all = results.flat().sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const start = (page - 1) * limit;
  return { items: all.slice(start, start + limit), total };
}

/**
 * Find a content record by id.
 * If categoryHint is provided, queries only that table (1 query).
 * Otherwise falls back to searching all 9 tables in parallel.
 */
export async function findContentById(id: string, categoryHint?: string) {
  if (categoryHint) {
    const cat = CATEGORIES.find((c) => c.key === categoryHint);
    if (cat) {
      const { data: record } = await db
        .from(cat.table)
        .select("*, company:Company(name, id)")
        .eq("id", id)
        .maybeSingle();
      return record ? { record: record as ContentRecord, category: cat.key, categoryLabel: cat.label } : null;
    }
  }
  const results = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const { data: record } = await db
        .from(cat.table)
        .select("*, company:Company(name, id)")
        .eq("id", id)
        .maybeSingle();
      return record ? { record: record as ContentRecord, category: cat.key, categoryLabel: cat.label } : null;
    })
  );
  return results.find((r) => r !== null) ?? null;
}
