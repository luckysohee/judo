#!/usr/bin/env node
/**
 * ⚠️ 이 파일(.mjs)은 Node로 실행. Supabase에는 생성된 .sql 만 붙여 넣습니다.
 *
 * 한줄평 CSV: 장소당 세로 9행
 *   1행: POINT (경도 위도) WKT — 이 좌표로 places.lat/lng 와 매칭
 *   (POINT 파싱 실패 시 같은 블록의 위도/경도 행 사용)
 *   한줄리뷰 행 → one_line_reason
 *
 * SQL: 해당 curator_id 의 curator_places + places 조인 후,
 *      좌표 차이가 tol_deg 이내인 행만 갱신 (가장 가까운 1건, 동일 CSV 좌표당)
 *
 * 사용:
 *   node scripts/gen-ordered-one-line-reason-sql.mjs "data/한줄평.csv" > data/one_line_reason_batch.sql
 *
 * 옵션:
 *   --curator-id=uuid
 *   --tolerance-deg=0.00025   (~28m 위도 기준, 필요 시 키움)
 */

import fs from "fs";
import path from "path";

const BLOCK = 9;

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

/** WKT POINT(x y) = 경도 위도 (EPSG:4326) */
function parsePointLine(line) {
  const m = String(line || "").match(
    /POINT\s*\(\s*([\d.+-]+)\s+([\d.+-]+)\s*\)/i
  );
  if (!m) return null;
  const lng = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseBlocks(lines) {
  const dataLines = lines.slice(1).filter((l) => l.length > 0);
  const rows = [];
  for (let i = 0; i + BLOCK <= dataLines.length; i += BLOCK) {
    const b = dataLines.slice(i, i + BLOCK);
    const reason = extractReview(b[4]);
    if (!reason) continue;

    let lat = NaN;
    let lng = NaN;
    const pt = parsePointLine(b[0]);
    if (pt) {
      lat = pt.lat;
      lng = pt.lng;
    } else {
      lat = extractLat(b[6]);
      lng = extractLng(b[7]);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    rows.push({ lat, lng, reason });
  }
  return rows;
}

function sqlString(s) {
  return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

function parseArgs(argv) {
  const out = {
    csvPath: null,
    curatorId: "43b3eb72-a835-4b5b-b305-da4708b53b5c",
    toleranceDeg: 0.00025,
  };
  for (const a of argv) {
    if (a.startsWith("--curator-id="))
      out.curatorId = a.slice("--curator-id=".length).trim();
    else if (a.startsWith("--tolerance-deg=")) {
      const x = parseFloat(a.split("=")[1]);
      if (Number.isFinite(x) && x > 0) out.toleranceDeg = x;
    } else if (!a.startsWith("-") && !out.csvPath) out.csvPath = a;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.csvPath) {
    console.error(
      'Usage: node scripts/gen-ordered-one-line-reason-sql.mjs "data/한줄평.csv" [--curator-id=UUID] [--tolerance-deg=0.00025] > out.sql'
    );
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), args.csvPath);
  if (!fs.existsSync(abs)) {
    console.error("파일 없음:", abs);
    process.exit(1);
  }

  const raw = fs.readFileSync(abs, "utf8");
  const rows = parseBlocks(raw.split(/\r?\n/));

  if (rows.length === 0) {
    console.error("추출된 (좌표+한줄리뷰) 행이 없습니다.");
    process.exit(1);
  }

  const tol = args.toleranceDeg;
  const valueRows = rows
    .map(
      (r) =>
        `  (${r.lat}::float8, ${r.lng}::float8, ${sqlString(r.reason)})`
    )
    .join(",\n");

  const sql = `-- 한줄평 CSV: 각 블록 첫 줄 POINT(경도,위도) 또는 위도·경도 행으로 places 와 매칭
-- curator_places.curator_id = ${args.curatorId}
-- 매칭: abs(p.lat - csv_lat) < ${tol} AND abs(p.lng - csv_lng) < ${tol}
-- 동일 CSV 좌표에 후보가 여러 개면 (|Δlat|+|Δlng|) 가장 작은 curator_places 1건만 갱신
-- Supabase SQL Editor 에서 실행

WITH raw AS (
  SELECT *
  FROM (VALUES
${valueRows}
  ) AS t(csv_lat, csv_lng, one_line_reason)
),
scored AS (
  SELECT
    cp.id AS curator_place_id,
    r.one_line_reason,
    row_number() OVER (
      PARTITION BY r.csv_lat, r.csv_lng
      ORDER BY
        abs(p.lat::float8 - r.csv_lat) + abs(p.lng::float8 - r.csv_lng),
        cp.id
    ) AS rn
  FROM raw r
  INNER JOIN curator_places cp ON cp.curator_id = '${args.curatorId}'
  INNER JOIN places p ON p.id = cp.place_id
    AND abs(p.lat::float8 - r.csv_lat) < ${tol}::float8
    AND abs(p.lng::float8 - r.csv_lng) < ${tol}::float8
),
picked AS (
  SELECT curator_place_id, one_line_reason
  FROM scored
  WHERE rn = 1
)
UPDATE curator_places cp
SET one_line_reason = picked.one_line_reason
FROM picked
WHERE cp.id = picked.curator_place_id;
`;

  process.stdout.write(sql);
  console.error(
    `stderr: csv_rows=${rows.length}, curator_id=${args.curatorId}, tolerance_deg=${tol}`
  );
}

main();
