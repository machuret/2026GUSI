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
}

/**
 * Fetch history from ALL 9 tables for a company, merged & sorted by createdAt desc.
 * Uses DB-level LIMIT per table to avoid loading all rows into memory.
 * Each table fetches (page * limit) rows so we have enough to sort and slice correctly.
 */
export async function getAllHistory(
  companyId: string,
  { page = 1, limit = 50 }: HistoryOptions = {}
): Promise<{ items: ContentWithMeta[]; total: number }> {
  // Fetch enough rows from each table to cover the requested page.
  // We over-fetch slightly (page * limit per table) to allow cross-table sorting.
  const fetchLimit = page * limit + limit;

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
    // Count total across all tables in parallel
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

  const start = (page - 1) * limit;
  return { items: all.slice(start, start + limit), total };
}

/**
 * Find a content record across ALL tables by id.
 * Runs all 9 queries in parallel — much faster than sequential loop.
 */
export async function findContentById(id: string) {
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
