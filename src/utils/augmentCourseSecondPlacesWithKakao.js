import { searchKakaoKeywordViaProxy } from "./kakaoAPIProxy.js";
import { resolvePlaceWgs84 } from "./placeCoords.js";
import { courseVenueDedupeKey } from "./generateCourseOptions.js";
import { expandAnjuHintTokens } from "./placeTaxonomy.js";

/**
 * 카카오 keywordSearch(1차 주변) → 코스 2차 스코어링용 place 객체.
 * DB `places`와 dedupe 시 `courseVenueDedupeKey`가 맞도록 필드 정렬.
 */
function kakaoDocToCourseCandidatePlace(doc) {
  if (!doc || typeof doc !== "object") return null;
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const toks = String(doc.category_name || "")
    .split(/[>,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const kid = doc.id != null ? String(doc.id).trim() : "";
  return {
    id: kid ? `kakao_${kid}` : `kakao_${doc.place_name || "venue"}`,
    name: doc.place_name,
    place_name: doc.place_name,
    lat,
    lng,
    y: String(lat),
    x: String(lng),
    category_name: doc.category_name || "",
    categories: toks,
    kakao_place_id: kid || null,
    isKakaoPlace: true,
    source: "kakao",
    place_url: doc.place_url || "",
    phone: doc.phone || "",
    address_name: doc.address_name || "",
    road_address_name: doc.road_address_name || "",
    distance: doc.distance,
  };
}

function mergePoolsByVenueKey(primary, secondary) {
  const map = new Map();
  const push = (p) => {
    const k = courseVenueDedupeKey(p);
    if (!k) return;
    if (!map.has(k)) map.set(k, p);
  };
  for (const p of primary || []) push(p);
  for (const p of secondary || []) push(p);
  return [...map.values()];
}

/**
 * 2차 찾기(지도): 1차 좌표 기준 카카오 키워드로 주변 업장을 붙여 DB만으로는 빠지는
 * 포장마차·횟집 등을 후보 풀에 포함.
 *
 * @param {object} firstPlace — 코스 1차 place
 * @param {{ anjuHints?: string[], radius?: number, maxQueries?: number, perQuerySize?: number }} [opts]
 */
export async function fetchKakaoPlacesForCourseSecondAround(firstPlace, opts = {}) {
  const w = resolvePlaceWgs84(firstPlace);
  if (!w) return [];

  const radius =
    opts.radius != null && Number.isFinite(Number(opts.radius))
      ? Math.min(8000, Math.max(400, Number(opts.radius)))
      : 2200;
  const maxQueries =
    opts.maxQueries != null && Number.isFinite(Number(opts.maxQueries))
      ? Math.min(8, Math.max(1, Number(opts.maxQueries)))
      : 6;
  const perQuerySize =
    opts.perQuerySize != null && Number.isFinite(Number(opts.perQuerySize))
      ? Math.min(15, Math.max(5, Number(opts.perQuerySize)))
      : 10;

  const queries = new Set();
  const hints = Array.isArray(opts.anjuHints) ? opts.anjuHints : [];

  for (const h of hints) {
    for (const t of expandAnjuHintTokens(h)) {
      const s = String(t).trim();
      if (s.length >= 2) queries.add(s);
    }
  }

  if (
    hints.some((h) =>
      /해산물|해산물\/회|횟|생선|해물|조개|회/.test(String(h))
    )
  ) {
    [
      "횟집",
      "회집",
      "해물",
      "포장마차",
      "생선회",
      "모둠회",
      "조개구이",
    ].forEach((q) => queries.add(q));
  }
  if (hints.some((h) => /국물|해장|찌개|국밥/.test(String(h)))) {
    ["포장마차", "곱창", "전골"].forEach((q) => queries.add(q));
  }
  if (hints.some((h) => /튀김|치킨/.test(String(h)))) {
    ["치킨", "닭강정"].forEach((q) => queries.add(q));
  }
  if (hints.some((h) => /육류|고기|삼겹|갈비/.test(String(h)))) {
    ["고깃집", "삼겹살"].forEach((q) => queries.add(q));
  }
  if (hints.some((h) => /마른|건어물|오징어/.test(String(h)))) {
    ["포장마차", "맥주"].forEach((q) => queries.add(q));
  }

  if (queries.size === 0) {
    ["포장마차", "술집", "이자카야"].forEach((q) => queries.add(q));
  }

  const list = [...queries].slice(0, maxQueries);
  const seenDoc = new Set();
  const out = [];

  await Promise.all(
    list.map(async (query) => {
      try {
        const { documents } = await searchKakaoKeywordViaProxy({
          query,
          x: w.lng,
          y: w.lat,
          radius,
          size: perQuerySize,
        });
        for (const doc of documents || []) {
          const id = doc?.id != null ? String(doc.id) : "";
          if (!id || seenDoc.has(id)) continue;
          seenDoc.add(id);
          const row = kakaoDocToCourseCandidatePlace(doc);
          if (row) out.push(row);
        }
      } catch {
        /* ignore per-query */
      }
    })
  );

  return out;
}

/**
 * 검색바 키워드 자동완성과 동일 계열(카카오 local keyword) — 쩜오차용 달달·카페 쿼리.
 * 사용자가 입력창에 자주 치는 단어 위주.
 */
const DEFAULT_BRIDGE_KAKAO_QUERIES = [
  "아이스크림",
  "소프트아이스크림",
  "디저트",
  "디저트카페",
  "카페",
  "케이크",
  "빙수",
  "팥빙수",
  "마카롱",
  "젤라또",
  "와플",
  "베이커리",
  "초콜릿",
  "빵",
];

function kakaoDocLooksLikeBridgeStop(doc) {
  const blob = [doc?.place_name, doc?.category_name]
    .map((s) => String(s || "").toLowerCase())
    .join(" ");
  if (!blob.trim()) return false;
  return /카페|커피|coffee|디저트|dessert|아이스|크림|ice|gelato|젤라|빙수|bingsu|케이크|cake|도넛|donut|마카롱|macaron|와플|waffle|초콜|chocolate|베이커리|브레드|빵집|티\s|tea|파르페|스무디|프라페|요거트|froyo/.test(
    blob
  );
}

/**
 * 1차(또는 앵커) 주변 — SearchBar·프록시와 같은 `searchKakaoKeywordViaProxy` 로
 * 디저트·카페 키워드 후보를 모아 쩜오차 풀에 붙임.
 *
 * @param {object} anchorPlace — `resolvePlaceWgs84` 로 좌표 나오는 아무 장소
 * @param {{ radius?: number, queries?: string[], maxQueries?: number, perQuerySize?: number }} [opts]
 */
export async function fetchKakaoPlacesForCourseBridgeAround(anchorPlace, opts = {}) {
  const w = resolvePlaceWgs84(anchorPlace);
  if (!w) return [];

  const radius =
    opts.radius != null && Number.isFinite(Number(opts.radius))
      ? Math.min(8000, Math.max(400, Number(opts.radius)))
      : 2000;
  const queries = Array.isArray(opts.queries) && opts.queries.length
    ? opts.queries.map((q) => String(q).trim()).filter(Boolean)
    : DEFAULT_BRIDGE_KAKAO_QUERIES;
  const maxQueries =
    opts.maxQueries != null && Number.isFinite(Number(opts.maxQueries))
      ? Math.min(12, Math.max(1, Number(opts.maxQueries)))
      : 10;
  const perQuerySize =
    opts.perQuerySize != null && Number.isFinite(Number(opts.perQuerySize))
      ? Math.min(15, Math.max(5, Number(opts.perQuerySize)))
      : 10;

  const list = [...new Set(queries)].slice(0, maxQueries);
  const seenDoc = new Set();
  const out = [];

  await Promise.all(
    list.map(async (query) => {
      try {
        const { documents } = await searchKakaoKeywordViaProxy({
          query,
          x: w.lng,
          y: w.lat,
          radius,
          size: perQuerySize,
        });
        for (const doc of documents || []) {
          if (!kakaoDocLooksLikeBridgeStop(doc)) continue;
          const id = doc?.id != null ? String(doc.id) : "";
          if (!id || seenDoc.has(id)) continue;
          seenDoc.add(id);
          const row = kakaoDocToCourseCandidatePlace(doc);
          if (row) out.push(row);
        }
      } catch {
        /* ignore per-query */
      }
    })
  );

  return out;
}

/**
 * DB 코스 풀 뒤에 카카오 주변 결과를 붙이고, 동일 카카오 id는 한 번만 유지(DB 우선).
 */
export function mergeCoursePlacePoolsWithKakao(dbPlaces, kakaoPlaces) {
  return mergePoolsByVenueKey(dbPlaces || [], kakaoPlaces || []);
}
