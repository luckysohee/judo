import { supabase } from "./client";
import { kakaoNumericPlaceId, resolvePlaceWgs84 } from "../utils/placeCoords";
import { searchKakaoKeywordViaProxy } from "../utils/kakaoAPIProxy.js";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders.js";

/** Kakao 지도 level(숫자 클수록 멀리 봄) → bbox places 상한 */
export function getLimitByZoom(level) {
  if (typeof level !== "number" || !Number.isFinite(level)) return 250;
  if (level >= 8) return 60;
  if (level >= 6) return 120;
  return 250;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 장소 상세 — 카드/시트 오픈 후 등에서만 호출.
 * 서버 `GET /api/place-detail` (service role + 컬럼 화이트리스트, curator_id 미반환).
 *
 * @param {string} placeId UUID
 * @param {string} [apiBaseUrl] `VITE_AI_API_BASE_URL` — 비우면 상대 경로(프록시)
 * @returns {Promise<{ place: object, curatorPlaceRows: object[] }>}
 */
export async function fetchPlaceDetail(placeId, apiBaseUrl = "") {
  const id = String(placeId ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    throw new Error("fetchPlaceDetail: invalid place id");
  }
  const base = String(apiBaseUrl || "").replace(/\/$/, "");
  const path = `/api/place-detail?id=${encodeURIComponent(id)}`;
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, { headers: await getApiAuthHeaders() });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.ok) {
    const msg =
      (data && data.message) || res.statusText || "place-detail failed";
    throw new Error(msg);
  }
  return {
    place: data.place,
    curatorPlaceRows: Array.isArray(data.curator_place_rows)
      ? data.curator_place_rows
      : [],
  };
}

/**
 * DB에 등록된 카카오 숫자 장소 ID → `places.id`(UUID)
 */
export async function fetchPlaceUuidByKakaoPlaceId(kakaoPlaceId) {
  const kid = String(kakaoPlaceId ?? "").trim();
  if (!/^\d+$/.test(kid)) return null;
  const { data, error } = await supabase
    .from("places")
    .select("id")
    .eq("kakao_place_id", kid)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}

/** 코스 에디터 검색: 2글자 미만은 호출부에서 빈 배열 (문서화용 상수) */
export const SEARCH_PLACES_FOR_COURSE_MIN_LEN = 2;

/** `places` 테이블에는 `is_archived`가 없음(큐레이터 쪽). select에 넣으면 400. */
const PLACES_COURSE_SELECT_WITH_PLACE_NAME =
  "id, name, place_name, address, category, lat, lng";
const PLACES_COURSE_SELECT_BASIC = "id, name, address, category, lat, lng";

/**
 * PostgREST `.or()` ilike 값 — 공백·특수문자 있으면 반드시 따옴표.
 * @param {string} token 이미 % _ , 제거된 검색어
 */
export function postgrestIlikeOrPattern(token) {
  const t = String(token ?? "").trim();
  if (!t) return "";
  const inner = t.replace(/"/g, '""');
  return `"%${inner}%"`;
}

function hasUsableCoords(lat, lng) {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln);
}

/**
 * `places` 행을 코스 에디터 표시용으로 정규화.
 * @param {object} row
 * @returns {{ id: string, name: string, address: string, category: string, lat: number|null, lng: number|null }}
 */
export function mapPlaceRowForCourse(row) {
  if (!row || typeof row !== "object") {
    return {
      id: "",
      name: "",
      address: "",
      category: "",
      lat: null,
      lng: null,
    };
  }
  const id = row.id != null ? String(row.id).trim() : "";
  const nameRaw =
    (row.name != null && String(row.name).trim() !== ""
      ? row.name
      : row.place_name ?? row.title) ?? "";
  const name = String(nameRaw).trim();
  const address = String(
    row.address ?? row.road_address_name ?? row.address_name ?? ""
  ).trim();
  const category = String(row.category ?? row.category_name ?? "").trim();
  const wgs = resolvePlaceWgs84(row);
  const kid =
    row.kakao_place_id != null && String(row.kakao_place_id).trim() !== ""
      ? String(row.kakao_place_id).trim()
      : kakaoNumericPlaceId(row);
  return {
    id,
    name: name || "이름 없음",
    address,
    category,
    lat: wgs?.lat ?? null,
    lng: wgs?.lng ?? null,
    kakao_place_id: kid || null,
  };
}

/**
 * 스튜디오 코스 에디터용 `places` 검색 (Supabase).
 * 카카오 병합은 `mergeCourseSearchWithKakao` 를 사용합니다.
 *
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ id: string, name: string, address: string, category: string, lat: number|null, lng: number|null }[]>}
 */
export async function searchPlacesForCourse(query, options = {}) {
  const raw = String(query ?? "").trim();
  if (raw.length < SEARCH_PLACES_FOR_COURSE_MIN_LEN) {
    return [];
  }

  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? Math.min(100, Math.floor(options.limit))
      : 20;

  const token = raw
    .replace(/%/g, "")
    .replace(/_/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (token.length < SEARCH_PLACES_FOR_COURSE_MIN_LEN) {
    return [];
  }

  const pattern = postgrestIlikeOrPattern(token);
  if (!pattern) return [];

  const orWithPlaceName = `name.ilike.${pattern},place_name.ilike.${pattern},address.ilike.${pattern},category.ilike.${pattern}`;
  const orBasic = `name.ilike.${pattern},address.ilike.${pattern},category.ilike.${pattern}`;

  const run = async (selectCols, orClause) =>
    supabase.from("places").select(selectCols).or(orClause).limit(limit);

  let res = await run(PLACES_COURSE_SELECT_WITH_PLACE_NAME, orWithPlaceName);
  if (res.error) {
    res = await run(PLACES_COURSE_SELECT_BASIC, orBasic);
  }

  const { data, error } = res;

  if (error) {
    console.error("[코스 장소 검색 실패]", error);
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  // places에는 is_archived 없음 — 혹시 조인·뷰로 오면 로컬에서만 걸러냄
  const active = rows.filter((p) => p?.is_archived !== true);

  const mapped = active.map(mapPlaceRowForCourse).filter((m) => m.id);

  const withCoords = [];
  const withoutCoords = [];
  for (const m of mapped) {
    (hasUsableCoords(m.lat, m.lng) ? withCoords : withoutCoords).push(m);
  }

  return [...withCoords, ...withoutCoords].slice(0, limit);
}


/**
 * 카카오 로컬 키워드 검색 (서버 프록시). 키는 브라우저에 노출되지 않음.
 * @param {string} query
 * @param {number} [size]
 * @returns {Promise<object[]>}
 */
export async function fetchKakaoKeywordDocumentsForCourseEditor(
  query,
  size = 12
) {
  const raw = String(query ?? "").trim();
  if (raw.length < SEARCH_PLACES_FOR_COURSE_MIN_LEN) return [];
  try {
    const { documents } = await searchKakaoKeywordViaProxy({
      query: raw.slice(0, 100),
      size: Math.min(15, Math.max(1, Math.floor(size))),
    });
    return documents;
  } catch (e) {
    console.warn("[코스 카카오 검색]", e);
    return [];
  }
}

/**
 * 카카오 document → 코스 검색 목록 행 (`_kakaoDoc` 로 추가 시 places upsert).
 * @param {object} doc
 * @returns {{ id: string, name: string, address: string, category: string, lat: number|null, lng: number|null, _kakaoDoc: object }}
 */
export function courseSearchHitFromKakaoDocument(doc) {
  if (!doc || doc.id == null) {
    return {
      id: "",
      name: "",
      address: "",
      category: "",
      lat: null,
      lng: null,
      _kakaoDoc: doc,
    };
  }
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  return {
    id: `kakao_${doc.id}`,
    name: String(doc.place_name || "").trim() || "이름 없음",
    address: String(
      doc.road_address_name || doc.address_name || ""
    ).trim(),
    category: String(doc.category_name || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    _kakaoDoc: doc,
  };
}

/**
 * `searchPlacesForCourse` 결과 뒤에 카카오 키워드 후보를 붙입니다.
 * DB에 이미 `kakao_place_id` 가 있으면 UUID 행으로 합류해 중복을 줄입니다.
 *
 * @param {Awaited<ReturnType<typeof searchPlacesForCourse>>} dbHits
 * @param {string} query
 * @param {{ maxTotal?: number, kakaoSize?: number }} [options]
 */
export async function mergeCourseSearchWithKakao(dbHits, query, options = {}) {
  const maxTotal =
    typeof options.maxTotal === "number" && options.maxTotal > 0
      ? Math.min(48, Math.floor(options.maxTotal))
      : 24;
  const kakaoSize = options.kakaoSize ?? 12;

  const merged = Array.isArray(dbHits) ? [...dbHits] : [];
  const seen = new Set(
    merged.map((h) => String(h?.id || "").trim()).filter(Boolean)
  );

  const docs = await fetchKakaoKeywordDocumentsForCourseEditor(
    query,
    kakaoSize
  );

  for (const doc of docs) {
    if (merged.length >= maxTotal) break;
    if (!doc || doc.id == null) continue;
    const kid = String(doc.id).trim();
    if (!/^\d+$/.test(kid)) continue;

    const existingUuid = await fetchPlaceUuidByKakaoPlaceId(kid);
    if (existingUuid) {
      const uuidStr = String(existingUuid);
      if (seen.has(uuidStr)) continue;
      const { data, error } = await supabase
        .from("places")
        .select(PLACES_COURSE_SELECT_WITH_PLACE_NAME)
        .eq("id", uuidStr)
        .maybeSingle();
      if (error) {
        const retry = await supabase
          .from("places")
          .select(PLACES_COURSE_SELECT_BASIC)
          .eq("id", uuidStr)
          .maybeSingle();
        if (!retry.error && retry.data) {
          merged.push(mapPlaceRowForCourse(retry.data));
          seen.add(uuidStr);
        }
        continue;
      }
      if (data) {
        merged.push(mapPlaceRowForCourse(data));
        seen.add(uuidStr);
      }
      continue;
    }

    const hit = courseSearchHitFromKakaoDocument(doc);
    if (!hit.id || hit.id === "") continue;
    merged.push(hit);
  }

  return merged.slice(0, maxTotal);
}
