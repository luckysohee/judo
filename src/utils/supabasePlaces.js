import { supabase } from "../lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_ID_BATCH = 120;
/** 프로덕션 `places` 스키마와 일치 — 없는 컬럼(region·image_url·comment·is_public)은 PostgREST 42703 유발 */
const PLACE_SELECT = [
  "id",
  "name",
  "category",
  "lat",
  "lng",
  "tags",
  "address",
  "kakao_place_id",
  "atmosphere",
  "alcohol_type",
  "created_at",
].join(",");

function normalizeEmbedPlace(placesField) {
  if (!placesField) return null;
  if (Array.isArray(placesField)) return placesField[0] ?? null;
  if (typeof placesField === "object") return placesField;
  return null;
}

function partitionPlaceLookupKeys(placeIds) {
  const uuids = [];
  const kakaoIds = [];
  const other = [];
  for (const raw of placeIds || []) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    if (UUID_RE.test(s)) uuids.push(s);
    else if (/^\d+$/.test(s)) kakaoIds.push(s);
    else other.push(s);
  }
  return { uuids, kakaoIds, other };
}

function ingestPlaceIntoLookup(lookup, row) {
  if (!row || row.id == null) return;
  const idKey = String(row.id).trim();
  if (!idKey) return;
  lookup.set(idKey, row);
  const kid =
    row.kakao_place_id != null ? String(row.kakao_place_id).trim() : "";
  if (kid) lookup.set(kid, row);
}

function resolvePlaceFromLookup(lookup, placeId) {
  const key = String(placeId ?? "").trim();
  if (!key || !lookup) return null;
  return lookup.get(key) ?? null;
}

function curatorPlaceReason(cp) {
  return cp.one_line_reason != null && String(cp.one_line_reason).trim() !== ""
    ? String(cp.one_line_reason).trim()
    : null;
}

function mergeCuratorPlaceRow(cp, placeRow) {
  const reason = curatorPlaceReason(cp);
  const review =
    cp.one_line_review != null ? String(cp.one_line_review).trim() : "";
  const menu =
    cp.menu_reason != null ? String(cp.menu_reason).trim() : "";
  const notes = [reason, review, menu].filter(Boolean).join(" · ");
  return {
    ...placeRow,
    comment: notes || reason || null,
    one_line_reason: reason,
    one_line_review: review || null,
    menu_reason: menu || null,
  };
}

/**
 * `places.id`(uuid) · `kakao_place_id` 혼합 키를 안전하게 조회.
 * PostgREST `id=in.(…)` 400(잘못된 uuid·타입 혼합) 방지.
 */
/**
 * `places.id`(uuid) · `kakao_place_id` 혼합 키 조회.
 * @param {import("@supabase/supabase-js").SupabaseClient} [supabaseClient]
 * @param {unknown[]} placeIds
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchPlacesByLookupKeys(supabaseClient, placeIds) {
  const client = supabaseClient || supabase;
  const lookup = new Map();
  const { uuids, kakaoIds, other } = partitionPlaceLookupKeys(placeIds);

  const fetchInBatches = async (column, keys) => {
    const unique = [...new Set(keys.map((k) => String(k).trim()).filter(Boolean))];
    for (let i = 0; i < unique.length; i += PLACE_ID_BATCH) {
      const slice = unique.slice(i, i + PLACE_ID_BATCH);
      if (!slice.length) continue;

      const { data, error } = await client
        .from("places")
        .select(PLACE_SELECT)
        .in(column, slice);

      if (error) {
        if (slice.length <= 16) {
          await Promise.all(
            slice.map(async (key) => {
              const { data: one, error: oneErr } = await client
                .from("places")
                .select(PLACE_SELECT)
                .eq(column, key)
                .maybeSingle();
              if (!oneErr && one) ingestPlaceIntoLookup(lookup, one);
            })
          );
          continue;
        }
        throw error;
      }

      (data || []).forEach((row) => ingestPlaceIntoLookup(lookup, row));
    }
  };

  await fetchInBatches("id", uuids);
  await fetchInBatches("kakao_place_id", kakaoIds);

  for (const key of other) {
    const { data, error } = await client
      .from("places")
      .select(PLACE_SELECT)
      .eq("id", key)
      .maybeSingle();
    if (!error && data) ingestPlaceIntoLookup(lookup, data);
    else {
      const byKakao = await client
        .from("places")
        .select(PLACE_SELECT)
        .eq("kakao_place_id", key)
        .maybeSingle();
      if (!byKakao.error && byKakao.data) {
        ingestPlaceIntoLookup(lookup, byKakao.data);
      }
    }
  }

  return lookup;
}

function buildPlaceRowsFromCuratorPlaces(cps, placeLookup) {
  const seen = new Set();
  const out = [];
  for (const cp of cps) {
    const pid = cp?.place_id;
    const pidKey = String(pid ?? "").trim();
    if (!pidKey || seen.has(pidKey)) continue;
    const p = resolvePlaceFromLookup(placeLookup, pidKey);
    if (!p) continue;
    seen.add(pidKey);
    out.push(mergeCuratorPlaceRow(cp, p));
  }
  return out;
}

/**
 * 레거시: `places.primary_curator_id` = `curators.id`(PK).
 * 신규 추천은 `curator_places`만 쓰는 경우가 많아, 공개 프로필은 {@link fetchPlacesForCuratorPage} 를 쓴다.
 */
export async function fetchPlacesByPrimaryCuratorId(curatorId) {
  if (!curatorId) return [];

  const { data, error } = await supabase
    .from("places")
    .select(PLACE_SELECT)
    .eq("primary_curator_id", curatorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * 공개 큐레이터 프로필 장소 목록.
 * - 우선 `curator_places` where `curator_id` = `curators.user_id` (auth uid).
 * - `user_id` 없는 레거시 행만 `places.primary_curator_id` 폴백.
 */
export async function fetchPlacesForCuratorPage(curatorRow) {
  if (!curatorRow) return [];

  const uid =
    curatorRow.user_id != null
      ? String(curatorRow.user_id).trim()
      : "";
  if (uid) {
    return fetchCuratorPlacesAsPlaceRowsByUserId(uid);
  }

  return fetchPlacesByPrimaryCuratorId(curatorRow.id);
}

/**
 * curator_places.curator_id(= auth uid) 기준 추천 장소를 `places` 행 형태로 반환 (한 place_id 1행).
 */
async function fetchCuratorPlacesAsPlaceRowsByUserId(curatorUserId) {
  if (!curatorUserId) return [];

  const cpFilter = supabase
    .from("curator_places")
    .select(
      "place_id, one_line_reason, one_line_review, menu_reason, created_at, places(*)"
    )
    .eq("curator_id", curatorUserId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  const { data: embedRows, error: embedErr } = await cpFilter;

  if (!embedErr) {
    const cps = Array.isArray(embedRows) ? embedRows : [];
    const fromEmbed = [];
    const seen = new Set();
    for (const cp of cps) {
      const pidKey = String(cp?.place_id ?? "").trim();
      if (!pidKey || seen.has(pidKey)) continue;
      const embedded = normalizeEmbedPlace(cp.places);
      if (!embedded) continue;
      seen.add(pidKey);
      fromEmbed.push(mergeCuratorPlaceRow(cp, embedded));
    }
    if (fromEmbed.length > 0) return fromEmbed;
  }

  const { data: cpRows, error: cpErr } = await supabase
    .from("curator_places")
    .select("place_id, one_line_reason, one_line_review, menu_reason, created_at")
    .eq("curator_id", curatorUserId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  if (cpErr) throw cpErr;

  const cps = Array.isArray(cpRows) ? cpRows : [];
  if (cps.length === 0) return [];

  const placeIds = [...new Set(cps.map((r) => r?.place_id).filter(Boolean))];
  if (placeIds.length === 0) return [];

  const placeLookup = await fetchPlacesByLookupKeys(supabase, placeIds);
  return buildPlaceRowsFromCuratorPlaces(cps, placeLookup);
}

/**
 * 스튜디오 등: `curator_places` + `places` 를 임베드 없이 병합.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseClient
 * @param {string} curatorUserId `curators.user_id` (= auth uid)
 * @returns {Promise<Array<{ places: object | null, [key: string]: unknown }>>}
 */
export async function fetchCuratorPlacesMergedWithPlaces(
  supabaseClient,
  curatorUserId
) {
  const uid = String(curatorUserId ?? "").trim();
  if (!uid || !supabaseClient) return [];

  const { data: cpRows, error: cpErr } = await supabaseClient
    .from("curator_places")
    .select(
      "id, place_id, created_at, curator_id, one_line_reason, tags, alcohol_types, moods, display_name, is_archived"
    )
    .eq("curator_id", uid)
    .order("created_at", { ascending: false });

  if (cpErr) throw cpErr;

  const cps = Array.isArray(cpRows) ? cpRows : [];
  if (cps.length === 0) return [];

  const placeIds = [...new Set(cps.map((r) => r?.place_id).filter(Boolean))];
  const placeLookup = await fetchPlacesByLookupKeys(supabaseClient, placeIds);

  return cps.map((cp) => ({
    ...cp,
    places: resolvePlaceFromLookup(placeLookup, cp.place_id),
  }));
}
