import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
const raw = readFileSync(".env.local", "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Check ALL grants with crmStatus set (any companyId)
const { data: all } = await db.from("Grant").select("id, name, crmStatus, companyId").not("crmStatus", "is", null);
console.log(`ALL grants with crmStatus (any company): ${all.length}`);
for (const g of all) {
  console.log(`  ${g.id.slice(0, 8)} | company=${g.companyId} | ${g.crmStatus.padEnd(12)} | ${g.name.slice(0, 50)}`);
}

// Also check total grants for demo company
const { data: demo, count } = await db.from("Grant").select("id, crmStatus", { count: "exact" }).eq("companyId", "demo");
const withCrm = demo.filter(g => g.crmStatus != null);
console.log(`\nDemo company: ${demo.length} total grants, ${withCrm.length} with crmStatus set`);
if (withCrm.length > 0) {
  for (const g of withCrm) console.log(`  ${g.id.slice(0, 8)} | ${g.crmStatus}`);
}
