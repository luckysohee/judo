#!/usr/bin/env node
/**
 * 야장마스터 등: CSV 한 줄당 9칸(스프레드시트 2~10열) 반복 시
 * 기존 curator_places 행의 one_line_reason 만 갱신.
 *
 * 전제: 9칸 중 하나가 places.id (UUID) = curator_places.place_id 와 일치.
 * curator_id 는 앱과 동일하게 auth user UUID (환경변수 YAJANG_CURATOR_USER_ID).
 *
 * 사용:
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...  # RLS 우회, 로컬만 권장
 *   export YAJANG_CURATOR_USER_ID=uuid
 *   node scripts/update-yajang-one-line-reason.mjs path/to.csv
 *
 * SQL만 출력 (--dry-sql):
 *   node scripts/update-yajang-one-line-reason.mjs path/to.csv --dry-sql
 *
 * 열 인덱스는 CSV 파싱 후 0-based. 기본: start-col=1 (2열=B부터 9칸),
 * place-id-col=0 (그중 1번째=2열), reason-col=3 (그중 4번째=5열 E).
 *
 * 채팅에는 CSV 업로드가 안 됨 → 파일을 레포의 data/ 등에 넣은 뒤 경로를 넘기면 됨.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const out = {
    csvPath: null,
    drySql: false,
    startCol: 1,
    placeIdCol: 0,
    reasonCol: 3,
    delimiter: ",",
  };
  for (const a of argv) {
    if (a === "--dry-sql") out.drySql = true;
    else if (a.startsWith("--start-col="))
      out.startCol = Number(a.split("=")[1]);
    else if (a.startsWith("--place-id-col="))
      out.placeIdCol = Number(a.split("=")[1]);
    else if (a.startsWith("--reason-col="))
      out.reasonCol = Number(a.split("=")[1]);
    else if (a.startsWith("--delimiter="))
      out.delimiter = a.split("=")[1] || ",";
    else if (!a.startsWith("-") && !out.csvPath) out.csvPath = a;
  }
  return out;
}

/** 최소 CSV 줄 분리 (쌍따옴표 안의 쉼표만 처리) */
function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.csvPath) {
    console.error(
      "Usage: node scripts/update-yajang-one-line-reason.mjs <file.csv> [--dry-sql] [--start-col=1] [--place-id-col=0] [--reason-col=3]"
    );
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), args.csvPath);
  if (!fs.existsSync(abs)) {
    console.error("File not found:", abs);
    process.exit(1);
  }

  const curatorId = process.env.YAJANG_CURATOR_USER_ID?.trim();
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!args.drySql && (!curatorId || !url || !key)) {
    console.error(
      "Set YAJANG_CURATOR_USER_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or use --dry-sql"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV needs header + at least one row");
    process.exit(1);
  }

  const dataLines = lines.slice(1);
  const updates = [];

  for (let i = 0; i < dataLines.length; i++) {
    const cells = splitCsvLine(dataLines[i]);
    const base = args.startCol;
    const pidIdx = base + args.placeIdCol;
    const reasonIdx = base + args.reasonCol;
    const placeId = cells[pidIdx]?.replace(/^"|"$/g, "").trim();
    const reason = cells[reasonIdx]?.replace(/^"|"$/g, "").trim() ?? "";
    if (!placeId || !/^[0-9a-f-]{36}$/i.test(placeId)) {
      console.warn(`Skip row ${i + 2}: invalid place_id at col index ${pidIdx}:`, cells[pidIdx]?.slice(0, 40));
      continue;
    }
    updates.push({ place_id: placeId, one_line_reason: reason });
  }

  console.error(`Parsed ${updates.length} valid rows (place UUID + reason)`);

  if (args.drySql) {
    const esc = (s) => s.replace(/'/g, "''");
    console.log(
      `-- curator_id = '${esc(curatorId || "YOUR_CURATOR_USER_UUID")}'`
    );
    for (const u of updates) {
      console.log(
        `UPDATE curator_places SET one_line_reason = '${esc(u.one_line_reason)}' WHERE curator_id = '${esc(curatorId || "YOUR_CURATOR_USER_UUID")}' AND place_id = '${esc(u.place_id)}';`
      );
    }
    return;
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(curatorId)) {
    console.error(
      "YAJANG_CURATOR_USER_ID must be a real auth User UUID (Authentication → Users), not a placeholder string."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let ok = 0;
  let miss = 0;

  for (const u of updates) {
    const { data, error } = await supabase
      .from("curator_places")
      .update({ one_line_reason: u.one_line_reason })
      .eq("curator_id", curatorId)
      .eq("place_id", u.place_id)
      .select("id");

    if (error) {
      console.error("Update error", u.place_id, error.message);
      continue;
    }
    if (!data?.length) {
      miss += 1;
      console.warn("No row for place_id", u.place_id);
    } else ok += 1;
  }

  console.error(`Done. updated=${ok}, no_matching_row=${miss}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
