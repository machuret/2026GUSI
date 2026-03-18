/**
 * Hit the LIVE production bootstrap endpoint and check for stale CRM grants.
 * This proves whether the no-cache fix is deployed.
 */
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

// Get a valid auth token
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const testEmail = env.TEST_USER_EMAIL;
const testPassword = env.TEST_USER_PASSWORD;

let token = null;
if (testEmail && testPassword) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (!error) token = data.session.access_token;
}

if (!token) {
  console.log("No test credentials — can't auth against production. Checking DB directly instead.");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await db.from("Grant").select("id, crmStatus").eq("companyId", "demo").not("crmStatus", "is", null);
  console.log(`DB: ${data.length} grants with crmStatus set`);
  process.exit(0);
}

console.log("Hitting PRODUCTION bootstrap endpoint...");
const res = await fetch("https://www.theaibrain.info/api/grants/bootstrap", {
  headers: { Authorization: `Bearer ${token}` },
});
console.log(`Status: ${res.status}`);
console.log(`Cache-Control: ${res.headers.get("cache-control")}`);
console.log(`Vercel-CDN-Cache-Control: ${res.headers.get("vercel-cdn-cache-control")}`);
console.log(`X-Vercel-Cache: ${res.headers.get("x-vercel-cache")}`);

const body = await res.json();
const crmGrants = (body.grants || []).filter(g => g.crmStatus != null);
console.log(`\nTotal grants returned: ${body.grants?.length}`);
console.log(`Grants with crmStatus set: ${crmGrants.length}`);
if (crmGrants.length > 0) {
  console.log("\n❌ STALE DATA — these should be null:");
  for (const g of crmGrants) {
    console.log(`  ${g.id.slice(0, 8)} | ${g.crmStatus} | ${g.name.slice(0, 50)}`);
  }
} else {
  console.log("\n✅ NO stale CRM grants — fix is working!");
}
