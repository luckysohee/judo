/**
 * Probes whether key Studio RPCs exist on the linked Supabase project.
 * Usage: node scripts/check-supabase-rpc.mjs
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY from .env (repo root).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env at", envPath);
    process.exit(2);
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const RPCS = [
  "studio_archive_extended_insights",
  "studio_curator_overlap_places",
  "studio_curator_overlap_place_count",
  "studio_week_save_insights",
];

const dummy = "00000000-0000-4000-8000-000000000001";

async function probe(name) {
  const { data, error } = await sb.rpc(name, { p_curator_id: dummy });
  const msg = error?.message ?? "";
  const code = error?.code ?? "";
  if (
    /Could not find the function/i.test(msg) ||
    /schema cache/i.test(msg) ||
    code === "PGRST202"
  ) {
    return { name, exists: false, detail: msg.slice(0, 200) };
  }
  if (/does not exist/i.test(msg) && /function/i.test(msg)) {
    return { name, exists: false, detail: msg.slice(0, 200) };
  }
  return {
    name,
    exists: true,
    sample: data === null || data === undefined ? null : typeof data,
    note: error
      ? `callable but error (often expected with dummy id): ${code} ${msg.slice(0, 120)}`
      : "returned data",
  };
}

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid url)";
  }
})();

console.log("Project host:", host);
for (const n of RPCS) {
  const r = await probe(n);
  console.log(JSON.stringify(r, null, 2));
}
