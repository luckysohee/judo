/** 코스 지도에서 1·2차 사이 쩜오차 핀 — 🍦 전용 SVG */
export function isCourseBridgeMapPin(place) {
  if (!place?.isCoursePin) return false;
  if (/쩜오/.test(String(place?.courseMapCaption || ""))) return true;
  return (
    Number(place.courseStepIndex) === 2 &&
    Number(place.courseLegCount) >= 3
  );
}

/** 앱에 등록된 큐레이터 추천 장소 → 마커 안내(단일/공동/프리미엄) 등급 표시 */
export function isCuratorListedPlace(place) {
  if (typeof place?.curatorCount === "number" && place.curatorCount > 0) {
    return true;
  }
  if (Array.isArray(place?.curatorPlaces) && place.curatorPlaces.length > 0) {
    return true;
  }
  if (Array.isArray(place?.curators) && place.curators.length > 0) {
    return true;
  }
  return false;
}

/** 장소에 추천을 단 distinct 큐레이터 수 (마커 안내 등급 기준) */
export function countDistinctCuratorsOnPlace(place) {
  if (typeof place?.curatorCount === "number" && place.curatorCount > 0) {
    return place.curatorCount;
  }

  const ids = new Set();
  if (Array.isArray(place?.curatorPlaces)) {
    for (const cp of place.curatorPlaces) {
      const cid = String(cp?.curator_id ?? "").trim().toLowerCase();
      if (cid) ids.add(cid);
      const uid = String(cp?.curators?.user_id ?? "").trim().toLowerCase();
      if (uid) ids.add(uid);
      const handle = String(cp?.curators?.username ?? "").trim().toLowerCase();
      if (handle) ids.add(`@${handle}`);
    }
  }
  if (ids.size > 0) return ids.size;

  if (Array.isArray(place?.curators) && place.curators.length > 0) {
    return place.curators.length;
  }
  return 0;
}

/** 큐레이터 등급 — Bootstrap geo-alt-fill 핀 색 (단일 / 공동 / 프리미엄) */
export function getMarkerTier(place) {
  const curatorCount = countDistinctCuratorsOnPlace(place) || 1;

  if (curatorCount >= 3) {
    return {
      level: "premium",
      fill: "#7c3aed",
      label: `${curatorCount}`,
    };
  }

  if (curatorCount === 2) {
    return {
      level: "hot",
      fill: "#ea580c",
      label: "2",
    };
  }

  return {
    level: "basic",
    fill: "#16a34a",
    label: "",
  };
}
