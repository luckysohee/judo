/** 홈 `HotCheckinStrip` — 검색바 위 여백(px) */
export const HOME_HOT_STRIP_NAV_CLEARANCE_PX = 108;

/** `Home.jsx` `bottomBarContainer` — 검색바 하단 inset */
export const HOME_SEARCH_BAR_DOCK_BOTTOM_PX = 18;

/** `searchWrapper` / `SearchBar` 한 줄 높이(`homeStyles.searchWrapper.minHeight`와 맞춤) */
export const HOME_SEARCH_BAR_HEIGHT_PX = 54;

/** 맞춤 시트 ↔ 검색바 도킹 시 공통 모서리(radius) */
export const HOME_UI_DOCK_RADIUS_PX = 18;

/** 맞춤 추천 시트·`mapCardOverlay` 하단 — 검색바 상단에 딱 붙음 */
export function homeSearchBarStackBottomCss() {
  return `calc(${HOME_SEARCH_BAR_DOCK_BOTTOM_PX}px + ${HOME_SEARCH_BAR_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`;
}

/** 코스 탭 — 검색바 숨김 시 시트 하단(`Home` `bottomBarContainer` bottom과 동일) */
export const HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX = 18;

/** 탭 한 줄 높이 */
export const HOME_HOT_STRIP_TAB_ROW_PX = 26;

/** 탭 아래 콘텐츠 슬롯 — 칩·아는 사람 한 줄(3탭 스트립) */
export const HOME_HOT_STRIP_CONTENT_SLOT_PX = 32;

/** 바 세로 패딩 합(상·하 각 4px) */
export const HOME_HOT_STRIP_BAR_PAD_V_PX = 8;

/** 탭 행 ↔ 슬롯 사이 gap */
export const HOME_HOT_STRIP_TAB_GAP_PX = 4;

/** 플로팅 스트립 상단 — 탭 Y 고정(코스 탭 아래 확장 시에도 동일) */
export function homeHotStripWrapTopCss() {
  return `calc(100% - ${HOME_HOT_STRIP_NAV_CLEARANCE_PX + homeHotStripBarHeightPx()}px - env(safe-area-inset-bottom, 0px))`;
}

/** 코스 탭 시트 하단 — 빈 검색바 구간까지 채움 */
export function homeHotStripCoursesWrapBottomCss(keyboardInsetPx = 0) {
  const inset = Math.max(0, Math.round(Number(keyboardInsetPx) || 0));
  if (inset <= 0) {
    return `calc(${HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`;
  }
  return `calc(${HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px) + ${inset}px)`;
}

/** 「지금 뜨는 코스」 시트 — 펼침 시 뷰포트 비율 */
export const HOME_COURSES_DISCOVERY_SHEET_EXPANDED_VH = 50;

/** 「지금 뜨는 코스」 시트 — 중간(핸들·제목·가로 미리보기) 높이(px) */
export const HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX = 152;

/** 코스 미리보기 접힘 — 장소 사진 스트립 */
export const HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_BROWSE_PX = 178;

/** 「지금 뜨는 코스」 시트 — 최소(핸들만, 지도 최대 노출) 높이(px) */
export const HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX = 52;

/** 「지금 뜨는 코스」 발견 바텀시트 — 홈 지도 높이 대비(하단 고정·위로 확장) */
export function homeCoursesDiscoverySheetHeightCss() {
  return "min(50dvh, 50%)";
}

/** 키패드 위 여유(px) — 드래그 핸들·탭·검색바 */
export const HOME_COURSES_DISCOVERY_SHEET_KEYBOARD_CHROME_PX = 120;

/**
 * @param {number} [viewportH]
 * @param {{ visibleH?: number, keyboardOpen?: boolean }} [opts]
 * @returns {number}
 */
function readLayoutViewportHeight() {
  if (typeof window === "undefined") return 800;
  const vv = window.visualViewport;
  return Math.max(320, Math.round(vv?.height ?? window.innerHeight));
}

export function homeCoursesDiscoverySheetExpandedPx(
  viewportH,
  { visibleH, keyboardOpen = false } = {}
) {
  const h =
    Number.isFinite(viewportH) && viewportH > 0
      ? viewportH
      : readLayoutViewportHeight();
  const normal = Math.round(
    Math.min(
      (h * HOME_COURSES_DISCOVERY_SHEET_EXPANDED_VH) / 100,
      h * 0.5
    )
  );

  const visible =
    Number.isFinite(visibleH) && visibleH > 0 ? visibleH : readLayoutViewportHeight();
  if (!keyboardOpen || visible >= h - 8) {
    return normal;
  }

  const cap = Math.round(
    visible -
      HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX -
      HOME_COURSES_DISCOVERY_SHEET_KEYBOARD_CHROME_PX
  );
  const minExpanded = HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX + 8;
  return Math.max(minExpanded, Math.min(normal, cap));
}

/**
 * @param {number} visibleH
 * @param {number} [keyboardInsetPx]
 * @returns {string}
 */
export function homeCoursesDiscoverySheetMaxHeightCss(
  visibleH,
  keyboardInsetPx = 0
) {
  const inset = Math.max(0, Math.round(Number(keyboardInsetPx) || 0));
  if (inset <= 0) {
    return homeCoursesDiscoverySheetHeightCss();
  }
  const visible =
    Number.isFinite(visibleH) && visibleH > 0
      ? visibleH
      : readLayoutViewportHeight();
  const maxPx = Math.max(
    HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX + 16,
    Math.round(visible - HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX - 8)
  );
  return `${maxPx}px`;
}

/**
 * 도장 찍기(따라가기) 시트 — 콘텐츠 높이 추정(px). 지도 fit padding·빈 여백 방지.
 * @param {number} stepCount
 * @param {{ completed?: boolean }} [opts]
 */
export function homeCoursesDiscoveryStampSheetHeightPx(
  stepCount = 3,
  { completed = false } = {}
) {
  const n = Math.min(Math.max(1, Math.floor(Number(stepCount) || 3)), 6);
  const thumbMax = n <= 3 ? 88 : 72;
  const labelH = n <= 3 ? 24 : 22;
  let h = 40; // 헤더
  if (!completed) h += 16; // 도장 안내 한 줄
  h += thumbMax + labelH + 10; // 썸네일(최대 4칸 노출) + 차수·이름
  h += 8; // 하단 패딩
  if (n <= 3) h += 12; // 짧은 설명 줄(3곳 이하)
  return h;
}

/** 코스 탭·도장 바텀시트 공통 높이(px) — top/bottom 앵커 간 거리 */
export function homeHotStripCoursesSheetHeightPx() {
  return (
    HOME_HOT_STRIP_NAV_CLEARANCE_PX +
    homeHotStripBarHeightPx() -
    HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX
  );
}

/** 플로팅 스트립 전체 높이(탭+슬롯+패딩) */
export function homeHotStripBarHeightPx() {
  return (
    HOME_HOT_STRIP_BAR_PAD_V_PX +
    HOME_HOT_STRIP_TAB_ROW_PX +
    HOME_HOT_STRIP_TAB_GAP_PX +
    HOME_HOT_STRIP_CONTENT_SLOT_PX
  );
}

/** 뷰포트 하단 기준 — 탭 행 아래쪽 가장자리(px) */
export function homeHotStripTabRowBottomPx() {
  return (
    HOME_HOT_STRIP_NAV_CLEARANCE_PX +
    HOME_HOT_STRIP_BAR_PAD_V_PX / 2 +
    HOME_HOT_STRIP_CONTENT_SLOT_PX +
    HOME_HOT_STRIP_TAB_GAP_PX
  );
}

/** 술 상황 칩 — 스트립 위 */
export function homeDrinksSituationStripBottomCss() {
  return `calc(${HOME_HOT_STRIP_NAV_CLEARANCE_PX}px + ${homeHotStripBarHeightPx()}px + 8px + env(safe-area-inset-bottom, 0px))`;
}

/** 코스 「쩜오 추가」 플로팅 — 핫스트립 위 */
export function homeCourseHalfStepFloatingBtnBottomCss() {
  return `calc(${HOME_HOT_STRIP_NAV_CLEARANCE_PX}px + ${homeHotStripBarHeightPx()}px + 10px + env(safe-area-inset-bottom, 0px))`;
}

/** 도보 루트 fit — 구간 거리 라벨이 검색바·핫스트립에 가리지 않게 */
export function homeCourseRouteMapFitBottomPaddingPx() {
  return (
    HOME_HOT_STRIP_NAV_CLEARANCE_PX +
    homeHotStripBarHeightPx() +
    HOME_SEARCH_BAR_DOCK_BOTTOM_PX +
    HOME_SEARCH_BAR_HEIGHT_PX +
    24
  );
}

