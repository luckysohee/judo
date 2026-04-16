function curatorLabelNorm(s) {
  return String(s ?? "")
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, "");
}

/**
 * curator_places.curator_id 에 과거 public.curators.id 가 남아 있고,
 * curators 행 PK 를 바꾼 뒤에는 필터·조인 별칭이 어긋날 수 있음.
 * 이 맵으로 칩 키(username) ↔ 레거시 uuid 를 양방향 보강한다.
 */
const LEGACY_CURATOR_PLACE_ID_TO_USERNAMES_LC = {
  c57a5dc38d634a7781e1bfb22065c5b7: ["soju_anjo", "소주안조"],
  /**
   * 레포 시드·한줄평 CSV 등: 야장 계열 curator_places 가 이 curators.id 로 적재된 적 있음.
   * 운영 DB 에서 동일 계정의 curators 행 PK 가 바뀌면 칩(야장마스터)과 장소의 curator_id 가 어긋남.
   */
  "43b3eb72a8354b5bb305da4708b53b5c": [
    "야장마스터",
    "yajang_master",
    "yajangmaster",
    "야장 마스터",
  ],
};

/** 32자 hex(하이픈 유무 무관) → dashed uuid */
export function legacyCompactUuidToDashed(compact) {
  const c = String(compact ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(c)) return null;
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
}

/**
 * curators 행 프로필이 레거시 별칭과 맞으면, 그에 대응하는 curator_places.curator_id(옛 PK) compact 목록.
 * attach 맵에 옛 uuid → 현재 행 을 넣어 조인·필터가 깨지지 않게 한다.
 */
export function legacyPlaceCuratorIdCompactsForProfile(profile) {
  const probes = new Set();
  for (const k of [
    profile?.username,
    profile?.display_name,
    profile?.displayName,
    profile?.name,
    profile?.slug,
    profile?.filterKey,
  ]) {
    const t = curatorLabelNorm(k);
    if (t) probes.add(t);
  }
  if (!probes.size) return [];
  const out = [];
  for (const [legacyCompact, names] of Object.entries(
    LEGACY_CURATOR_PLACE_ID_TO_USERNAMES_LC
  )) {
    const lc = String(legacyCompact).replace(/-/g, "").toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(lc)) continue;
    const hit = names.some((n) => {
      const nn = curatorLabelNorm(n);
      if (!nn) return false;
      if (probes.has(nn)) return true;
      return [...probes].some((p) => {
        if (!p) return false;
        if (p === nn) return true;
        if (nn.length >= 4 && p.includes(nn)) return true;
        return false;
      });
    });
    if (hit) out.push(lc);
  }
  return out;
}

/** 칩 want 집합: 현재 큐레이터 행 프로필에 해당하는 레거시 place curator_id uuid 들 */
export function addLegacyPlaceCuratorIdsForCuratorProfile(profile, add) {
  if (!profile || typeof add !== "function") return;
  for (const lc of legacyPlaceCuratorIdCompactsForProfile(profile)) {
    const dashed = legacyCompactUuidToDashed(lc);
    if (!dashed) continue;
    add(dashed);
    add(lc);
  }
}

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
      const tn = curatorLabelNorm(t);
      if (tn && tn !== t) keys.add(tn);
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
    const uNorm = curatorLabelNorm(u);
    const hitName = names.some((n) => {
      const nn = curatorLabelNorm(n);
      if (!nn) return false;
      if (uNorm === nn) return true;
      if (nn.length >= 4 && uNorm.includes(nn)) return true;
      return false;
    });
    if (!hitName) continue;
    const dashed = legacyCompactUuidToDashed(legacyCompact);
    if (dashed) {
      add(dashed);
      add(String(legacyCompact).replace(/-/g, "").toLowerCase());
    }
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
    const tn = curatorLabelNorm(t);
    if (tn && tn !== t) add(tn);
  }
}
