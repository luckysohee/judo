/**
 * 카카오 주소/키워드 검색 → places INSERT → curator_places INSERT
 *
 * 사용:
 *   cd judo
 *   node scripts/importCuratorPlacesFromJson.mjs
 *
 * 프로젝트 루트의 `.env.local` → `.env` 순으로 읽어서
 * VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_KAKAO_REST_API_KEY 를 채움.
 * (이미 셸에 export 돼 있으면 그걸 우선)
 *
 * 데이터: scripts/kbob_places_source.mjs 기본값, 또는 첫 인자로 JSON 경로
 *
 * 좌표만 .env의 카카오 키로 뽑기 (Supabase 불필요):
 *   node scripts/importCuratorPlacesFromJson.mjs --geocode-only
 *   → data/kbob_geocoded.json
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

/** Vite와 동일하게 루트 .env.local / .env 로드 (미설정 키만) */
function loadEnvFromDotenvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = join(REPO_ROOT, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (let line of text.split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      } else {
        const hash = val.search(/\s+#/);
        if (hash !== -1) val = val.slice(0, hash).trim();
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

/**
 * 국밥부장 큐레이터 `curators.id` (프로필 PK).
 * DB FK는 보통 `curator_places.curator_id` → `auth.users(id)` 이므로
 * 실행 시 `curators.user_id`로 치환한다.
 */
const CURATOR_PROFILE_ID = "70896870-4334-44e0-81ce-78cfbb209b1c";

const CLI_ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const GEOCODE_ONLY = process.argv.slice(2).includes("--geocode-only");
/** optional: path to .json array file (첫 번째 인자) */
const SOURCE_PATH = CLI_ARGS[0] || null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kakaoLatLng(address, name, kakaoHeaders) {
  const headers = kakaoHeaders;

  const addrUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
  const addrRes = await fetch(addrUrl, { headers });
  const addrJson = await addrRes.json();
  const doc0 = addrJson.documents?.[0];
  if (doc0) {
    const y = parseFloat(doc0.y);
    const x = parseFloat(doc0.x);
    if (Number.isFinite(y) && Number.isFinite(x)) {
      return { lat: y, lng: x, kakao_place_id: null };
    }
  }

  const kw = `${name} ${address}`.slice(0, 100);
  const kwUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(kw)}&size=5`;
  const kwRes = await fetch(kwUrl, { headers });
  const kwJson = await kwRes.json();
  const d = kwJson.documents?.[0];
  if (!d) return null;
  const lat = parseFloat(d.y);
  const lng = parseFloat(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const kid = d.id != null ? String(d.id).trim() : null;
  return {
    lat,
    lng,
    kakao_place_id: kid && /^\d+$/.test(kid) ? kid : null,
  };
}

async function loadRows() {
  if (SOURCE_PATH) {
    const raw = await readFile(SOURCE_PATH, "utf8");
    return JSON.parse(raw);
  }
  const mod = await import("./kbob_places_source.mjs");
  return mod.default;
}

async function main() {
  loadEnvFromDotenvFiles();

  const rawK = process.env.VITE_KAKAO_REST_API_KEY || "";
  const kakaoKeyOnly = rawK.replace(/^KakaoAK\s+/i, "").trim();
  const kakaoHeaders = {
    Authorization: rawK.trim().startsWith("KakaoAK")
      ? rawK.trim()
      : `KakaoAK ${kakaoKeyOnly}`,
  };

  if (!kakaoKeyOnly) {
    console.error("VITE_KAKAO_REST_API_KEY 가 필요합니다 (.env).");
    process.exit(1);
  }

  if (GEOCODE_ONLY) {
    const rows = await loadRows();
    const out = [];
    let fail = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      await sleep(120);
      const geo = await kakaoLatLng(row.address, row.name, kakaoHeaders);
      if (!geo) {
        console.warn("[지오실패]", i + 1, row.name, row.address);
        fail += 1;
        out.push({
          ...row,
          lat: null,
          lng: null,
          kakao_place_id: null,
          geocode_ok: false,
        });
        continue;
      }
      console.log("[좌표]", i + 1, "/", rows.length, row.name, geo.lat, geo.lng);
      out.push({
        ...row,
        lat: geo.lat,
        lng: geo.lng,
        kakao_place_id: geo.kakao_place_id,
        geocode_ok: true,
      });
    }
    const outFile = join(REPO_ROOT, "data/kbob_geocoded.json");
    writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
    console.log("\n저장:", outFile, "| 성공", out.length - fail, "| 실패", fail);
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "DB 넣기: VITE_SUPABASE_URL 과 서비스 롤 키가 필요합니다.\n" +
        "  SUPABASE_SERVICE_ROLE_KEY 또는 VITE_SUPABASE_SERVICE_ROLE_KEY\n" +
        "좌표만: node scripts/importCuratorPlacesFromJson.mjs --geocode-only"
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let curatorFkUserId = CURATOR_PROFILE_ID;
  const { data: curByPk } = await supabase
    .from("curators")
    .select("user_id")
    .eq("id", CURATOR_PROFILE_ID)
    .maybeSingle();
  if (curByPk?.user_id) {
    curatorFkUserId = String(curByPk.user_id);
    console.log(
      "curator_places.curator_id → curators.user_id (auth.uid) 사용:",
      curatorFkUserId
    );
  } else {
    const { data: curByUid } = await supabase
      .from("curators")
      .select("user_id")
      .eq("user_id", CURATOR_PROFILE_ID)
      .maybeSingle();
    if (curByUid?.user_id) {
      curatorFkUserId = String(curByUid.user_id);
      console.log("curator_id 이미 user_id 형식:", curatorFkUserId);
    } else {
      console.warn(
        "curators 에서 프로필을 못 찾음. curator_id 를 그대로 씀:",
        CURATOR_PROFILE_ID
      );
    }
  }

  const rows = await loadRows();
  console.log("총", rows.length, "건");

  let ok = 0;
  let skipGeo = 0;
  let skipDup = 0;
  let err = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `${i + 1}/${rows.length} ${row.name}`;
    await sleep(120);

    const geo = await kakaoLatLng(row.address, row.name, kakaoHeaders);
    if (!geo) {
      console.warn("[지오실패]", label, row.address);
      skipGeo += 1;
      continue;
    }

    const category = (row.category || "미분류").replace(/\s+/g, " ").trim();

    let placeId = null;

    if (geo.kakao_place_id) {
      const { data: ex } = await supabase
        .from("places")
        .select("id")
        .eq("kakao_place_id", geo.kakao_place_id)
        .maybeSingle();
      if (ex?.id) placeId = ex.id;
    }

    if (!placeId) {
      const { data: ins, error: pErr } = await supabase
        .from("places")
        .insert({
          name: row.name,
          address: row.address,
          lat: geo.lat,
          lng: geo.lng,
          category,
          kakao_place_id: geo.kakao_place_id,
        })
        .select("id")
        .single();

      if (pErr) {
        if (pErr.code === "23505" && geo.kakao_place_id) {
          const { data: again } = await supabase
            .from("places")
            .select("id")
            .eq("kakao_place_id", geo.kakao_place_id)
            .maybeSingle();
          placeId = again?.id ?? null;
        } else {
          console.error("[places]", label, pErr.message);
          err += 1;
          continue;
        }
      } else {
        placeId = ins?.id ?? null;
      }
    }

    if (!placeId) {
      err += 1;
      continue;
    }

    const { data: cpEx } = await supabase
      .from("curator_places")
      .select("id")
      .eq("curator_id", curatorFkUserId)
      .eq("place_id", placeId)
      .maybeSingle();

    if (cpEx?.id) {
      console.log("[이미연결]", label);
      skipDup += 1;
      continue;
    }

    const { error: cErr } = await supabase.from("curator_places").insert({
      curator_id: curatorFkUserId,
      place_id: placeId,
      one_line_reason: "",
      tags: [],
      alcohol_types: [],
      moods: [],
      display_name: "",
    });

    if (cErr) {
      console.error("[curator_places]", label, cErr.message);
      err += 1;
      continue;
    }

    console.log("[완료]", label, placeId);
    ok += 1;
  }

  console.log("\n요약: 성공", ok, "/ 지오실패", skipGeo, "/ 이미연결", skipDup, "/ 오류", err);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
