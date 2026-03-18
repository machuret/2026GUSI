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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sign in to get a real user JWT
const testEmail = env.TEST_USER_EMAIL;
const testPassword = env.TEST_USER_PASSWORD;

if (!testEmail || !testPassword) {
  console.log("No TEST_USER_EMAIL / TEST_USER_PASSWORD in .env.local");
  console.log("Testing without auth — expect 401 from my function");
  
  // Test that gateway at least passes the request through
  const res = await fetch(`${url}/functions/v1/grant-bootstrap`, {
    headers: { Authorization: `Bearer ${anon}` },
  });
  console.log(`Status: ${res.status}`);
  const body = await res.text();
  console.log(`Body: ${body.slice(0, 300)}`);
  process.exit(0);
}

const supabase = createClient(url, anon);
const { data, error } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
if (error) { console.error("Sign-in failed:", error.message); process.exit(1); }

const token = data.session.access_token;
console.log("Got user JWT, testing grant-bootstrap...");

const res = await fetch(`${url}/functions/v1/grant-bootstrap`, {
  headers: {
    Authorization: `Bearer ${token}`,
    apikey: anon,
  },
});
console.log(`Status: ${res.status}`);
const body = await res.json();
console.log(`Grants: ${body.grants?.length ?? "N/A"}`);
console.log(`Company: ${body.company?.name ?? "N/A"}`);
if (body.error) console.error(`Error: ${body.error}`);
