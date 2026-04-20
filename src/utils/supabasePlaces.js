import { supabase } from "../lib/supabase";

/**
 * 레거시: `places.primary_curator_id` = `curators.id`(PK).
 * 신규 추천은 `curator_places`만 쓰는 경우가 많아, 공개 프로필은 {@link fetchPlacesForCuratorPage} 를 쓴다.
 */
export async function fetchPlacesByPrimaryCuratorId(curatorId) {
  if (!curatorId) return [];

  const { data, error } = await supabase
    .from("places")
    .select("*")
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
 * `places(*)` 임베드만 쓰면 RLS/스키마에 따라 `places` 가 비어 리스트가 0건으로 보일 수 있어,
 * curator_places → place_id 목록 → `places` 를 `in` 으로 두 단계로 불러온다.
 */
async function fetchCuratorPlacesAsPlaceRowsByUserId(curatorUserId) {
  if (!curatorUserId) return [];

  const { data: cpRows, error: cpErr } = await supabase
    .from("curator_places")
    .select("place_id, one_line_reason, created_at")
    .eq("curator_id", curatorUserId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  if (cpErr) throw cpErr;

  const cps = Array.isArray(cpRows) ? cpRows : [];
  if (cps.length === 0) return [];

  const placeIds = [...new Set(cps.map((r) => r?.place_id).filter(Boolean))];
  if (placeIds.length === 0) return [];

  const { data: placeRows, error: pErr } = await supabase
    .from("places")
    .select("*")
    .in("id", placeIds);

  if (pErr) throw pErr;

  const placeById = new Map((placeRows || []).map((p) => [p.id, p]));

  const seen = new Set();
  const out = [];
  for (const cp of cps) {
    const pid = cp?.place_id;
    if (!pid || seen.has(pid)) continue;
    const p = placeById.get(pid);
    if (!p) continue;
    seen.add(pid);

    const reason =
      cp.one_line_reason != null && String(cp.one_line_reason).trim() !== ""
        ? String(cp.one_line_reason).trim()
        : null;

    out.push({
      ...p,
      comment: reason ?? p.comment ?? null,
    });
  }

  return out;
}

const PLACE_ID_BATCH = 120;

/**
 * 스튜디오 등: `curator_places` + `places` 를 임베드 없이 병합.
 * `tags`/`alcohol_types`/`moods` 가 jsonb 인 행도 `places` 행은 별도 SELECT 로 붙인다.
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
  const placeById = new Map();

  for (let i = 0; i < placeIds.length; i += PLACE_ID_BATCH) {
    const slice = placeIds.slice(i, i + PLACE_ID_BATCH);
    const { data: plist, error: pErr } = await supabaseClient
      .from("places")
      .select("*")
      .in("id", slice);
    if (pErr) throw pErr;
    (plist || []).forEach((p) => placeById.set(p.id, p));
  }

  return cps.map((cp) => ({
    ...cp,
    places: placeById.get(cp.place_id) ?? null,
  }));
}
