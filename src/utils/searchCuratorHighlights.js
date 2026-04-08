import {
  buildPlaceScoringProfile,
  parseSearchQuery,
  REGION_KEYWORDS,
} from "./searchParser.js";

function curatorDisplayName(curatorId, dbPlaces, dbCurators) {
  for (const p of dbPlaces || []) {
    for (const cp of p.curatorPlaces || []) {
      if (cp.curator_id === curatorId) {
        return (
          cp.curators?.display_name || cp.display_name || curatorId
        );
      }
    }
  }
  const c = (dbCurators || []).find(
    (x) => x.id === curatorId || x.username === curatorId
  );
  return c?.displayName || c?.name || curatorId;
}

function curatorUsernameForId(curatorId, dbPlaces) {
  for (const p of dbPlaces || []) {
    for (const cp of p.curatorPlaces || []) {
      if (cp.curator_id === curatorId) {
        return cp.curators?.username || cp.curator_id || curatorId;
      }
    }
  }
  return curatorId;
}

/**
 * 검색 의도(주종·지역)와 맞는 DB 추천 장소가 많은 큐레이터 카피.
 * @returns {{ key: string, headline: string, sub: string, curatorId: string, curatorUsername: string }[]}
 */
export function buildCuratorSearchHighlights(query, dbPlaces, dbCurators) {
  const q = String(query || "").trim();
  if (!q || !Array.isArray(dbPlaces) || dbPlaces.length === 0) return [];

  const parsed = parseSearchQuery(q);
  const out = [];

  const primaryAlcohol = parsed.alcohols?.[0] || parsed.alcohol || null;
  if (primaryAlcohol) {
    const counts = new Map();
    for (const place of dbPlaces) {
      const prof = buildPlaceScoringProfile(place);
      if (!prof.alcohol_types.includes(primaryAlcohol)) continue;
      for (const cp of place.curatorPlaces || []) {
        const cid = cp.curator_id;
        if (!cid) continue;
        counts.set(cid, (counts.get(cid) || 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    for (const [cid, n] of top) {
      out.push({
        key: `h-alc-${cid}`,
        headline: `「${primaryAlcohol}」 장소를 많이 저장한 큐레이터`,
        sub: `${curatorDisplayName(cid, dbPlaces, dbCurators)} · ${n}곳`,
        curatorId: cid,
        curatorUsername: curatorUsernameForId(cid, dbPlaces),
      });
    }
  }

  const primaryRegion = parsed.regions?.[0] || parsed.region || null;
  if (primaryRegion) {
    const counts = new Map();
    for (const place of dbPlaces) {
      const prof = buildPlaceScoringProfile(place);
      const hit =
        prof.region === primaryRegion ||
        REGION_KEYWORDS[primaryRegion]?.some((syn) =>
          prof.addressLower.includes(String(syn).toLowerCase())
        );
      if (!hit) continue;
      for (const cp of place.curatorPlaces || []) {
        const cid = cp.curator_id;
        if (!cid) continue;
        counts.set(cid, (counts.get(cid) || 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    for (const [cid, n] of top) {
      out.push({
        key: `h-reg-${cid}`,
        headline: `「${primaryRegion}」 저장이 많은 큐레이터`,
        sub: `${curatorDisplayName(cid, dbPlaces, dbCurators)} · ${n}곳`,
        curatorId: cid,
        curatorUsername: curatorUsernameForId(cid, dbPlaces),
      });
    }
  }

  return out.slice(0, 5);
}
