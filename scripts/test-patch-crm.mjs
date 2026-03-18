/**
 * Test the PATCH /api/grants/[id] endpoint locally.
 * Simulates exactly what the CRM "Remove" button does.
 * Run: node scripts/test-patch-crm.mjs
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// 1. Find a grant with crmStatus set
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { data: crmGrants } = await db.from("Grant").select("id, name, crmStatus").eq("companyId", "demo").not("crmStatus", "is", null).limit(1);

if (!crmGrants?.length) { console.error("No grants with crmStatus set"); process.exit(1); }
const testGrant = crmGrants[0];
console.log(`\nTest grant: ${testGrant.id.slice(0,8)}… name="${testGrant.name.slice(0,40)}" crmStatus="${testGrant.crmStatus}"`);

// 2. Get a real auth token (sign in as test user or use service role)
// For local testing, we'll sign in with a test user if available, or use anon key
// Actually, let's test with the email/password from env if available
const testEmail = env.TEST_USER_EMAIL;
const testPassword = env.TEST_USER_PASSWORD;

let token;
if (testEmail && testPassword) {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await anonClient.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (error) { console.error("Auth failed:", error.message); process.exit(1); }
  token = data.session.access_token;
  console.log("✅ Got auth token via sign-in");
} else {
  // Use service role key as Bearer token (won't work with requireEdgeAuth since it validates via /auth/v1/user)
  console.log("⚠ No TEST_USER_EMAIL/PASSWORD in .env.local. Testing without auth (will likely get 401).");
  token = null;
}

// 3. Call PATCH endpoint on local server
const PORT = 3002; // Adjust if different
const url = `http://localhost:${PORT}/api/grants/${testGrant.id}`;
console.log(`\nPATCH ${url}`);
console.log(`Body: ${JSON.stringify({ crmStatus: null })}`);

try {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ crmStatus: null }),
  });

  console.log(`\nResponse: ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log("Body:", JSON.stringify(body, null, 2));

  if (body.success) {
    console.log(`\n✅ PATCH succeeded! crmStatus is now: ${body.grant?.crmStatus}`);
    // Restore
    await db.from("Grant").update({ crmStatus: testGrant.crmStatus, updatedAt: new Date().toISOString() }).eq("id", testGrant.id);
    console.log(`Restored crmStatus="${testGrant.crmStatus}"`);
  } else {
    console.error(`\n❌ PATCH failed: ${body.error}`);
  }
} catch (err) {
  console.error("\n❌ Fetch error:", err.message);
}

// 4. Also test hitting the PRODUCTION endpoint
console.log("\n═══ Testing PRODUCTION endpoint ═══");
const prodUrl = `https://www.theaibrain.info/api/grants/${testGrant.id}`;
console.log(`PATCH ${prodUrl}`);
try {
  const res = await fetch(prodUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ crmStatus: null }),
  });
  console.log(`Response: ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log("Body:", JSON.stringify(body, null, 2));

  if (body.success) {
    console.log(`\n✅ PRODUCTION PATCH succeeded! Restoring...`);
    await db.from("Grant").update({ crmStatus: testGrant.crmStatus, updatedAt: new Date().toISOString() }).eq("id", testGrant.id);
    console.log(`Restored crmStatus="${testGrant.crmStatus}"`);
  } else {
    console.error(`\n❌ PRODUCTION PATCH failed: ${body.error}`);
  }
} catch (err) {
  console.error("❌ Production fetch error:", err.message);
}
