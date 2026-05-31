/**
 * Home 페이지 모듈 레벨 상수·순수 함수 (Phase 1 — Home.jsx 슬림화).
 * React 컴포넌트 밖에서만 두어 빌드 시 트리셰이킹·테스트 분리에 유리하게 한다.
 */

import { SITUATION_FOLDER } from "../../utils/situationPlaceFilter";
import { getMarkerTier, isCuratorListedPlace } from "../../utils/createMarker";
import {
  resolvePlaceWgs84,
  isLikelyKoreaWgs84,
} from "../../utils/placeCoords";
import { normalizeKakaoPlaceId } from "../../utils/mergePickedPlaceWithCuratorCatalog";
import { getPrimarySavedFolderColor } from "../../utils/storage";
import {
  addLegacyPlaceCuratorAliasesToKeySet,
  addLegacyPlaceCuratorIdsForUsername,
  addLegacyPlaceCuratorIdsForCuratorProfile,
  expandLegacyPlaceCuratorIdIfAny,
  legacyCompactUuidToDashed,
  legacyPlaceCuratorIdCompactsForProfile,
} from "../../utils/curatorLegacyPlaceIds";

/** 낮 모드에서 지도 LIVE 펄스용으로 빈 Set 재사용 */
const EMPTY_LIVE_PLACE_IDS = new Set();

/** 「1차·2차·분위기」빠른 칩 — 코스 아님·단발 검색 (`mapViewportChipSearch` 로 지도 뷰 기준만) */
const DRINKS_SITUATION_CHIP_SINGLE_SHOT_QUERY = {
  [SITUATION_FOLDER.firstMeal]:
    "회식 고기 삼겹살 집밥 맛집 소고기 국밥 족발 보쌈",
  [SITUATION_FOLDER.secondRound]:
    "포차 술집 바 하이볼 안주 요리주점 이자카야 펍 위스키",
  [SITUATION_FOLDER.vibe]:
    "분위기 데이트 와인 조용한 술집",
};

function shuffleArray(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toHotStripRow(placeLike, fallbackWeight = 0) {
  if (!placeLike || typeof placeLike !== "object") return null;
  const pid = String(
    placeLike.place_id ??
      placeLike.kakao_place_id ??
      placeLike.kakaoId ??
      placeLike.id ??
      "",
  ).trim();
  if (!pid) return null;
  const name = String(placeLike.place_name ?? placeLike.name ?? "").trim();
  if (!name) return null;
  const totalCheckins = Math.max(
    0,
    Number(
      placeLike.total_checkins ??
        placeLike.checkin_count ??
        placeLike.total_dedup ??
        0,
    ) || 0,
  );
  const weightedPick = Math.max(
    0,
    Number(
      placeLike.pick_weighted ??
        placeLike.pick_w ??
        placeLike.pick_weight ??
        placeLike.pick_count ??
        placeLike.total_picks ??
        0,
    ) || 0,
  );
  const score = totalCheckins * 5 + weightedPick * 3 + fallbackWeight;
  return {
    place_id: pid,
    place_name: name,
    place_address: String(
      placeLike.place_address ??
        placeLike.address ??
        placeLike.road_address_name ??
        placeLike.address_name ??
        "",
    ).trim(),
    total_checkins: totalCheckins,
    _score: score,
  };
}

/** 술 상황 칩(펼친 지도 뷰 기준)—화면 안 상위 결과만 두고 과다 마커·줌아웃 완화 */
const SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS = 48;
/** 일반 지도 검색: SDK phrase 병합 상한 / 술 칩만 더 많이 합침 */
const MAP_SDK_MERGE_MAX_DEFAULT = 12;
const MAP_SDK_MERGE_MAX_SITUATION_CHIP = 24;
/** 술 칩: 의도 필터 후 이 개수 미만이면 뷰포트만 통과한 풀로 완화(퓨전일식만 남는 등 왜곡 방지) */
const SITUATION_CHIP_INTENT_RELAX_THRESHOLD = 8;
/** `curators` 행 프로필 사진 — 스키마·시기별로 image / avatar_url / avatar 로 갈린다 */
function curatorRowProfileImage(row) {
  if (!row || typeof row !== "object") return null;
  for (const key of ["image", "avatar_url", "avatar"]) {
    const v = row[key];
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return null;
}

/** 술 칩에 `/api/search/curator-places` 후보를 최대 몇 개까지 엔진에 섞을지 */
const SITUATION_CHIP_CURATOR_BLEND_MAX = 6;
/** 칩 큐레이터 API 반경 상한 — 15km는 화면 밖 성수 등이 섞이기 쉬움 */
const SITUATION_CHIP_CURATOR_API_MAX_DISTANCE_M = 3500;
/** 칩 병합 시 화면 기준점에서 이보다 먼 큐레이터 매칭은 제외 (표시 거리 ~4km 이상 성격 제거) */
const SITUATION_CHIP_CURATOR_BLEND_MAX_DISTANCE_M = 3000;
/** 엔진이 이미 거리순으로 줄 세운 뒤, 큐레이터 항목 전에 두는 최소 비큐레이터 슬롯 */
const SITUATION_CHIP_MIN_KAKAO_BEFORE_CURATOR = 5;

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 뷰포트에 이미 있는 `places` 행과 매칭되는 큐레이터 DB 검색만 지도·리스트에 섞는다.
 * @param {{ lat?: number, lng?: number } | null} [sortOrigin] — 없으면 거리 게이트 생략
 */
function mergeSituationChipCuratorPlaces(
  biasedRows,
  dbSearchRows,
  viewportPlaces,
  maxResults,
  sortOrigin = null
) {
  const cap = Math.min(
    Number(maxResults) || SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS,
    SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS
  );
  if (
    !Array.isArray(biasedRows) ||
    !Array.isArray(dbSearchRows) ||
    dbSearchRows.length === 0 ||
    !Array.isArray(viewportPlaces) ||
    viewportPlaces.length === 0
  ) {
    return biasedRows;
  }
  const byId = new Map();
  for (const p of viewportPlaces) {
    const id = String(p?.id ?? "");
    if (id) byId.set(id, p);
  }
  const curatorShapes = [];
  for (const row of dbSearchRows) {
    const pid = String(row.place_id ?? "");
    if (!pid) continue;
    const base = byId.get(pid);
    if (!base) continue;
    const lat = Number(base.lat);
    const lng = Number(base.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (
      sortOrigin &&
      Number.isFinite(Number(sortOrigin.lat)) &&
      Number.isFinite(Number(sortOrigin.lng))
    ) {
      const distM = haversineDistanceMeters(
        Number(sortOrigin.lat),
        Number(sortOrigin.lng),
        lat,
        lng
      );
      if (!Number.isFinite(distM) || distM > SITUATION_CHIP_CURATOR_BLEND_MAX_DISTANCE_M) {
        continue;
      }
    }
    curatorShapes.push({
      ...base,
      place_name: base.name ?? base.place_name,
      name: base.name,
      y: String(lat),
      x: String(lng),
      lat,
      lng,
      category_name:
        base.category_name ||
        (base.category ? String(base.category) : "") ||
        "큐레이터 추천",
      address_name: base.address_name || base.address || "",
      road_address_name: base.road_address_name || "",
      phone: base.phone || "",
      isExternal: true,
      isLive: true,
      isKakaoPlace: true,
      source: "curator_db_chip",
      recommendation: "큐레이터 추천 장소",
      reason: "큐레이터 추천 장소",
      id: base.id,
    });
    if (curatorShapes.length >= SITUATION_CHIP_CURATOR_BLEND_MAX) break;
  }
  if (curatorShapes.length === 0) return biasedRows;

  const seenCur = new Set(curatorShapes.map((p) => String(p.id)));
  const kakaoRest = biasedRows.filter((p) => !seenCur.has(String(p.id)));

  const out = [];
  let ci = 0;
  let ki = 0;
  while (out.length < cap && (ci < curatorShapes.length || ki < kakaoRest.length)) {
    const curatorSlot =
      ci < curatorShapes.length &&
      out.length >= SITUATION_CHIP_MIN_KAKAO_BEFORE_CURATOR &&
      (out.length - SITUATION_CHIP_MIN_KAKAO_BEFORE_CURATOR) % 6 === 0;
    if (curatorSlot) {
      out.push(curatorShapes[ci++]);
    } else if (ki < kakaoRest.length) {
      out.push(kakaoRest[ki++]);
    } else if (ci < curatorShapes.length) {
      out.push(curatorShapes[ci++]);
    } else {
      break;
    }
  }
  return out;
}

/**
 * 통합 검색 phrase 분리 — 의도 보조가 만든 「지역 포차」류 전국 검색 대신 칩 의도별로만 호출.
 * (서버는 phrase당 카카오·네이버 병합 후 클라에서 뷰포트·SDK bounds로 한정)
 */
const DRINKS_SITUATION_CHIP_UNIFIED_PHRASES = {
  [SITUATION_FOLDER.firstMeal]: [
    "삼겹살",
    "고기집",
    "한식",
    "곱창",
    "갈비",
    "회식",
    "소고기",
    "국밥",
    "족발",
    "보쌈",
  ],
  [SITUATION_FOLDER.secondRound]: [
    "포장마차",
    "포차",
    "하이볼",
    "이자카야",
    "펍",
    "바",
    "위스키",
    "횟집",
    "조개구이",
    "술집",
  ],
  [SITUATION_FOLDER.vibe]: [
    "와인바",
    "칵테일바",
    "와인",
    "조용한 술집",
    "분위기 술집",
  ],
};

const DRINKS_SITUATION_CHIP_RESULT_HINTS = {
  [SITUATION_FOLDER.firstMeal]: {
    include: [
      "고기",
      "육류",
      "삼겹",
      "갈비",
      "스테이크",
      "식사",
      "밥",
      "한식",
      "회식",
      "소고기",
      "국밥",
      "족발",
      "보쌈",
    ],
    exclude: ["해산물", "횟집", "조개", "포차", "바", "하이볼", "칵테일"],
  },
  [SITUATION_FOLDER.secondRound]: {
    include: [
      "해산물",
      "횟집",
      "조개",
      "포차",
      "술집",
      "바",
      "하이볼",
      "안주",
      "이자카야",
      "펍",
      "위스키",
    ],
    exclude: ["국밥", "백반", "삼겹", "갈비", "스테이크", "브런치"],
  },
};
/** `unified-map-search` 병렬 네이버 지역 phrase 상한 — `mergeIntentAssistIntoSearchPhrases` JSDoc 참고 */
const UNIFIED_MAP_MERGE_MAX_PHRASES = 6;

function sanitizeSheetStoryLine(v) {
  let s = String(v || "")
    .replace(/\*{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  // 문장 앞의 연결어/잔여 형태소 제거 (예: "으로, ...", "적인 인테리어...")
  s = s
    .replace(
      /^(?:으로|에서|와|과|및|그리고|또|또한|혹은|또는|한편|그리고는)\s*[,.:，]?\s*/i,
      ""
    )
    .replace(/^적인\s+/, "")
    .replace(/^이\s*세\s*곳(?:은|으로|에서는)?\s*[,.:，]?\s*/i, "")
    .trim();
  // 여러 장소를 순번으로 설명하는 꼬리 문장(두 번째는…, 다음은…) 제거
  s = s
    .replace(/\s*(?:첫|두|세|네)\s*번째(?:는|로|로는)?[\s,:，].*$/i, "")
    .replace(/\s*(?:다음(?:은|으로)?|마지막(?:으로|은)?|또\s*다른)[\s,:，].*$/i, "")
    .replace(/\s*이\s*세\s*곳(?:은|으로|에서는)?[\s,:，].*$/i, "")
    .trim();
  s = s.replace(/[,\s]+$/, "").trim();
  return s;
}

function sanitizeBusinessName(v) {
  let s = String(v || "")
    .replace(/\*{1,3}/g, "")
    .replace(/\.\.\.$/, "")
    .replace(/…$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  s = s
    .replace(
      /^(?:.*?(?:역맛집|맛집|추천|데이트|분위기|모임|검색결과|키워드)\s+)/i,
      ""
    )
    .replace(/^[-:|/·\s]+/, "")
    .trim();
  const isKeywordLike = (x) =>
    /(맛집|추천|데이트|분위기|모임|검색결과|키워드)/i.test(x);
  if (isKeywordLike(s) && s.includes(" ")) {
    const tokens = s.split(/\s+/).filter(Boolean);
    const lastGood = [...tokens]
      .reverse()
      .find((t) => t.length >= 2 && !isKeywordLike(t));
    if (lastGood) s = lastGood;
  }
  return s.trim();
}

/** MapView `DEFAULT_MAP_CENTER` 와 동일 — 첫 진입·정렬 기준점 등(술 상황 칩은 지도를 여기로 끌지 않음) */
const SEONGSU_MAP_CENTER = { lat: 37.54465, lng: 127.05595 };

/** 검색 피크·하단 탭·safe area — 과하면 지도가 더 어긋나 보여서 보수적으로만 보정 */
function searchMapBottomChromePx() {
  if (typeof window === "undefined") return 120;
  return Math.min(
    220,
    Math.max(92, Math.round(window.innerHeight * 0.11) + 68),
  );
}

/** 홈 지도 위 중앙 인트로(세션당 1회) — sessionStorage */
/** v2: 지도보다 뒤에 그려져 안 보이던 문제 — DOM 순서·z-index 수정 후 키 갱신 */
const HOME_CENTER_DUST_INTRO_KEY = "judo_home_center_dust_intro_v2";

/** KST 기준 검색바 placeholder — 오후 / 밤 / 그 외 */
function getHomeSearchPlaceholderKst(homeSearchChannel) {
  let hour;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hv = parts.find((p) => p.type === "hour")?.value;
    hour = hv != null ? Number(hv) : new Date().getHours();
  } catch {
    hour = new Date().getHours();
  }
  let core;
  if (hour >= 12 && hour < 18) {
    core = "지금 한잔하기 좋은 곳";
  } else if (hour >= 18 || hour < 5) {
    core = "2차 어디갈까";
  } else {
    /** + 는 브랜드가 아니라 «지명 + 1차 + 어디로» 조합 가이드용 구분 */
    core = "예: 합정 1차 어디로";
  }
  if (homeSearchChannel === "ai") {
    return `AI 주도 검색 · ${core}`;
  }
  if (homeSearchChannel === "auto") {
    return "을지로 데이트 코스";
  }
  return core;
}

/** 지도 「2차 찾기」— 1차 기준 후보·카카오 검색 반경 상한 */
const COURSE_SECOND_FIND_DISTANCE_OPTIONS = [
  { m: 1000, label: "1km 안쪽" },
  { m: 3000, label: "3km 안" },
  { m: 5000, label: "5km 안" },
];
// 비우면 `/api/*` 상대 경로 → Vite proxy → server:4000
const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(/\/$/, "");

/** 내 위치 GPS 코스: 기본 3km, 시트에서 5·8km로 확장 */
const COURSE_GPS_RADIUS_OPTIONS = [
  { m: 3000, label: "3km" },
  { m: 5000, label: "5km" },
  { m: 8000, label: "8km" },
];
const COURSE_GPS_DEFAULT_RADIUS_M = 3000;

/**
 * 전체 지도 검색에서 지도만 옮길 때 `성수 데이트 코스`처럼 긴 키워드로 카카오 keywordSearch 하면
 * 1위가 한강·랜드마크 등 지역과 무관한 POI가 되어, 뷰포트·단일 결과 미리보기가 엉뚱하게 열릴 수 있다.
 * 추출된 지역명이 있으면 역·동·구 단위 앵커로 이동한다.
 */
const MAP_PAN_STATION_ALIAS = new Set([
  "성수",
  "강남",
  "삼성",
  "동대문",
  "서울",
  "을지",
  "건대",
  "홍대",
  "신촌",
  "잠실",
  "여의도",
  "압구정",
  "청담",
  "한남",
  "이태원",
  "연남",
  "망원",
  "합정",
  "상수",
  "영등포",
  "건대입구",
  "혜화",
  "광화문",
]);

function mapPanAnchorKeyword(locationName, fallbackKeyword) {
  const ln = String(locationName || "").trim();
  if (!ln) return fallbackKeyword;
  if (/역$/u.test(ln) || /동$/u.test(ln) || /구$/u.test(ln)) return ln;
  if (MAP_PAN_STATION_ALIAS.has(ln) || ln.length <= 3) {
    return `${ln}역`;
  }
  return ln;
}

/** 카카오 `Map#getCenter()` → `{ lat, lng }` (LatLng는 getLat/getLng만 있음) */
function readKakaoMapCenterLatLng(mapRef) {
  const mc = mapRef?.current?.getCenter?.();
  if (!mc) return null;
  if (typeof mc.getLat === "function" && typeof mc.getLng === "function") {
    const lat = mc.getLat();
    const lng = mc.getLng();
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (Number.isFinite(Number(mc.lat)) && Number.isFinite(Number(mc.lng))) {
    return { lat: Number(mc.lat), lng: Number(mc.lng) };
  }
  return null;
}

/** 우측 마커 안내(단일·공동·프리미엄) 선택 시 지도에 표시할 장소만 남김 */
function applyLegendCategoryFilter(places, legendCategory) {
  if (!legendCategory || !Array.isArray(places)) return places;

  if (
    legendCategory === "basic" ||
    legendCategory === "hot" ||
    legendCategory === "premium"
  ) {
    return places.filter((p) => {
      if (!isCuratorListedPlace(p)) return false;
      return getMarkerTier(p).level === legendCategory;
    });
  }

  return places;
}

/**
 * 미리보기 카드로 연 장소가 `mapDisplayedPlacesWithLegend`에서 빠지면 핀이 안 보임.
 * (큐레이터 전용 핀 모드에서 kPins를 비움, 범례가 큐레이터 등급만 표시 등)
 */
function selectedVenuePinAlreadyOnMap(places, selectedPlace) {
  if (!selectedPlace || !Array.isArray(places)) return true;
  const wSel = resolvePlaceWgs84(selectedPlace);
  if (!wSel) return false;
  const selId = selectedPlace.id != null ? String(selectedPlace.id) : "";
  const selKid = normalizeKakaoPlaceId(selectedPlace);
  return places.some((p) => {
    if (selId && String(p?.id ?? "") === selId) {
      const w = resolvePlaceWgs84(p);
      return Boolean(w && isLikelyKoreaWgs84(w.lat, w.lng));
    }
    const pk = normalizeKakaoPlaceId(p);
    if (!selKid || !pk || selKid !== pk) return false;
    const w = resolvePlaceWgs84(p);
    return Boolean(w && isLikelyKoreaWgs84(w.lat, w.lng));
  });
}

function appendSelectedPlacePinIfMissing(places, selectedPlace) {
  if (!selectedPlace || !Array.isArray(places)) return places;
  const w = resolvePlaceWgs84(selectedPlace);
  if (!w) return places;
  const geoOk = isLikelyKoreaWgs84(w.lat, w.lng);
  if (!geoOk && !(Number.isFinite(w.lat) && Number.isFinite(w.lng))) {
    return places;
  }
  if (selectedVenuePinAlreadyOnMap(places, selectedPlace)) return places;
  return [
    {
      ...selectedPlace,
      lat: w.lat,
      lng: w.lng,
      x: String(w.lng),
      y: String(w.lat),
    },
    ...places,
  ];
}

/** DB `places` 상세 fetch 결과를 미리보기 객체에 합침 — 큐레이터·태그는 `enrichedFromJoin`이 있으면 그걸로 보강 */
function mergeDbPlaceDetailForPreview(prev, detail, enrichedFromJoin) {
  if (!prev || !detail || typeof detail !== "object") return prev;
  const e =
    enrichedFromJoin && typeof enrichedFromJoin === "object"
      ? enrichedFromJoin
      : null;
  const useEnriched =
    e &&
    Array.isArray(e.curatorPlaces) &&
    e.curatorPlaces.length > 0;

  return {
    ...prev,
    ...detail,
    curatorPlaces: useEnriched ? e.curatorPlaces : prev.curatorPlaces ?? [],
    curatorCount: useEnriched ? e.curatorCount : prev.curatorCount,
    curatorReasons: useEnriched ? e.curatorReasons : prev.curatorReasons,
    curatorUsernames: useEnriched ? e.curatorUsernames : prev.curatorUsernames,
    curators: useEnriched ? e.curators : prev.curators,
    tags:
      e && Array.isArray(e.tags) && e.tags.length > 0
        ? e.tags
        : Array.isArray(prev.tags) && prev.tags.length > 0
          ? prev.tags
          : Array.isArray(detail.tags)
            ? detail.tags
            : prev.tags,
    moods:
      e && Array.isArray(e.moods) && e.moods.length > 0
        ? e.moods
        : Array.isArray(prev.moods) && prev.moods.length > 0
          ? prev.moods
          : detail.moods ?? prev.moods,
    vibes:
      e && Array.isArray(e.vibes) && e.vibes.length > 0
        ? e.vibes
        : Array.isArray(prev.vibes) && prev.vibes.length > 0
          ? prev.vibes
          : detail.vibes ?? prev.vibes,
    is_public: prev.is_public,
  };
}

/**
 * 장소에 붙은 추천(curator_places) ↔ 칩 키(username·display_name·auth uid) 교차 매칭.
 * curator_id 는 curators.user_id — PostgREST FK 임베드 대신 attachCuratorsToCuratorPlaceRows 로 보강.
 */
function collapseCuratorMatchToken(s) {
  return String(s ?? "")
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, "");
}

function buildPlaceCuratorFilterKeySet(place, dbCurators) {
  const keys = new Set();
  const add = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return;
    keys.add(s);
    const collapsed = collapseCuratorMatchToken(s);
    if (collapsed && collapsed !== s) keys.add(collapsed);
  };
  for (const v of place.curatorUsernames || []) add(v);
  for (const v of place.curators || []) add(v);
  for (const cp of place.curatorPlaces || []) {
    add(cp.curator_id);
    add(cp.curators?.username);
    add(cp.curators?.display_name);
    add(cp.curators?.user_id);
    add(cp.curators?.id);
  }
  if (Array.isArray(dbCurators) && dbCurators.length > 0) {
    for (const cp of place.curatorPlaces || []) {
      const cid = String(cp.curator_id ?? "").trim().toLowerCase();
      const cpUser = String(cp.curators?.username ?? "").trim().toLowerCase();
      if (!cid && !cpUser) continue;
      for (const c of dbCurators) {
        const rowUid = String(c.userId ?? "").trim().toLowerCase();
        const rowPk = String(c.id ?? "").trim().toLowerCase();
        const rowName = String(c.username ?? "").trim().toLowerCase();
        const matchById =
          Boolean(cid) &&
          ((rowUid && rowUid === cid) || (rowPk && rowPk === cid));
        const matchByHandle =
          !cid && Boolean(cpUser) && Boolean(rowName) && rowName === cpUser;
        if (!matchById && !matchByHandle) continue;
        add(c.username);
        add(c.displayName);
        add(c.filterKey);
        add(c.name);
        add(c.slug);
        add(c.id);
        if (rowUid) add(rowUid);
      }
    }
  }
  addLegacyPlaceCuratorAliasesToKeySet(keys);
  return keys;
}

/** 칩에서 넘긴 문자열(@제거·소문자)을 dbCurators 행의 모든 별칭으로 확장 */
function expandCuratorChipSelectionKeys(raw, dbCurators) {
  const sel = String(raw ?? "")
    .trim()
    .replace(/^@+/u, "")
    .toLowerCase();
  const out = new Set();
  if (!sel) return out;
  out.add(sel);
  const selCollapsed = collapseCuratorMatchToken(sel);
  if (selCollapsed && selCollapsed !== sel) out.add(selCollapsed);
  expandLegacyPlaceCuratorIdIfAny(sel, (x) => out.add(x));
  addLegacyPlaceCuratorIdsForUsername(sel, (x) => out.add(x));
  if (selCollapsed && selCollapsed !== sel) {
    addLegacyPlaceCuratorIdsForUsername(selCollapsed, (x) => out.add(x));
  }
  for (const c of dbCurators || []) {
    const aliases = [
      c.username,
      c.displayName,
      c.name,
      c.filterKey,
      c.slug,
      c.id,
      c.userId,
    ]
      .map((x) =>
        String(x ?? "")
          .trim()
          .replace(/^@+/u, "")
          .toLowerCase()
      )
      .filter(Boolean);
    const aliasMatch = new Set(aliases);
    for (const a of aliases) {
      const ac = collapseCuratorMatchToken(a);
      if (ac) aliasMatch.add(ac);
    }
    if (!aliasMatch.has(sel) && !aliasMatch.has(selCollapsed)) continue;
    aliases.forEach((a) => {
      out.add(a);
      const ac = collapseCuratorMatchToken(a);
      if (ac) out.add(ac);
    });
    const handleLc =
      String(c.username ?? "")
        .trim()
        .toLowerCase()
        .replace(/^@+/u, "") ||
      String(c.slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/^@+/u, "") ||
      String(c.filterKey ?? "")
        .trim()
        .toLowerCase()
        .replace(/^@+/u, "");
    if (handleLc) {
      addLegacyPlaceCuratorIdsForUsername(handleLc, (x) => out.add(x));
    }
    addLegacyPlaceCuratorIdsForCuratorProfile(c, (x) => out.add(x));
  }
  return out;
}

/**
 * PostgREST 임베드가 «칩·필터에 쓸 표시명/핸들»까지 있는지.
 * id·user_id 만 오고 username/display_name 이 비는 경우가 있어, 그때는 attach 로 덮어쓴다.
 */
function curatorJoinRowLooksComplete(c) {
  if (c == null) return false;
  if (Array.isArray(c)) {
    if (c.length === 0) return false;
    return curatorJoinRowLooksComplete(c[0]);
  }
  if (typeof c !== "object") return false;
  const u = c.username != null ? String(c.username).trim() : "";
  const d = c.display_name != null ? String(c.display_name).trim() : "";
  return Boolean(u || d);
}

/**
 * curator_places.curator_id (= curators.user_id) 로 curators 행을 붙임 (임베드 없이).
 */
function attachCuratorsToCuratorPlaceRows(rows, curatorRows) {
  const map = new Map();
  for (const c of curatorRows || []) {
    const uid = String(c.user_id ?? "").trim().toLowerCase();
    const pk = String(c.id ?? "").trim().toLowerCase();
    if (uid) map.set(uid, c);
    if (pk) map.set(pk, c);
    for (const lc of legacyPlaceCuratorIdCompactsForProfile(c)) {
      const dashed = legacyCompactUuidToDashed(lc);
      if (!dashed) continue;
      map.set(dashed, c);
      map.set(lc, c);
    }
  }
  return (rows || []).map((row) => {
    const key = String(row?.curator_id ?? "").trim().toLowerCase();
    const compact = key.replace(/-/g, "");
    const hit = key
      ? map.get(key) || (compact ? map.get(compact) : null)
      : null;
    if (!hit) return row;
    const cur = row?.curators && typeof row.curators === "object" ? row.curators : null;
    const hasName = Boolean(String(cur?.name ?? "").trim());
    if (curatorJoinRowLooksComplete(cur) && hasName) return row;
    return {
      ...row,
      curators: {
        ...hit,
        ...cur,
        name:
          String(cur?.name ?? "").trim() ||
          String(hit?.name ?? "").trim() ||
          "",
        display_name: cur?.display_name ?? hit?.display_name ?? "",
        username: cur?.username ?? hit?.username ?? "",
        slug: cur?.slug ?? hit?.slug ?? "",
      },
    };
  });
}

/** 칩 문자열·uuid → `dbCurators` 포맷 행 한 개 (필터 구조 보강용) */
function findDbCuratorRowForChip(rawSel, dbCurators) {
  const raw = String(rawSel ?? "").trim();
  if (!raw) return null;
  const selLower = raw.toLowerCase();
  const selCollapsed = collapseCuratorMatchToken(raw);
  for (const c of dbCurators || []) {
    const parts = [
      c.username,
      c.displayName,
      c.name,
      c.filterKey,
      c.slug,
      c.id != null ? String(c.id).trim() : "",
      c.userId != null ? String(c.userId).trim() : "",
    ].filter(Boolean);
    for (const p of parts) {
      const pl = String(p).trim().toLowerCase();
      if (pl === selLower) return c;
      if (collapseCuratorMatchToken(p) === selCollapsed) return c;
    }
  }
  const compact = selLower.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/.test(compact)) {
    for (const c of dbCurators || []) {
      const idc = String(c.id ?? "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "");
      const uidc = String(c.userId ?? "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "");
      if (idc && idc === compact) return c;
      if (uidc && uidc === compact) return c;
    }
  }
  return null;
}

/** `curator_places.curator_id`(= user_id) 와 직접 비교할 auth·프로필 uuid 집합 */
function collectCuratorIdsForRescueMatch(c) {
  const s = new Set();
  const add = (v) => {
    const t = String(v ?? "").trim().toLowerCase();
    if (!t) return;
    s.add(t);
    s.add(t.replace(/-/g, ""));
  };
  if (!c) return s;
  add(c.userId);
  const profile = {
    username: c.username,
    display_name: c.displayName,
    displayName: c.displayName,
    name: c.name,
    slug: c.slug,
    filterKey: c.filterKey,
  };
  for (const lc of legacyPlaceCuratorIdCompactsForProfile(profile)) {
    add(lc);
    const dashed = legacyCompactUuidToDashed(lc);
    if (dashed) add(dashed);
  }
  return s;
}

/**
 * 칩에서 넘긴 값을 curator_places.curator_id(= curators.user_id) 기준으로 정규화한다.
 */
function canonicalCuratorChipToken(key, dbCurators) {
  const k = String(key ?? "").trim();
  if (!k) return "";
  const kLower = k.toLowerCase();
  const kNorm = kLower.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/.test(kNorm)) {
    for (const c of dbCurators || []) {
      for (const idf of [c.userId, c.id]) {
        const t = String(idf ?? "")
          .trim()
          .toLowerCase()
          .replace(/-/g, "");
        if (t && t === kNorm) {
          return String(c.userId || c.id || k).trim();
        }
      }
    }
  }
  const kColl = collapseCuratorMatchToken(k);
  for (const c of dbCurators || []) {
    const candidates = [
      c.filterKey,
      c.username,
      c.displayName,
      c.name,
      c.slug,
      c.id != null ? String(c.id) : "",
      c.userId != null ? String(c.userId) : "",
    ]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    for (const t of candidates) {
      if (t.toLowerCase() === kLower) {
        return String(c.userId || c.id || k).trim();
      }
      if (collapseCuratorMatchToken(t) === kColl) {
        return String(c.userId || c.id || k).trim();
      }
    }
  }
  return k;
}

/** localStorage(savedMap) + Supabase(user_saved_places → userSavedPlaces) 저장 키 합집합 */
function buildMergedSavedPlaceKeySet(savedMap, userSavedPlaces) {
  const set = new Set();
  if (savedMap && typeof savedMap === "object") {
    for (const [placeId, folderIds] of Object.entries(savedMap)) {
      if (Array.isArray(folderIds) && folderIds.length > 0) {
        set.add(String(placeId));
      }
    }
  }
  if (userSavedPlaces && typeof userSavedPlaces === "object") {
    for (const [placeId, folders] of Object.entries(userSavedPlaces)) {
      if (Array.isArray(folders) && folders.length > 0) {
        set.add(String(placeId));
      }
    }
  }
  return set;
}

/** 미리보기·검색 제안 — UUID·카카오 id·`kakao_*` 프리픽스 등 저장 키 후보 */
function placeSavedLookupKeys(place) {
  if (!place || typeof place !== "object") return [];
  const out = new Set();
  for (const x of [place.id, place.place_id, place.kakao_place_id, place.kakaoId]) {
    if (x == null || x === "") continue;
    const s = String(x).trim();
    if (!s) continue;
    out.add(s);
    if (s.startsWith("kakao_")) {
      const kid = s.slice("kakao_".length);
      if (kid) out.add(kid);
    } else if (/^\d+$/.test(s)) {
      out.add(`kakao_${s}`);
    }
  }
  return [...out];
}

/** 미리보기 카드와 동일하게 UUID·카카오 id 등으로 저장 키와 매칭 */
function placeMatchesSavedKeySet(place, savedKeySet) {
  if (!place || !savedKeySet?.size) return false;
  return placeSavedLookupKeys(place).some((k) => savedKeySet.has(k));
}

function folderColorForSavedKey(savedKey, folders, userSavedPlaces) {
  let folderColor = getPrimarySavedFolderColor(savedKey, folders);
  const sb = userSavedPlaces?.[savedKey];
  if (Array.isArray(sb) && sb[0]?.color) {
    folderColor = folderColor || String(sb[0].color).trim();
  }
  return folderColor || "#e74c3c";
}

function registerBadgeOnKeys(index, badge, keys) {
  for (const raw of keys) {
    const k = String(raw ?? "").trim();
    if (!k) continue;
    index.set(k, badge);
    if (k.startsWith("kakao_")) {
      const kid = k.slice("kakao_".length);
      if (kid) index.set(kid, badge);
    } else if (/^\d+$/.test(k)) {
      index.set(`kakao_${k}`, badge);
    }
  }
}

/**
 * 검색 제안 행 — 네이버 지도식 저장(픽) 배지 색.
 */
function resolveSavedPickBadgeForPlace(
  place,
  savedKeySet,
  folders,
  userSavedPlaces = null
) {
  if (!place || !savedKeySet?.size) return null;
  let matchedKey = null;
  for (const k of placeSavedLookupKeys(place)) {
    if (savedKeySet.has(k)) {
      matchedKey = k;
      break;
    }
  }
  if (!matchedKey) return null;
  return {
    isSaved: true,
    folderColor: folderColorForSavedKey(matchedKey, folders, userSavedPlaces),
  };
}

/**
 * 카카오 검색 제안 ↔ 저장 장소 매칭 인덱스.
 * @param {Record<string, string>} [savedPlaceKakaoByUuid] UUID → 카카오 숫자 id
 */
function buildHomeSearchSavedBadgeIndex(
  savedMap,
  userSavedPlaces,
  folders,
  catalogPlaces = [],
  savedPlaceKakaoByUuid = null
) {
  const keySet = buildMergedSavedPlaceKeySet(savedMap, userSavedPlaces);
  const index = new Map();
  const makeBadge = (savedKey) => ({
    isSaved: true,
    folderColor: folderColorForSavedKey(savedKey, folders, userSavedPlaces),
  });

  const catalogById = new Map();
  for (const p of catalogPlaces) {
    const id = String(p?.id ?? "").trim();
    if (id) catalogById.set(id, p);
  }

  for (const savedKey of keySet) {
    const badge = makeBadge(savedKey);
    registerBadgeOnKeys(index, badge, [savedKey]);

    const linkedKid = savedPlaceKakaoByUuid?.[savedKey];
    if (linkedKid) registerBadgeOnKeys(index, badge, [linkedKid]);

    const place = catalogById.get(savedKey);
    if (place) {
      registerBadgeOnKeys(index, badge, placeSavedLookupKeys(place));
      const kid = normalizeKakaoPlaceId(place);
      if (kid) registerBadgeOnKeys(index, badge, [kid]);
    }
  }

  for (const p of catalogPlaces) {
    const badge = resolveSavedPickBadgeForPlace(
      p,
      keySet,
      folders,
      userSavedPlaces
    );
    if (!badge) continue;
    registerBadgeOnKeys(index, badge, placeSavedLookupKeys(p));
    const kid = normalizeKakaoPlaceId(p);
    if (kid) registerBadgeOnKeys(index, badge, [kid]);
  }

  if (savedPlaceKakaoByUuid && typeof savedPlaceKakaoByUuid === "object") {
    for (const [uuid, kid] of Object.entries(savedPlaceKakaoByUuid)) {
      if (!keySet.has(uuid)) continue;
      const badge = makeBadge(uuid);
      registerBadgeOnKeys(index, badge, [kid, uuid]);
    }
  }

  return { index, keySet };
}

const SEARCH_INTENT_ASSIST_MS = 5500;

/** 코스 카드 가로 스크롤 행 — 뷰 중앙에 가장 가까운 카드 인덱스 */
function getCourseSwipeIndexFromScroll(el) {
  if (!el || el.children.length === 0) return 0;
  const host = el.getBoundingClientRect();
  const midX = host.left + host.width / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < el.children.length; i++) {
    const cr = el.children[i].getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const d = Math.abs(cx - midX);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** DEV: `enrichPlacesWithReason` 직후·UI `slice` 직전 — aiScoreSignals / reasonShort 품질 점검 */
function logSignalsCheckDev(places) {
  if (!import.meta.env.DEV || !Array.isArray(places)) return;
  const top = places.slice(0, 5);
  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    const row = {
      rank: i + 1,
      name: p.place_name || p.name,
      category: p.category_name,
      score: p.aiScore ?? p.score,
      signals: p.aiScoreSignals ?? {},
      reason: p.reasonShort,
      whyRecommended: p.whyRecommended,
      recommendation: p.recommendation,
      matchedFacetLabels: p.matchedFacetLabels,
    };
    console.log(`[signals-check] #${i + 1}`, JSON.stringify(row, null, 2));
  }
  console.log(
    "[signals-check-summary]",
    top.map((p, i) => {
      const sig = p.aiScoreSignals && typeof p.aiScoreSignals === "object"
        ? p.aiScoreSignals
        : {};
      const pos = Object.fromEntries(
        Object.entries(sig).filter(([, v]) => Number(v) > 0)
      );
      const neg = Object.fromEntries(
        Object.entries(sig).filter(([, v]) => Number(v) < 0)
      );
      return {
        rank: i + 1,
        name: p.place_name || p.name,
        score: p.aiScore ?? p.score,
        positiveSignals: pos,
        negativeSignals: neg,
        topSignalKeys: Object.entries(sig)
          .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
          .slice(0, 8)
          .map(([k, v]) => `${k}:${v}`),
      };
    })
  );
}

export {
  EMPTY_LIVE_PLACE_IDS,
  DRINKS_SITUATION_CHIP_SINGLE_SHOT_QUERY,
  shuffleArray,
  toHotStripRow,
  SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS,
  MAP_SDK_MERGE_MAX_DEFAULT,
  MAP_SDK_MERGE_MAX_SITUATION_CHIP,
  SITUATION_CHIP_INTENT_RELAX_THRESHOLD,
  curatorRowProfileImage,
  SITUATION_CHIP_CURATOR_BLEND_MAX,
  SITUATION_CHIP_CURATOR_API_MAX_DISTANCE_M,
  SITUATION_CHIP_CURATOR_BLEND_MAX_DISTANCE_M,
  SITUATION_CHIP_MIN_KAKAO_BEFORE_CURATOR,
  mergeSituationChipCuratorPlaces,
  DRINKS_SITUATION_CHIP_UNIFIED_PHRASES,
  DRINKS_SITUATION_CHIP_RESULT_HINTS,
  UNIFIED_MAP_MERGE_MAX_PHRASES,
  sanitizeSheetStoryLine,
  sanitizeBusinessName,
  SEONGSU_MAP_CENTER,
  searchMapBottomChromePx,
  HOME_CENTER_DUST_INTRO_KEY,
  getHomeSearchPlaceholderKst,
  COURSE_SECOND_FIND_DISTANCE_OPTIONS,
  AI_API_BASE,
  COURSE_GPS_RADIUS_OPTIONS,
  COURSE_GPS_DEFAULT_RADIUS_M,
  MAP_PAN_STATION_ALIAS,
  mapPanAnchorKeyword,
  readKakaoMapCenterLatLng,
  applyLegendCategoryFilter,
  selectedVenuePinAlreadyOnMap,
  appendSelectedPlacePinIfMissing,
  mergeDbPlaceDetailForPreview,
  collapseCuratorMatchToken,
  buildPlaceCuratorFilterKeySet,
  expandCuratorChipSelectionKeys,
  curatorJoinRowLooksComplete,
  attachCuratorsToCuratorPlaceRows,
  findDbCuratorRowForChip,
  collectCuratorIdsForRescueMatch,
  canonicalCuratorChipToken,
  buildMergedSavedPlaceKeySet,
  buildHomeSearchSavedBadgeIndex,
  placeMatchesSavedKeySet,
  placeSavedLookupKeys,
  resolveSavedPickBadgeForPlace,
  SEARCH_INTENT_ASSIST_MS,
  getCourseSwipeIndexFromScroll,
  logSignalsCheckDev,
};
