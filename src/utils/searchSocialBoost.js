import { mapPlaceStableDedupeKey } from "./mergeMapSearchPlacesDedupe";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** place_picks 행 가중(일반 1·큐레이터 4) + 한잔 건당 5 — 원시 신호 상한(로그 전) */
const RAW_SIGNAL_CAP = 110;
/** `aiScore`에 더해지는 보조 점수 상한 — 의도·거리·패널티를 이기지 못하게 */
const SCORE_DELTA_CAP = 4.35;
const LOG_SCALE = 1.08;

/**
 * 로그형 보조 가산. 픽·한잔이 많아도 `SCORE_DELTA_CAP` 이하.
 *
 * @param {number} pickWeightedSum — `SUM(is_curator ? 4 : 1)` per place
 * @param {number} hanjanCount — `check_ins` 건수(동일 place_id 키)
 * @returns {number}
 */
export function dampedSearchSocialScoreDelta(pickWeightedSum, hanjanCount) {
  const pw = Math.max(0, Number(pickWeightedSum) || 0);
  const h = Math.max(0, Number(hanjanCount) || 0);
  const raw = pw + h * 5;
  if (raw <= 0) return 0;
  const capped = Math.min(raw, RAW_SIGNAL_CAP);
  return Math.min(Math.log1p(capped) * LOG_SCALE, SCORE_DELTA_CAP);
}

function isDbUuid(s) {
  const t = String(s ?? "").trim();
  return t.length > 0 && UUID_RE.test(t);
}

/**
 * `place_picks.place_id`(UUID) 매칭용.
 * @param {object} place
 * @returns {string|null}
 */
export function extractDbPlaceUuidForPicks(place) {
  if (!place || typeof place !== "object") return null;
  const candidates = [
    place.place_id,
    place.places?.id,
    place.db_place_id,
    place.id,
  ];
  for (const c of candidates) {
    if (isDbUuid(c)) return String(c).trim().toLowerCase();
  }
  const sid = String(place.id ?? "").trim();
  if (sid.startsWith("local_")) {
    const rest = sid.slice("local_".length);
    if (isDbUuid(rest)) return rest.toLowerCase();
  }
  return null;
}

/**
 * `check_ins.place_id`(varchar, 보통 카카오 숫자 id) 매칭용.
 * @param {object} place
 * @returns {string|null}
 */
export function extractCheckInPlaceKey(place) {
  if (!place || typeof place !== "object") return null;
  const k = String(place.kakao_place_id ?? "").trim();
  if (k && /^[0-9]+$/.test(k)) return k;
  const id = String(place.id ?? "").trim();
  const m =
    /^local_([0-9]+)$/i.exec(id) ||
    /^kakao_([0-9]+)$/i.exec(id) ||
    /^kakao([0-9]+)$/i.exec(id);
  if (m && m[1]) return m[1];
  if (/^[0-9]+$/.test(id)) return id;
  return null;
}

/**
 * 후보 장소 목록에 대해 `get_search_social_boost_batch` 호출 후,
 * `mapPlaceStableDedupeKey` → `{ pickW, hanjan }` 레코드.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {object[]} places
 * @param {{ maxKeys?: number }} [opts]
 * @returns {Promise<Record<string, { pickW: number, hanjan: number }>>}
 */
export async function fetchSearchSocialBoostByPlaces(
  supabase,
  places,
  { maxKeys = 96 } = {}
) {
  if (!supabase || !Array.isArray(places) || places.length === 0) {
    return {};
  }
  const uuids = [];
  const kkeys = [];
  const seenU = new Set();
  const seenK = new Set();
  for (const p of places) {
    if (uuids.length >= maxKeys && kkeys.length >= maxKeys) break;
    const u = extractDbPlaceUuidForPicks(p);
    if (u && !seenU.has(u) && uuids.length < maxKeys) {
      seenU.add(u);
      uuids.push(u);
    }
    const k = extractCheckInPlaceKey(p);
    if (k && !seenK.has(k) && kkeys.length < maxKeys) {
      seenK.add(k);
      kkeys.push(k);
    }
  }
  if (uuids.length === 0 && kkeys.length === 0) return {};

  const { data, error } = await supabase.rpc("get_search_social_boost_batch", {
    p_place_uuids: uuids.length ? uuids : [],
    p_hanjan_place_keys: kkeys.length ? kkeys : [],
  });
  if (error) {
    console.warn("[searchSocialBoost] rpc:", error.message || error);
    return {};
  }
  const picksObj =
    data && typeof data.picks === "object" && data.picks !== null
      ? data.picks
      : {};
  const hanjanObj =
    data && typeof data.hanjan === "object" && data.hanjan !== null
      ? data.hanjan
      : {};

  const out = {};
  for (const place of places) {
    const sk = mapPlaceStableDedupeKey(place);
    if (!sk || out[sk] != null) continue;
    const u = extractDbPlaceUuidForPicks(place);
    const k = extractCheckInPlaceKey(place);
    const pickW = u ? Number(picksObj[u] ?? 0) || 0 : 0;
    const han = k ? Number(hanjanObj[k] ?? 0) || 0 : 0;
    if (pickW === 0 && han === 0) continue;
    out[sk] = { pickW, hanjan: han };
  }
  return out;
}
