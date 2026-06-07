import { supabase } from "../../lib/supabase";
import { fetchCuratorPlacesMergedWithPlaces } from "../../utils/supabasePlaces";
import { buildFormattedPlacesFromJoin } from "../../utils/buildFormattedPlacesFromJoin";
import { formatBoundsPlaceRowsForMap } from "../../utils/formatBoundsPlaceRowsForMap";
import { buildMergedSavedPlaceKeySet } from "./homeModule";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 80;

async function fetchPlacesByIds(ids) {
  const out = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    const { data, error } = await supabase.from("places").select("*").in("id", slice);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

async function fetchPlacesByKakaoIds(kids) {
  const out = [];
  const unique = [...new Set(kids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("places")
      .select("*")
      .in("kakao_place_id", slice);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

function collectSavedLookupIds(savedKeySet) {
  const uuids = [];
  const kakaoIds = [];
  for (const key of savedKeySet) {
    const s = String(key ?? "").trim();
    if (!s) continue;
    if (UUID_RE.test(s)) {
      uuids.push(s);
      continue;
    }
    if (/^\d+$/.test(s)) {
      kakaoIds.push(s);
      continue;
    }
    if (s.startsWith("kakao_")) {
      const kid = s.slice("kakao_".length);
      if (/^\d+$/.test(kid)) kakaoIds.push(kid);
    }
  }
  return { uuids, kakaoIds };
}

function dedupePlaceRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const id = String(r?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

/**
 * 홈 지도 노란별 — 뷰포트 밖 저장·추천 장소까지 좌표 포함해 불러온다.
 */
export async function fetchMySavedPlacesForHomeMap({
  userId,
  isCurator,
  savedMap,
  userSavedPlaces,
}) {
  const uid = String(userId ?? "").trim();
  if (!uid) return [];

  const savedKeySet = buildMergedSavedPlaceKeySet(savedMap, userSavedPlaces);

  if (isCurator) {
    const merged = await fetchCuratorPlacesMergedWithPlaces(supabase, uid);
    const joinRows = (merged || []).filter((r) => r?.places);
    const ownRecommended = buildFormattedPlacesFromJoin(joinRows);

    if (!savedKeySet.size) return ownRecommended;

    const { uuids, kakaoIds } = collectSavedLookupIds(savedKeySet);
    const extraRows = dedupePlaceRows([
      ...(uuids.length ? await fetchPlacesByIds(uuids) : []),
      ...(kakaoIds.length ? await fetchPlacesByKakaoIds(kakaoIds) : []),
    ]);
    const formattedExtra = formatBoundsPlaceRowsForMap(extraRows);
    const byId = new Map();
    for (const p of [...ownRecommended, ...formattedExtra]) {
      const id = String(p?.id ?? "");
      if (id) byId.set(id, p);
    }
    return [...byId.values()];
  }

  if (!savedKeySet.size) return [];

  const { uuids, kakaoIds } = collectSavedLookupIds(savedKeySet);
  const rows = dedupePlaceRows([
    ...(uuids.length ? await fetchPlacesByIds(uuids) : []),
    ...(kakaoIds.length ? await fetchPlacesByKakaoIds(kakaoIds) : []),
  ]);
  return formatBoundsPlaceRowsForMap(rows);
}
