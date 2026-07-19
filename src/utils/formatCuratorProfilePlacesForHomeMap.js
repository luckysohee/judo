import { formatBoundsPlaceRowsForMap } from "./formatBoundsPlaceRowsForMap";
import { resolvePlaceWgs84 } from "./placeCoords";

/**
 * 큐레이터 프로필 `fetchPlacesForCuratorPage` 행 → 홈 지도·칩 필터 호환 객체
 */
export function formatCuratorProfilePlaceForHomeMap(place, curatorAuthUserId) {
  if (!place || typeof place !== "object") return null;
  const base = formatBoundsPlaceRowsForMap([place])[0];
  if (!base) return null;
  const cid = String(curatorAuthUserId ?? "").trim();
  const comment =
    place.comment != null && String(place.comment).trim()
      ? String(place.comment).trim()
      : "";
  const w = resolvePlaceWgs84(place);
  return {
    ...base,
    ...place,
    name: place.name ?? base.name,
    lat: w?.lat ?? base.lat,
    lng: w?.lng ?? base.lng,
    x: w?.lng != null ? String(w.lng) : base.x,
    y: w?.lat != null ? String(w.lat) : base.y,
    comment,
    curatorCount: cid ? 1 : 0,
    curatorPlaces: cid
      ? [
          {
            curator_id: cid,
            one_line_reason: comment || null,
          },
        ]
      : [],
    is_public: place.is_public !== false,
  };
}

export function formatCuratorProfilePlacesForHomeMap(places, curatorAuthUserId) {
  return (places || [])
    .map((p) => formatCuratorProfilePlaceForHomeMap(p, curatorAuthUserId))
    .filter(Boolean);
}

/**
 * 홈 `dbPlaces`에 큐레이터 프로필 장소를 합친다.
 * 이미 있는 장소는 `curatorPlaces`만 보강해 칩 필터가 걸리게 한다.
 * @param {unknown[]} prev
 * @param {unknown[]} mapPlaces
 * @returns {unknown[]}
 */
export function mergeCuratorProfilePlacesIntoDbPlaces(prev, mapPlaces) {
  const base = Array.isArray(prev) ? prev : [];
  const incoming = Array.isArray(mapPlaces) ? mapPlaces.filter(Boolean) : [];
  if (incoming.length === 0) return base;

  const next = base.map((p) => ({ ...p }));
  const indexById = new Map(
    next.map((p, i) => [String(p?.id ?? "").trim(), i]).filter(([id]) => id)
  );

  for (const mp of incoming) {
    const id = String(mp?.id ?? "").trim();
    if (!id) continue;
    const idx = indexById.get(id);
    if (idx == null) {
      indexById.set(id, next.length);
      next.push(mp);
      continue;
    }
    const existing = next[idx];
    const existingCp = Array.isArray(existing.curatorPlaces)
      ? existing.curatorPlaces
      : [];
    const newCp = Array.isArray(mp.curatorPlaces) ? mp.curatorPlaces : [];
    const seen = new Set(
      existingCp
        .map((cp) => String(cp?.curator_id ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    const mergedCp = [...existingCp];
    for (const cp of newCp) {
      const cid = String(cp?.curator_id ?? "").trim().toLowerCase();
      if (cid && seen.has(cid)) continue;
      if (cid) seen.add(cid);
      mergedCp.push(cp);
    }
    const existingW = resolvePlaceWgs84(existing);
    const mpW = resolvePlaceWgs84(mp);
    const listPin =
      Boolean(existing.isListSpreadPin) || Boolean(mp.isListSpreadPin);
    /** 맛집첩 펼침이면 리스트 쪽 좌표·사진·이름을 우선 (기존 뷰포트 행에 덮이지 않게) */
    const nextLat = listPin
      ? (mpW?.lat ?? existingW?.lat ?? mp.lat)
      : (existingW?.lat ?? mp.lat);
    const nextLng = listPin
      ? (mpW?.lng ?? existingW?.lng ?? mp.lng)
      : (existingW?.lng ?? mp.lng);
    next[idx] = {
      ...existing,
      ...mp,
      ...(listPin ? mp : existing),
      lat: nextLat,
      lng: nextLng,
      x: nextLng != null ? String(nextLng) : existing.x ?? mp.x,
      y: nextLat != null ? String(nextLat) : existing.y ?? mp.y,
      name: listPin
        ? mp.name || existing.name
        : existing.name || mp.name,
      curatorPlaces: mergedCp,
      curatorCount: Math.max(
        Number(existing.curatorCount) || 0,
        Number(mp.curatorCount) || 0,
        mergedCp.length
      ),
      comment: listPin
        ? mp.comment || existing.comment || ""
        : existing.comment || mp.comment || "",
      isListSpreadPin: listPin,
      listOrderIndex:
        mp.listOrderIndex ?? existing.listOrderIndex ?? undefined,
      courseStepThumbUrl: listPin
        ? mp.courseStepThumbUrl || existing.courseStepThumbUrl || null
        : existing.courseStepThumbUrl || mp.courseStepThumbUrl || null,
      image_url: listPin
        ? mp.image_url || existing.image_url || null
        : existing.image_url || mp.image_url || null,
    };
  }
  return next;
}

/**
 * 맛집첩 「지도에 펼치기」로 붙인 핀만 제거한다.
 * (닫기 시 마커 소거 — 뷰포트 재조회로 일반 추천 핀은 복구)
 * @param {unknown[]} prev
 * @returns {unknown[]}
 */
export function removeListSpreadPinsFromDbPlaces(prev) {
  const base = Array.isArray(prev) ? prev : [];
  return base.filter((p) => !p?.isListSpreadPin);
}

/** 큐레이터 프로필 미니 지도(`MapView`)용 */
export function formatCuratorProfilePlacesForMapView(
  places,
  curatorDisplayName
) {
  const label = String(curatorDisplayName ?? "").trim();
  return (places || [])
    .map((row) => {
      const w = resolvePlaceWgs84(row);
      if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) return null;
      return {
        id: row.id,
        name: row.name,
        region: row.region,
        address: row.address,
        image: row.image_url,
        comment: row.comment,
        lat: w.lat,
        lng: w.lng,
        x: String(w.lng),
        y: String(w.lat),
        savedCount: Number(row.save_count || 0),
        curators: label ? [label] : [],
        primaryCurator: label || undefined,
        tags: [],
        is_public: row.is_public !== false,
      };
    })
    .filter(Boolean);
}
