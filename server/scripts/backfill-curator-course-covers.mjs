#!/usr/bin/env node
/**
 * 커버 없는 기존 코스 — 1차 장소 카카오 지도 사진으로 cover_image_url 백필
 *
 * 실행 (저장소 루트):
 *   node server/scripts/backfill-curator-course-covers.mjs
 *
 * 환경: 루트 .env + server/.env
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * 옵션:
 *   DRY_RUN=1          — DB 업데이트 없이 대상만 출력
 *   COVER_BATCH_SIZE=40 — 한 번에 조회할 코스 수 (기본 40)
 *   COVER_MAX_ROWS=200  — 최대 업데이트 건수 (기본 무제한)
 *   COVER_KAKAO_DELAY_MS=120 — 카카오 요청 간격 (기본 120ms)
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fetchKakaoPlaceOgImageUrl } from "../kakaoPlaceOgImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || "").trim());
}

function pickUploadedStepImage(step) {
  const u = String(step?.image_url || "").trim();
  return isHttpUrl(u) ? u : null;
}

function firstPlaceStepFromCourseRow(row) {
  const nested = row?.curator_course_places;
  if (!Array.isArray(nested) || nested.length === 0) return null;
  const steps = [...nested]
    .filter((s) => s && typeof s === "object")
    .sort((a, b) => Number(a.order_index) - Number(b.order_index));
  return steps[0] || null;
}

async function resolveCoverForCourseRow(row, { fetchImpl }) {
  const existing = String(row?.cover_image_url || "").trim();
  if (existing) return existing;

  const step = firstPlaceStepFromCourseRow(row);
  if (!step) return null;

  const uploaded = pickUploadedStepImage(step);
  if (uploaded) return uploaded;

  const pl =
    step.places && typeof step.places === "object" ? step.places : {};
  const kakaoId = String(pl.kakao_place_id || "").trim();
  if (!kakaoId) return null;

  const thumb = await fetchKakaoPlaceOgImageUrl(kakaoId, { fetchImpl });
  return isHttpUrl(thumb) ? thumb : null;
}

async function main() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";
  const batchSize = Math.min(
    100,
    Math.max(1, parseInt(process.env.COVER_BATCH_SIZE || "40", 10) || 40)
  );
  const maxRows = process.env.COVER_MAX_ROWS
    ? parseInt(process.env.COVER_MAX_ROWS, 10)
    : null;
  const kakaoDelayMs = Math.max(
    0,
    parseInt(process.env.COVER_KAKAO_DELAY_MS || "120", 10) || 120
  );

  if (!url || !key) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    dryRun
      ? "DRY_RUN=1 — DB 업데이트 없이 미리보기만 합니다."
      : "커버 백필 시작…"
  );

  for (;;) {
    if (maxRows != null && updated >= maxRows) break;

    const { data: rows, error } = await sb
      .from("curator_courses")
      .select(
        `
        id,
        title,
        cover_image_url,
        curator_course_places (
          order_index,
          place_id,
          image_url,
          places (
            name,
            lat,
            lng,
            kakao_place_id,
            address
          )
        )
      `
      )
      .or("cover_image_url.is.null,cover_image_url.eq.")
      .order("created_at", { ascending: true })
      .order("order_index", {
        ascending: true,
        foreignTable: "curator_course_places",
      })
      .limit(batchSize);

    if (error) {
      console.error("select error:", error);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      if (maxRows != null && updated >= maxRows) break;
      if (String(row.cover_image_url || "").trim()) {
        skipped += 1;
        continue;
      }

      let coverUrl = null;
      try {
        coverUrl = await resolveCoverForCourseRow(row, { fetchImpl: fetch });
      } catch (e) {
        failed += 1;
        console.warn(`resolve failed ${row.id}:`, e?.message || e);
        continue;
      }

      if (kakaoDelayMs > 0) await sleep(kakaoDelayMs);

      if (!coverUrl) {
        skipped += 1;
        console.log(`skip (no cover source): ${row.id} · ${row.title || ""}`);
        continue;
      }

      if (dryRun) {
        updated += 1;
        console.log(`would update: ${row.id} · ${row.title || ""} → ${coverUrl}`);
        continue;
      }

      const { error: upErr } = await sb
        .from("curator_courses")
        .update({ cover_image_url: coverUrl })
        .eq("id", row.id);

      if (upErr) {
        failed += 1;
        console.error(`update failed ${row.id}:`, upErr.message || upErr);
        continue;
      }

      updated += 1;
      process.stdout.write(
        `\rupdated ${updated} (skipped ${skipped}, failed ${failed})`
      );
    }

    if (rows.length < batchSize) break;
  }

  console.log(
    `\ndone. updated=${updated} skipped=${skipped} failed=${failed}${
      dryRun ? " (dry run)" : ""
    }`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
