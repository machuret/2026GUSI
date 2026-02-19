import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(10, "SUPABASE_SERVICE_ROLE_KEY is missing"),
  OPENAI_API_KEY:                z.string().startsWith("sk-", "OPENAI_API_KEY must start with sk-"),
  APIFY_API_TOKEN:               z.string().min(10, "APIFY_API_TOKEN is missing").optional(),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validates all required environment variables at first call.
 * Throws a descriptive error at startup if anything is missing or malformed.
 * Call this at the top of any API route that needs env vars.
 */
export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:     process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY:                process.env.OPENAI_API_KEY,
    APIFY_API_TOKEN:               process.env.APIFY_API_TOKEN,
  });

  if (!result.success) {
    const missing = result.error.errors.map((e) => `  • ${e.path[0]}: ${e.message}`).join("\n");
    throw new Error(`Missing or invalid environment variables:\n${missing}`);
  }

  _env = result.data;
  return _env;
}
