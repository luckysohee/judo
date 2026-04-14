/**
 * 지도 클릭 좌표 기준 근처 카카오 Places (categorySearch) → 1건.
 * 정확도: 클릭 지점과의 직선 거리(haversine)를 최우선, 동일 구역(~18m) 안에서만
 * 술집 키워드·카테고리(FD6>CE7>AD5)로 동점 처리.
 * 반경은 단계적으로 넓혀 탭 오차·빈 결과를 줄임.
 */

const RADII_M = [48, 95, 150];
/** 동점 구간(미터): 이보다 가까우면 거리 동률로 보고 키워드·카테고리로 정렬 */
const DISTANCE_TIE_METERS = 18;

const CATEGORY_ORDER = [
  ["FD6", 0], // 음식점
  ["CE7", 1], // 카페
  ["AD5", 2], // 숙박
];

const BAR_KEYWORDS = [
  "바",
  "펍",
  "와인",
  "이자카야",
  "포차",
  "호프",
  "주점",
  "비어",
  "술집",
  "맥주",
  "와인바",
];

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function metersFromClick(clickLat, clickLng, doc) {
  const y = parseFloat(doc.y);
  const x = parseFloat(doc.x);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return 1e9;
  return haversineM(clickLat, clickLng, y, x);
}

function barKeywordScore(doc) {
  if (!doc || typeof doc !== "object") return 0;
  const t = `${doc.place_name || ""} ${doc.category_name || ""}`;
  let s = 0;
  for (const kw of BAR_KEYWORDS) {
    if (kw && t.includes(kw)) s += 1;
  }
  return s;
}

function compareCandidates(a, b, clickLat, clickLng) {
  const da = metersFromClick(clickLat, clickLng, a);
  const db = metersFromClick(clickLat, clickLng, b);
  if (Math.abs(da - db) > DISTANCE_TIE_METERS) {
    return da - db;
  }
  const sb = barKeywordScore(b) - barKeywordScore(a);
  if (sb !== 0) return sb;
  if (a._catPri !== b._catPri) return a._catPri - b._catPri;
  return da - db;
}

function mergeIntoById(map, rows, clickLat, clickLng) {
  for (const row of rows) {
    if (!row || row.id == null) continue;
    const id = String(row.id);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, row);
      continue;
    }
    const dNew = metersFromClick(clickLat, clickLng, row);
    const dOld = metersFromClick(clickLat, clickLng, prev);
    if (dNew < dOld - 0.5) map.set(id, row);
    else if (Math.abs(dNew - dOld) <= 0.5 && row._catPri < prev._catPri) {
      map.set(id, row);
    }
  }
}

function runCategorySearch(code, loc, radius, catPri) {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve([]);
      return;
    }
    try {
      const ps = new window.kakao.maps.services.Places();
      const Status = window.kakao.maps.services.Status;
      const SortBy = window.kakao.maps.services.SortBy;
      ps.categorySearch(
        code,
        (data, status) => {
          if (status !== Status.OK || !data?.length) {
            resolve([]);
            return;
          }
          resolve(
            data.map((row) => ({
              ...row,
              _catPri: catPri,
              _categoryGroupCode: code,
            }))
          );
        },
        { location: loc, radius, sort: SortBy.DISTANCE }
      );
    } catch {
      resolve([]);
    }
  });
}

/** category로 못 잡을 때 1회 (술집 키워드) */
function keywordFallbackSuljip(lat, lng, radiusM) {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve([]);
      return;
    }
    try {
      const ps = new window.kakao.maps.services.Places();
      const Status = window.kakao.maps.services.Status;
      const SortBy = window.kakao.maps.services.SortBy;
      const loc = new window.kakao.maps.LatLng(lat, lng);
      ps.keywordSearch(
        "술집",
        (data, status) => {
          if (status !== Status.OK || !data?.length) {
            resolve([]);
            return;
          }
          resolve(
            data.map((row) => ({
              ...row,
              _catPri: 0,
              _categoryGroupCode: "KW_SUL",
            }))
          );
        },
        { location: loc, radius: radiusM, sort: SortBy.DISTANCE }
      );
    } catch {
      resolve([]);
    }
  });
}

async function collectAtRadius(lat, lng, radiusM) {
  const loc = new window.kakao.maps.LatLng(lat, lng);
  const tasks = CATEGORY_ORDER.map(([code, pri]) =>
    runCategorySearch(code, loc, radiusM, pri)
  );
  const lists = await Promise.all(tasks);
  return lists.flat();
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{ radii?: number[] }} [options]
 * @returns {Promise<{ kind: 'place', doc: object, lat: number, lng: number } | { kind: 'empty', lat: number, lng: number }>}
 */
export async function resolveMapClickVenue(lat, lng, options = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { kind: "empty", lat, lng };
  }

  if (!window.kakao?.maps?.services) {
    return { kind: "empty", lat, lng };
  }

  const radii =
    Array.isArray(options.radii) && options.radii.length > 0
      ? options.radii
      : RADII_M;

  const byId = new Map();
  for (const r of radii) {
    const radius = Number(r);
    if (!Number.isFinite(radius) || radius <= 0) continue;
    const rows = await collectAtRadius(lat, lng, radius);
    mergeIntoById(byId, rows, lat, lng);
  }

  if (byId.size === 0) {
    const kwRows = await keywordFallbackSuljip(
      lat,
      lng,
      Math.min(180, radii[radii.length - 1] || 150)
    );
    mergeIntoById(byId, kwRows, lat, lng);
  }

  const merged = [...byId.values()];
  merged.sort((a, b) => compareCandidates(a, b, lat, lng));
  const best = merged[0];
  if (!best) {
    return { kind: "empty", lat, lng };
  }
  const { _catPri, _categoryGroupCode, ...doc } = best;
  const distM = metersFromClick(lat, lng, doc);
  return {
    kind: "place",
    doc: { ...doc, distance: String(Math.round(distM)) },
    lat,
    lng,
  };
}

/**
 * categorySearch 문서 → 홈 미리보기 카드용 (큐레이터 마커와 동일 계열)
 */
export function kakaoPlacesDocToMapClickPreview(doc) {
  if (!doc) return null;
  const plat = parseFloat(doc.y);
  const plng = parseFloat(doc.x);
  if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
  return {
    id: `kakao_${doc.id}`,
    name: doc.place_name,
    place_name: doc.place_name,
    lat: plat,
    lng: plng,
    x: doc.x,
    y: doc.y,
    address: doc.road_address_name || doc.address_name,
    road_address_name: doc.road_address_name,
    address_name: doc.address_name,
    category_name: doc.category_name,
    category: doc.category_name,
    phone: doc.phone,
    kakao_place_id: doc.id,
    place_url: doc.place_url || "",
    isKakaoPlace: true,
    isLive: true,
    mapClickResolvedPlace: true,
    distance: doc.distance,
  };
}
