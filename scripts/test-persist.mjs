/**
 * Test if crmStatus=null actually persists in the DB.
 * Simulates exactly what the PATCH route does.
 * Run: node scripts/test-persist.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 1. Find a grant with crmStatus set
const { data: before } = await db.from("Grant").select("id, name, crmStatus").eq("companyId", "demo").not("crmStatus", "is", null).limit(1);
if (!before?.length) { console.log("No CRM grants found"); process.exit(0); }
const g = before[0];
console.log(`BEFORE: id=${g.id.slice(0,8)} crmStatus="${g.crmStatus}" name="${g.name.slice(0,40)}"`);

// 2. Update crmStatus to null — same query as PATCH route
const { data: updated, error } = await db
  .from("Grant")
  .update({ crmStatus: null, updatedAt: new Date().toISOString() })
  .eq("id", g.id)
  .select("id, crmStatus")
  .single();

console.log(`UPDATE result:`, { updated, error });

// 3. Read back immediately
const { data: after } = await db.from("Grant").select("id, crmStatus").eq("id", g.id).single();
console.log(`AFTER READ: crmStatus=${JSON.stringify(after?.crmStatus)}`);

// 4. Wait 2 seconds and read again (check triggers)
await new Promise(r => setTimeout(r, 2000));
const { data: after2 } = await db.from("Grant").select("id, crmStatus").eq("id", g.id).single();
console.log(`AFTER 2s:   crmStatus=${JSON.stringify(after2?.crmStatus)}`);

if (after2?.crmStatus === null) {
  console.log("\n✅ DB update PERSISTED — crmStatus is null");
  // Restore
  await db.from("Grant").update({ crmStatus: g.crmStatus }).eq("id", g.id);
  console.log(`Restored to "${g.crmStatus}"`);
} else {
  console.log(`\n❌ DB update DID NOT PERSIST — crmStatus is "${after2?.crmStatus}"`);
  console.log("Something is resetting it! Check triggers or RLS policies.");

  // List all triggers on Grant table
  const { data: triggers } = await db.rpc("exec_sql", {
    query: `SELECT trigger_name, event_manipulation, action_statement 
            FROM information_schema.triggers 
            WHERE event_object_table = 'Grant'`
  }).catch(() => ({ data: null }));

  if (triggers) {
    console.log("\nTriggers on Grant table:");
    for (const t of triggers) {
      console.log(`  ${t.trigger_name} (${t.event_manipulation}): ${t.action_statement.slice(0, 100)}`);
    }
  }
}
