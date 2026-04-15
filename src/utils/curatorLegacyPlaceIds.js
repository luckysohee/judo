/**
 * curator_places.curator_id 에 과거 public.curators.id 가 남아 있고,
 * curators 행 PK 를 바꾼 뒤에는 필터·조인 별칭이 어긋날 수 있음.
 * 이 맵으로 칩 키(username) ↔ 레거시 uuid 를 양방향 보강한다.
 */
const LEGACY_CURATOR_PLACE_ID_TO_USERNAMES_LC = {
  c57a5dc38d634a7781e1bfb22065c5b7: ["soju_anjo", "소주안조"],
};

/** 장소 쪽 키 집합: 레거시 uuid 가 있으면 해당 핸들도 넣음 */
export function addLegacyPlaceCuratorAliasesToKeySet(keys) {
  if (!keys || typeof keys.forEach !== "function") return;
  const snapshot = [...keys].map((k) => String(k).trim().toLowerCase());
  for (const k of snapshot) {
    const compact = k.replace(/-/g, "");
    const names = LEGACY_CURATOR_PLACE_ID_TO_USERNAMES_LC[compact];
    if (!names?.length) continue;
    for (const n of names) {
      const t = String(n).trim().toLowerCase();
      if (t) keys.add(t);
    }
  }
}

/** 칩 선택 키 집합: 해당 큐레이터 핸들이면 레거시 place curator_id 도 매칭에 포함 */
export function addLegacyPlaceCuratorIdsForUsername(usernameLc, add) {
  const u = String(usernameLc ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/u, "");
  if (!u || typeof add !== "function") return;
  for (const [legacyCompact, names] of Object.entries(
    LEGACY_CURATOR_PLACE_ID_TO_USERNAMES_LC
  )) {
    if (!names.some((n) => String(n).trim().toLowerCase() === u)) continue;
    const dashed = legacyCompact.replace(
      /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
      "$1-$2-$3-$4-$5"
    );
    add(dashed.toLowerCase());
    add(legacyCompact);
  }
}

/** raw 칩 값이 레거시 uuid 그 자체인 경우 → 핸들 키도 확장 */
export function expandLegacyPlaceCuratorIdIfAny(rawLc, add) {
  const compact = String(rawLc ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
  const names = LEGACY_CURATOR_PLACE_ID_TO_USERNAMES_LC[compact];
  if (!names?.length || typeof add !== "function") return;
  for (const n of names) {
    const t = String(n).trim().toLowerCase();
    if (t) add(t);
  }
}
