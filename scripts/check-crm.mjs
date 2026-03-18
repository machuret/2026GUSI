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
const { data } = await db.from("Grant").select("id, name, crmStatus").eq("companyId", "demo").not("crmStatus", "is", null);
console.log(`Grants currently in CRM: ${data.length}`);
for (const g of data) {
  console.log(`  ${g.id.slice(0, 8)} | ${g.crmStatus.padEnd(12)} | ${g.name.slice(0, 50)}`);
}
