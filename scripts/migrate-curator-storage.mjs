#!/usr/bin/env node
/**
 * Mumbai Storage → Seoul NEW_JUDO bucket 복사
 * (DB dump에는 행만 있고 파일은 포함 안 됨)
 *
 * 공개 버킷이므로 Mumbai service role 없이 공개 URL로 다운로드 가능.
 *
 * 사용:
 *   node --env-file=.env scripts/migrate-curator-storage.mjs
 *
 * 또는:
 *   export MUMBAI_SUPABASE_URL=https://juordxxsjecjmgmbnzox.supabase.co
 *   export SEOUL_SUPABASE_URL=https://myawdyvnecwpolddswus.supabase.co
 *   export SEOUL_SERVICE_ROLE_KEY=...
 *   node scripts/migrate-curator-storage.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUCKET = "curator-place-photos";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DUMP_PATH = join(ROOT, ".supabase-migration-dumps/mumbai_public.sql");

function req(name, fallback = "") {
  const v = String(process.env[name] || fallback).trim();
  if (!v) throw new Error(`환경변수 ${name} 필요`);
  return v;
}

function extractPathsFromDump(sqlText) {
  const paths = new Set();
  const re = /curator-place-photos\/([^"'\s)]+)/g;
  let m;
  while ((m = re.exec(sqlText))) {
    const path = decodeURIComponent(m[1]);
    if (path && !path.includes("..")) paths.add(path);
  }

  const copyStart = sqlText.indexOf(
    "COPY public.curator_place_photos (id, curator_id, kakao_place_id, place_id, storage_path, created_at)"
  );
  if (copyStart >= 0) {
    const body = sqlText.slice(copyStart);
    const end = body.indexOf("\n\\.\n");
    const rows = end >= 0 ? body.slice(0, end).split("\n").slice(1) : [];
    for (const row of rows) {
      if (!row.trim() || row.startsWith("--")) continue;
      const cols = row.split("\t");
      const storagePath = cols[4]?.trim();
      if (storagePath && storagePath !== "\\N" && !storagePath.includes("..")) {
        paths.add(storagePath);
      }
    }
  }

  return [...paths];
}

async function listAllFiles(client, prefix = "") {
  const out = [];
  const stack = [prefix];
  while (stack.length) {
    const dir = stack.pop();
    const { data, error } = await client.storage.from(BUCKET).list(dir, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const item of data || []) {
      const path = dir ? `${dir}/${item.name}` : item.name;
      if (item.id == null) stack.push(path);
      else out.push(path);
    }
  }
  return out;
}

async function downloadFromMumbai(mumbaiBase, path) {
  const url = `${mumbaiBase.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const blob = await res.blob();
  return { blob, contentType: res.headers.get("content-type") || blob.type };
}

async function main() {
  const mumbaiBase = req(
    "MUMBAI_SUPABASE_URL",
    "https://juordxxsjecjmgmbnzox.supabase.co"
  );
  const seoulUrl = req("SEOUL_SUPABASE_URL", process.env.VITE_SUPABASE_URL);
  const seoulKey = req(
    "SEOUL_SERVICE_ROLE_KEY",
    process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );

  const seoul = createClient(seoulUrl, seoulKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let paths = [];
  const mumbaiKey = String(process.env.MUMBAI_SERVICE_ROLE_KEY || "").trim();
  if (mumbaiKey) {
    console.log(`📦 ${BUCKET} 파일 목록 (Mumbai API)...`);
    const mumbai = createClient(mumbaiBase, mumbaiKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    paths = await listAllFiles(mumbai);
  } else {
    console.log(`📦 dump에서 storage 경로 추출 → ${DUMP_PATH}`);
    const sql = readFileSync(DUMP_PATH, "utf8");
    paths = extractPathsFromDump(sql);
  }

  console.log(`   ${paths.length}개 경로`);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const path of paths) {
    const { data: existing } = await seoul.storage.from(BUCKET).download(path);
    if (existing && existing.size > 0) {
      skip += 1;
      continue;
    }

    try {
      const { blob, contentType } = await downloadFromMumbai(mumbaiBase, path);
      const { error: upErr } = await seoul.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: contentType || "application/octet-stream",
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      ok += 1;
      if (ok % 5 === 0) console.log(`   ... ${ok}개 복사됨`);
    } catch (e) {
      console.warn("❌", path, e?.message || e);
      fail += 1;
    }
  }

  console.log(`✅ 완료 — 복사 ${ok}, 스킵 ${skip}, 실패 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
