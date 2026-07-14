import { resolvePlaceWgs84 } from "./placeCoords.js";

/**
 * 주소(시·도/시·군) ↔ 좌표 불일치 마커 거르기.
 * DB lat/lng가 주소와 다른 지역인 경우(이태원 뷰에 파주·옹진 핀 등)를 숨긴다.
 */

/** @typedef {{ key: string, re: RegExp, bbox: { minLat: number, maxLat: number, minLng: number, maxLng: number } }} SidoZone */

const SIDO_ZONES = /** @type {SidoZone[]} */ ([
  {
    key: "서울",
    re: /서울특별시|서울시|(?:^|[\s,])서울(?:[\s,]|$)/,
    bbox: { minLat: 37.42, maxLat: 37.72, minLng: 126.76, maxLng: 127.22 },
  },
  {
    key: "인천",
    re: /인천광역시|인천시|(?:^|[\s,])인천(?:[\s,]|$)|옹진군|강화군/,
    bbox: { minLat: 37.0, maxLat: 37.7, minLng: 126.0, maxLng: 126.82 },
  },
  {
    key: "경기",
    re: /경기도|(?:^|[\s,])경기(?:[\s,]|$)|파주시|고양시|김포시|의정부시|남양주시|하남시|광주시에|성남시|수원시|용인시|부천시|안양시|안산시|화성시|광명시|과천시|의왕시|군포시|시흥시|이천시|여주시|양평군|가평군|연천군|포천시|동두천시|오산시|평택시|안성시/,
    bbox: { minLat: 36.85, maxLat: 38.35, minLng: 126.35, maxLng: 127.95 },
  },
  {
    key: "강원",
    re: /강원특별자치도|강원도|(?:^|[\s,])강원(?:[\s,]|$)|춘천시|강릉시|원주시|속초시|동해시|삼척시|홍천군|평창군|정선군/,
    bbox: { minLat: 37.0, maxLat: 38.75, minLng: 127.45, maxLng: 129.5 },
  },
  {
    key: "부산",
    re: /부산광역시|부산시|(?:^|[\s,])부산(?:[\s,]|$)/,
    bbox: { minLat: 34.85, maxLat: 35.4, minLng: 128.75, maxLng: 129.35 },
  },
  {
    key: "대구",
    re: /대구광역시|대구시|(?:^|[\s,])대구(?:[\s,]|$)/,
    bbox: { minLat: 35.7, maxLat: 36.05, minLng: 128.4, maxLng: 128.8 },
  },
  {
    key: "대전",
    re: /대전광역시|대전시|(?:^|[\s,])대전(?:[\s,]|$)/,
    bbox: { minLat: 36.2, maxLat: 36.5, minLng: 127.25, maxLng: 127.55 },
  },
  {
    key: "광주",
    re: /광주광역시/,
    bbox: { minLat: 35.05, maxLat: 35.3, minLng: 126.7, maxLng: 127.05 },
  },
  {
    key: "울산",
    re: /울산광역시|울산시|(?:^|[\s,])울산(?:[\s,]|$)/,
    bbox: { minLat: 35.4, maxLat: 35.7, minLng: 129.05, maxLng: 129.5 },
  },
  {
    key: "세종",
    re: /세종특별자치시|(?:^|[\s,])세종(?:[\s,]|$)/,
    bbox: { minLat: 36.4, maxLat: 36.65, minLng: 127.15, maxLng: 127.4 },
  },
  {
    key: "충북",
    re: /충청북도|충북/,
    bbox: { minLat: 36.35, maxLat: 37.2, minLng: 127.25, maxLng: 128.7 },
  },
  {
    key: "충남",
    re: /충청남도|충남/,
    bbox: { minLat: 36.0, maxLat: 37.1, minLng: 126.3, maxLng: 127.4 },
  },
  {
    key: "전북",
    re: /전북특별자치도|전라북도|전북/,
    bbox: { minLat: 35.35, maxLat: 36.15, minLng: 126.45, maxLng: 127.7 },
  },
  {
    key: "전남",
    re: /전라남도|전남/,
    bbox: { minLat: 34.2, maxLat: 35.5, minLng: 126.1, maxLng: 127.6 },
  },
  {
    key: "경북",
    re: /경상북도|경북/,
    bbox: { minLat: 35.5, maxLat: 37.1, minLng: 128.0, maxLng: 129.7 },
  },
  {
    key: "경남",
    re: /경상남도|경남/,
    bbox: { minLat: 34.5, maxLat: 35.7, minLng: 127.6, maxLng: 129.3 },
  },
  {
    key: "제주",
    re: /제주특별자치도|제주도|(?:^|[\s,])제주(?:[\s,]|$)/,
    bbox: { minLat: 33.1, maxLat: 33.6, minLng: 126.1, maxLng: 127.0 },
  },
]);

/** 서울 시내(이태원·성수·강남 등) — 여기 찍힌 핀에 비서울 주소면 거름 */
const SEOUL_CORE = {
  minLat: 37.43,
  maxLat: 37.7,
  minLng: 126.8,
  maxLng: 127.18,
};

function inBbox(lat, lng, b) {
  return (
    lat >= b.minLat &&
    lat <= b.maxLat &&
    lng >= b.minLng &&
    lng <= b.maxLng
  );
}

/**
 * @param {unknown} place
 * @returns {string}
 */
export function placeAddressHaystack(place) {
  if (!place || typeof place !== "object") return "";
  return [
    place.address,
    place.road_address_name,
    place.address_name,
    place.roadAddress,
    place.name,
    place.place_name,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * @param {string} address
 * @returns {string | null}
 */
export function inferSidoFromAddress(address) {
  const s = String(address || "").trim();
  if (!s) return null;
  for (const z of SIDO_ZONES) {
    if (z.re.test(s)) return z.key;
  }
  return null;
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {string | null}
 */
export function inferSidoFromCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (inBbox(lat, lng, SEOUL_CORE)) return "서울";
  const hits = SIDO_ZONES.filter((z) => inBbox(lat, lng, z.bbox));
  if (hits.length === 1) return hits[0].key;
  if (hits.length === 0) return null;
  const prefer = [
    "서울",
    "인천",
    "세종",
    "대전",
    "광주",
    "대구",
    "울산",
    "부산",
    "제주",
  ];
  for (const k of prefer) {
    if (hits.some((h) => h.key === k)) return k;
  }
  return hits[0].key;
}

/**
 * 주소 시·도와 좌표 시·도가 둘 다 확실한데 다르면 false.
 *
 * @param {object | null | undefined} place
 * @returns {boolean}
 */
export function placeAddressCoordsConsistent(place) {
  if (!place || typeof place !== "object") return false;
  if (place.isKakaoTypingPreview) return true;

  const wgs = resolvePlaceWgs84(place);
  if (!wgs) return false;

  const hay = placeAddressHaystack(place);
  if (!hay || hay.length < 2) return true;

  const addrSido = inferSidoFromAddress(hay);
  if (!addrSido) return true;

  /**
   * 좌표가 서울 시내인데 주소가 서울이 아니면 무조건 탈락.
   * (예전 경기↔서울 45km 예외가 「파주 주소 + 이태원 좌표」를 통과시킴)
   */
  if (inBbox(wgs.lat, wgs.lng, SEOUL_CORE) && addrSido !== "서울") {
    return false;
  }

  const coordSido = inferSidoFromCoords(wgs.lat, wgs.lng);
  if (!coordSido) return true;

  return addrSido === coordSido;
}

/**
 * @param {object[]} places
 * @returns {object[]}
 */
export function filterPlacesByAddressCoordConsistency(places) {
  if (!Array.isArray(places)) return [];
  return places.filter((p) => placeAddressCoordsConsistent(p));
}
