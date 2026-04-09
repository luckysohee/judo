#!/usr/bin/env node
/**
 * data/한줄평.csv 형식 (장소당 세로 9행, 반복):
 *   POINT / 야장타입 / 분위기 / 주류 / 한줄리뷰 / 주소 / 위도 / 경도 / 네이버URL
 * → 같은 큐레이터의 curator_places + places 를 위·경도로 매칭해 one_line_reason 만 UPDATE.
 *
 * 사용:
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   export YAJANG_CURATOR_USER_ID='<auth user uuid>'
 *   node scripts/import-hanjulpyeong-vertical-csv.mjs "data/한줄평.csv"
 *
 * 큐레이터에 연결된 curator_places 가 아직 없으면 (places 만 있는 경우):
 *   node scripts/import-hanjulpyeong-vertical-csv.mjs "data/한줄평.csv" --from-all-places
 *   → 전체 places 와 위·경도 매칭 후, 행 있으면 UPDATE, 없으면 curator_places INSERT
 *
 * SQL만:
 *   node scripts/import-hanjulpyeong-vertical-csv.mjs "data/한줄평.csv" --dry-sql
 *
 * 매칭: places.lat/lng 와 CSV 위도·경도 거리 ≤ 120m (옵션 --max-meters=)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const BLOCK = 9;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function extractReview(line) {
  const m = String(line || "").match(/한줄리뷰:\s*(.+)$/);
  return m ? m[1].trim().replace(/,+$/g, "").trim() : "";
}

function extractLat(line) {
  const m = String(line || "").match(/위도:\s*([\d.+-]+)/);
  return m ? parseFloat(m[1]) : NaN;
}

function extractLng(line) {
  const m = String(line || "").match(/경도:\s*([\d.+-]+)/);
  return m ? parseFloat(m[1]) : NaN;
}

function extractNaverPlaceId(line) {
  const m = String(line || "").match(/place\.naver\.com\/place\/(\d+)/);
  return m ? m[1] : null;
}

function parseBlocks(lines) {
  const dataLines = lines.slice(1).filter((l) => l.length > 0);
  const out = [];
  for (let i = 0; i + BLOCK <= dataLines.length; i += BLOCK) {
    const b = dataLines.slice(i, i + BLOCK);
    const lat = extractLat(b[6]);
    const lng = extractLng(b[7]);
    const reason = extractReview(b[4]);
    const naverId = extractNaverIdFromBlock(b);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn(`블록 ${out.length + 1}: 위·경도 파싱 실패, 스킵`);
      continue;
    }
    if (!reason) {
      console.warn(`블록 ${out.length + 1}: 한줄리뷰 없음, 스킵`);
      continue;
    }
    out.push({ lat, lng, reason, naverId, blockIndex: out.length + 1 });
  }
  return out;
}

function extractNaverIdFromBlock(b) {
  for (const line of b) {
    const id = extractNaverPlaceId(line);
    if (id) return id;
  }
  return null;
}

function parseArgs(argv) {
  const out = { csvPath: null, drySql: false, maxMeters: 120, fromAllPlaces: false };
  for (const a of argv) {
    if (a === "--dry-sql") out.drySql = true;
    if (a === "--from-all-places") out.fromAllPlaces = true;
    else if (a.startsWith("--max-meters="))
      out.maxMeters = Number(a.split("=")[1]) || 120;
    else if (!a.startsWith("-") && !out.csvPath) out.csvPath = a;
  }
  return out;
}

async function fetchAllPlacesRows(supabase) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from("places")
      .select("id, lat, lng")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function upsertCuratorOneLineReason(
  supabase,
  curatorId,
  placeId,
  reason,
  displayName
) {
  const { data: updated, error: upErr } = await supabase
    .from("curator_places")
    .update({ one_line_reason: reason })
    .eq("curator_id", curatorId)
    .eq("place_id", placeId)
    .select("id");
  if (upErr) return { error: upErr };
  if (updated?.length) return { ok: "update" };

  const row = {
    curator_id: curatorId,
    place_id: placeId,
    one_line_reason: reason,
    display_name: displayName || "한줄평 일괄",
    tags: [],
    alcohol_types: [],
    moods: [],
    is_archived: false,
  };
  const { error: insErr } = await supabase.from("curator_places").insert([row]);
  if (insErr) return { error: insErr };
  return { ok: "insert" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.csvPath) {
    console.error(
      'Usage: node scripts/import-hanjulpyeong-vertical-csv.mjs "data/한줄평.csv" [--dry-sql] [--from-all-places] [--max-meters=120]'
    );
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), args.csvPath);
  if (!fs.existsSync(abs)) {
    console.error("파일 없음:", abs);
    process.exit(1);
  }

  const curatorId = process.env.YAJANG_CURATOR_USER_ID?.trim();
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const raw = fs.readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/);
  const records = parseBlocks(lines);
  console.error(`CSV 블록 파싱: ${records.length}건`);

  if (args.drySql) {
    const esc = (s) => String(s).replace(/'/g, "''");
    console.log(
      `-- 아래 place_id 는 실제 실행 전에 위·경도로 조회해 채워야 합니다. --dry-sql 만으로는 UUID를 모릅니다.`
    );
    console.log(`-- curator_id = '${esc(curatorId || "YOUR_UUID")}'`);
    for (const r of records.slice(0, 5)) {
      console.log(
        `-- ${r.blockIndex}: lat=${r.lat} lng=${r.lng} naver=${r.naverId || "?"}`
      );
      console.log(
        `--   reason: ${esc(r.reason).slice(0, 80)}${r.reason.length > 80 ? "…" : ""}`
      );
    }
    console.log(`-- ... 총 ${records.length}건 — 실제 반영은 서비스 롤로 스크립트 실행`);
    return;
  }

  if (!curatorId || !url || !key) {
    console.error(
      "YAJANG_CURATOR_USER_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (또는 --dry-sql)"
    );
    process.exit(1);
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(curatorId)) {
    console.error(
      "YAJANG_CURATOR_USER_ID 가 올바른 UUID 가 아닙니다.\n" +
        `  지금 값: ${curatorId.slice(0, 60)}${curatorId.length > 60 ? "…" : ""}\n` +
        "  예시 형식: 550e8400-e29b-41d4-a716-446655440000\n" +
        "  확인: Supabase → Authentication → Users 에서 야장마스터 계정의 User UID 복사\n" +
        "  (문서에 적힌 한글 설명 문장을 그대로 넣으면 안 됩니다.)"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  let candidates = [];

  if (args.fromAllPlaces) {
    try {
      candidates = await fetchAllPlacesRows(supabase);
    } catch (e) {
      console.error("places 전체 조회 실패:", e.message);
      process.exit(1);
    }
    console.error(`매칭 후보 places: ${candidates.length}건 (--from-all-places, 전체 테이블)`);
  } else {
    const { data: cpRows, error: cpErr } = await supabase
      .from("curator_places")
      .select("place_id")
      .eq("curator_id", curatorId);

    if (cpErr) {
      console.error("curator_places 조회 실패:", cpErr.message);
      process.exit(1);
    }

    const placeIds = [...new Set((cpRows || []).map((r) => r.place_id).filter(Boolean))];
    if (placeIds.length === 0) {
      console.error(
        "해당 curator_id 에 연결된 curator_places 가 없습니다.\n" +
          "  places 만 있고 아직 이 큐레이터로 추천 행을 안 만든 경우:\n" +
          '  node scripts/import-hanjulpyeong-vertical-csv.mjs "data/한줄평.csv" --from-all-places'
      );
      process.exit(1);
    }

    const { data: places, error: plErr } = await supabase
      .from("places")
      .select("id, lat, lng")
      .in("id", placeIds);

    if (plErr) {
      console.error("places 조회 실패:", plErr.message);
      process.exit(1);
    }

    candidates = places || [];
    console.error(`매칭 후보 places: ${candidates.length}건 (이 큐레이터 curator_places 에 묶인 것만)`);
  }

  if (candidates.length === 0) {
    console.error("places 후보가 비었습니다. DB places 테이블에 행이 있는지 확인하세요.");
    process.exit(1);
  }

  function nearestPlaceId(lat, lng) {
    let best = null;
    let bestD = Infinity;
    for (const p of candidates) {
      const plat = parseFloat(p.lat);
      const plng = parseFloat(p.lng);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      const d = haversineMeters(lat, lng, plat, plng);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    if (bestD <= args.maxMeters) return { id: best, meters: bestD };
    return null;
  }

  let okUpdate = 0;
  let okInsert = 0;
  let skip = 0;
  const seenPlace = new Set();
  const displayName = process.env.IMPORT_CURATOR_DISPLAY_NAME?.trim() || "";

  for (const r of records) {
    const hit = nearestPlaceId(r.lat, r.lng);
    if (!hit) {
      console.warn(
        `블록 ${r.blockIndex}: ${args.maxMeters}m 안 매칭 실패 (lat=${r.lat}, lng=${r.lng})`
      );
      skip += 1;
      continue;
    }
    if (seenPlace.has(hit.id)) {
      console.warn(`블록 ${r.blockIndex}: place ${hit.id} 중복 매칭 — 마지막 값으로 덮어씀`);
    }
    seenPlace.add(hit.id);

    if (args.fromAllPlaces) {
      const res = await upsertCuratorOneLineReason(
        supabase,
        curatorId,
        hit.id,
        r.reason,
        displayName
      );
      if (res.error) {
        console.error(`upsert 실패 place_id=${hit.id}`, res.error.message);
        skip += 1;
        continue;
      }
      if (res.ok === "insert") okInsert += 1;
      else okUpdate += 1;
    } else {
      const { data: updated, error: upErr } = await supabase
        .from("curator_places")
        .update({ one_line_reason: r.reason })
        .eq("curator_id", curatorId)
        .eq("place_id", hit.id)
        .select("id");
      if (upErr) {
        console.error(`UPDATE 실패 place_id=${hit.id}`, upErr.message);
        skip += 1;
        continue;
      }
      if (!updated?.length) {
        console.warn(`블록 ${r.blockIndex}: curator_places 행 없음 place_id=${hit.id} — --from-all-places 로 INSERT 가능`);
        skip += 1;
        continue;
      }
      okUpdate += 1;
    }

    const ok = okUpdate + okInsert;
    if (ok <= 3 || ok % 50 === 0) {
      console.error(
        `OK ${ok}: place=${hit.id} (~${Math.round(hit.meters)}m) «${r.reason.slice(0, 40)}…»`
      );
    }
  }

  console.error(
    `완료: update=${okUpdate}, insert=${okInsert}, skipped=${skip}, csv_records=${records.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
