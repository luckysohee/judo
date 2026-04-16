/**
 * JSON 배열 → 카카오 지오코딩 → places INSERT → curator_places INSERT
 *
 * JSON 필드: name, category, address, region?, curator_id (선택·--curator-id 로 대체 가능), lat?, lng?, note? → curator_places.one_line_reason
 *
 * 사용:
 *   node scripts/importJsonPlacesForCurator.mjs data/curator_batch_c0aca_places.json
 *   node scripts/importJsonPlacesForCurator.mjs data/places.json --curator-id=<uuid> [--sleep-ms=0]
 *
 * curator_places.curator_id 스키마마다 다름:
 *   - 많은 프로젝트: FK → public.curators(user_id) → 컬럼 값은 auth uid (= curators.user_id)
 *   - 일부: FK → public.curators(id) → 컬럼 값은 큐레이터 PK
 * 기본은 둘 다 시도(user_id 우선). user_id 만 쓰는 DB는 환경변수로 고정:
 *   CURATOR_PLACES_CURATOR_ID_MODE=user_id   # curator_places.curator_id = curators.user_id 만 INSERT
 *   CURATOR_PLACES_CURATOR_ID_MODE=id       # curators.id 만 INSERT
 *   CURATOR_PLACES_CURATOR_ID_MODE=both     # 기본: user_id 있으면 먼저, 실패 시 id
 *
 * 환경: 프로젝트 루트 .env.local / .env
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 VITE_SUPABASE_SERVICE_ROLE_KEY)
 *   VITE_KAKAO_REST_API_KEY
 *
 * --skip-geo  이미 lat/lng가 있는 행만 넣고, 지오코딩 없이 null 좌표로 INSERT 시도 (DB 허용 시)
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kakaoLatLng(address, name, kakaoHeaders) {
  const addrUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
  const addrRes = await fetch(addrUrl, { headers: kakaoHeaders });
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
  const kwRes = await fetch(kwUrl, { headers: kakaoHeaders });
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

/** 소주안조 JSON 에 쓰이는 고정 PK·레거시 PK — DB 행 PK 가 바뀌어도 slug 로 붙잡기 */
const SOJU_RESOLVE_IDS = new Set(
  [
    "d5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b",
    "c57a5dc3-8d63-4a77-81e1-bfb22065c5b7",
  ].map((u) => u.toLowerCase())
);

/**
 * JSON 의 curator_id 로 public.curators 행을 찾아, 그 행의 id(PK)를 반환한다.
 * (내부에서 행을 읽기 위함.) 실제 INSERT 에 넣는 UUID 는 loadCuratorPlaceIdCandidates 가 모드에 맞게 고른다.
 */
async function resolveCuratorPlaceRowId(supabase, curatorIdFromJson) {
  const id = String(curatorIdFromJson || "").trim();
  if (!id) throw new Error("curator_id 없음");
  const idLc = id.toLowerCase();

  const { data: byPk } = await supabase
    .from("curators")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (byPk?.id) return String(byPk.id);

  const { data: byUid } = await supabase
    .from("curators")
    .select("id")
    .eq("user_id", id)
    .maybeSingle();
  if (byUid?.id) return String(byUid.id);

  /** PK 가 프로젝트마다 다를 수 있음: slug/username 으로 소주안조 행만 보강 */
  if (SOJU_RESOLVE_IDS.has(idLc)) {
    const { data: bySlug } = await supabase
      .from("curators")
      .select("id")
      .eq("slug", "soju_anjo")
      .maybeSingle();
    if (bySlug?.id) return String(bySlug.id);
    const { data: byHandle } = await supabase
      .from("curators")
      .select("id")
      .ilike("username", "soju_anjo")
      .limit(1)
      .maybeSingle();
    if (byHandle?.id) return String(byHandle.id);
  }

  const { data: authUser, error: authErr } =
    await supabase.auth.admin.getUserById(id);
  if (!authErr && authUser?.user?.id) {
    const uid = String(authUser.user.id);
    const { data: row } = await supabase
      .from("curators")
      .select("id")
      .eq("user_id", uid)
      .maybeSingle();
    if (row?.id) return String(row.id);
  }

  throw new Error(
    `curators 에서 curator_id 를 해석할 수 없습니다: ${id}. ` +
      `public.curators 에 해당 id/user_id/slug(soju_anjo) 행이 있는지 확인하세요.`
  );
}

/**
 * curator_places INSERT 에 넣을 curator_id 후보.
 * @param {"both"|"user_id"|"id"} mode both: user_id 우선 후 id | user_id: user_id 만 | id: curators.id 만
 */
async function loadCuratorPlaceIdCandidates(
  supabase,
  resolvedCuratorPk,
  mode = "both"
) {
  const pk = String(resolvedCuratorPk || "").trim();
  if (!pk) return [];
  const m = String(mode || "both").toLowerCase().trim();

  const { data: full, error } = await supabase
    .from("curators")
    .select("id, user_id")
    .eq("id", pk)
    .maybeSingle();
  if (error || !full?.id) {
    if (m === "user_id" || m === "userid") return [];
    return [pk];
  }

  const uid =
    full.user_id != null && String(full.user_id).trim()
      ? String(full.user_id).trim()
      : null;

  if (m === "user_id" || m === "userid") {
    if (!uid) return [];
    return [uid];
  }
  if (m === "id" || m === "pk") {
    return [String(full.id)];
  }

  const out = [];
  if (uid) out.push(uid);
  out.push(String(full.id));
  return [...new Set(out)];
}

/** varchar 길이 제한에 걸리는 경우 방지 (스키마마다 다를 수 있음) */
function clip(s, max) {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return t.slice(0, max);
}

const MAX_NAME = 300;
const MAX_ADDRESS = 1000;
const MAX_CATEGORY = 200;
const MAX_ONE_LINE = 2000;

async function main() {
  loadEnvFromDotenvFiles();
  const argv = process.argv.slice(2);
  const SKIP_GEO = argv.includes("--skip-geo");
  const curatorIdArg = argv.find((a) => a.startsWith("--curator-id="));
  const curatorFromCli = curatorIdArg
    ? curatorIdArg.slice("--curator-id=".length).trim()
    : "";
  const sleepArg = argv.find((a) => a.startsWith("--sleep-ms="));
  const SLEEP_MS = sleepArg
    ? Math.max(0, parseInt(sleepArg.slice("--sleep-ms=".length), 10) || 0)
    : 130;

  const jsonPath = argv.find((a) => !a.startsWith("--"));

  if (!jsonPath) {
    console.error(
      "사용: node scripts/importJsonPlacesForCurator.mjs <경로.json> [--curator-id=UUID] [--sleep-ms=130] [--skip-geo]"
    );
    process.exit(1);
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const rawK = process.env.VITE_KAKAO_REST_API_KEY || "";
  const kakaoKeyOnly = rawK.replace(/^KakaoAK\s+/i, "").trim();
  const kakaoHeaders = {
    Authorization: rawK.trim().startsWith("KakaoAK")
      ? rawK.trim()
      : `KakaoAK ${kakaoKeyOnly}`,
  };

  if (!url || !serviceKey) {
    console.error("VITE_SUPABASE_URL 과 서비스 롤 키가 필요합니다.");
    process.exit(1);
  }
  if (!SKIP_GEO && !kakaoKeyOnly) {
    console.error("지오코딩: VITE_KAKAO_REST_API_KEY 가 필요합니다. 또는 --skip-geo");
    process.exit(1);
  }

  const rows = JSON.parse(await readFile(join(REPO_ROOT, jsonPath), "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("JSON 배열이 비었습니다.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const curatorProfileId = curatorFromCli || rows[0]?.curator_id;
  if (!curatorProfileId) {
    console.error(
      "curator_id 가 필요합니다. JSON 첫 객체에 curator_id 를 넣거나 --curator-id=<uuid> 로 지정하세요."
    );
    process.exit(1);
  }
  const curatorPk = await resolveCuratorPlaceRowId(supabase, curatorProfileId);
  const cpIdMode = String(
    process.env.CURATOR_PLACES_CURATOR_ID_MODE ||
      process.env.VITE_CURATOR_PLACES_CURATOR_ID_MODE ||
      "both"
  )
    .toLowerCase()
    .trim();
  const curatorIdCandidates = await loadCuratorPlaceIdCandidates(
    supabase,
    curatorPk,
    cpIdMode
  );
  if (curatorIdCandidates.length === 0) {
    console.error(
      "curator_places.curator_id 후보가 비었습니다. CURATOR_PLACES_CURATOR_ID_MODE=user_id 인데 public.curators.user_id 가 NULL 이거나, curators 행 조회에 실패했을 수 있습니다."
    );
    process.exit(1);
  }
  console.log(
    "CURATOR_PLACES_CURATOR_ID_MODE=",
    cpIdMode,
    "| curator_places.curator_id 후보 →",
    curatorIdCandidates.join(", ")
  );

  const { data: curRow, error: curRowErr } = await supabase
    .from("curators")
    .select("id, user_id, slug, username")
    .eq("id", curatorPk)
    .maybeSingle();
  console.log(
    "[진단] public.curators:",
    curRow ?? "(없음)",
    curRowErr?.message ? `조회오류: ${curRowErr.message}` : ""
  );
  if (curRow?.user_id) {
    const { data: au, error: auErr } = await supabase.auth.admin.getUserById(
      String(curRow.user_id)
    );
    if (auErr || !au?.user) {
      console.warn(
        "[진단] curators.user_id 가 auth.users 에 없음 → curator_places.curator_id 가 curators(user_id) 또는 auth.users 를 FK 로 쓰면 INSERT 가 23503 으로 실패할 수 있습니다:",
        auErr?.message || "user 없음"
      );
    } else {
      console.log("[진단] auth.users 에 해당 user_id 존재 (curator_places 에 user_id 넣는 스키마와 일치)");
    }
  } else {
    console.warn(
      "[진단] curators.user_id 가 비어 있음 → curator_places.curator_id = user_id 스키마면 INSERT 불가입니다."
    );
  }

  let ok = 0;
  let skipGeo = 0;
  let skipDupPlace = 0;
  let skipDupCp = 0;
  let noteUpdated = 0;
  let err = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `${i + 1}/${rows.length} ${row.name}`;
    await sleep(SLEEP_MS);

    let lat = row.lat != null ? Number(row.lat) : null;
    let lng = row.lng != null ? Number(row.lng) : null;
    let kakaoPlaceId = null;

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && !SKIP_GEO) {
      const geo = await kakaoLatLng(row.address, row.name, kakaoHeaders);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        kakaoPlaceId = geo.kakao_place_id;
      }
    }

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && !SKIP_GEO) {
      console.warn("[지오실패]", label, row.address);
      skipGeo += 1;
      continue;
    }

    const category = clip(
      String(
        row.category != null && String(row.category).trim() !== ""
          ? row.category
          : "미분류"
      )
        .replace(/\s+/g, " ")
        .trim(),
      MAX_CATEGORY
    );
    const address = clip(String(row.address || "").trim(), MAX_ADDRESS);
    const name = clip(String(row.name || "").trim(), MAX_NAME);

    let placeId = null;

    const { data: existingByAddr } = await supabase
      .from("places")
      .select("id")
      .eq("address", address)
      .eq("name", name)
      .maybeSingle();
    if (existingByAddr?.id) {
      placeId = existingByAddr.id;
    }

    if (!placeId && kakaoPlaceId) {
      const { data: ex } = await supabase
        .from("places")
        .select("id")
        .eq("kakao_place_id", kakaoPlaceId)
        .maybeSingle();
      if (ex?.id) placeId = ex.id;
    }

    if (!placeId) {
      const insertPayload = {
        name,
        address,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        category,
        kakao_place_id: kakaoPlaceId,
      };

      const { data: ins, error: pErr } = await supabase
        .from("places")
        .insert(insertPayload)
        .select("id")
        .single();

      if (pErr) {
        if (pErr.code === "23505" && kakaoPlaceId) {
          const { data: again } = await supabase
            .from("places")
            .select("id")
            .eq("kakao_place_id", kakaoPlaceId)
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
    } else if (existingByAddr?.id) {
      skipDupPlace += 1;
    }

    if (!placeId) {
      err += 1;
      continue;
    }

    let cpEx = null;
    for (const cid of curatorIdCandidates) {
      const { data: one } = await supabase
        .from("curator_places")
        .select("id")
        .eq("curator_id", cid)
        .eq("place_id", placeId)
        .maybeSingle();
      if (one?.id) {
        cpEx = one;
        break;
      }
    }

    if (cpEx?.id) {
      const noteRaw =
        row.note != null && String(row.note).trim()
          ? String(row.note).trim()
          : "";
      const note = clip(noteRaw, MAX_ONE_LINE);
      if (note) {
        const { error: uErr } = await supabase
          .from("curator_places")
          .update({ one_line_reason: note })
          .eq("id", cpEx.id);
        if (uErr) {
          console.error("[한줄갱신]", label, uErr.message);
          err += 1;
        } else {
          console.log("[한줄갱신]", label);
          noteUpdated += 1;
        }
      } else {
        console.log("[이미연결]", label);
        skipDupCp += 1;
      }
      continue;
    }

    const note =
      row.note != null && String(row.note).trim()
        ? clip(String(row.note).trim(), MAX_ONE_LINE)
        : "";
    const insertPayload = {
      place_id: placeId,
      one_line_reason: note,
      tags: [],
      alcohol_types: [],
      moods: [],
      display_name: "",
    };

    let cErr = null;
    for (const curator_id of curatorIdCandidates) {
      const { error } = await supabase.from("curator_places").insert({
        ...insertPayload,
        curator_id,
      });
      if (!error) {
        cErr = null;
        break;
      }
      cErr = error;
      const code = String(error?.code ?? "");
      if (code === "23505") {
        console.log("[이미연결·유니크]", label);
        skipDupCp += 1;
        cErr = null;
        break;
      }
      if (code !== "23503") break;
    }

    if (cErr) {
      console.error("[curator_places]", label, cErr.message);
      if (String(cErr?.code) === "23503") {
        console.error(
          "  → FK 실패: DB가 curator_id = curators.user_id 이면 .env 에 CURATOR_PLACES_CURATOR_ID_MODE=user_id 로 두고, SQL/JSON 에는 그 큐레이터의 user_id(auth uid)만 넣었는지 확인. FK 가 curators(id) 이면 id 모드 또는 both 로 후보를 맞추세요."
        );
      }
      err += 1;
      continue;
    }

    console.log("[완료]", label, placeId);
    ok += 1;
  }

  console.log(
    "\n요약: 신규연결",
    ok,
    "/ 한줄갱신(이미연결+note)",
    noteUpdated,
    "/ 지오실패",
    skipGeo,
    "/ 기존장소재사용",
    skipDupPlace,
    "/ 이미연결(note없음)",
    skipDupCp,
    "/ 오류",
    err
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
