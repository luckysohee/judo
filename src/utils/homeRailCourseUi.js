import {
  HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX,
  homeHotStripCoursesSheetHeightPx,
} from "./homeHotStripLayout.js";

/** 홈 코스 바텀시트 — 접힘(차수 미선택) */
export const HOME_RAIL_COURSE_SHEET_COLLAPSED_VH = 100 / 3;

/** 홈 코스 바텀시트 — 차수 선택 시 확장 */
export const HOME_RAIL_COURSE_SHEET_EXPANDED_VH = 50;

/** @deprecated 코스 탭 시트와 동일 높이 — `homeHotStripCoursesSheetHeightPx` 사용 */
export const HOME_RAIL_COURSE_SHEET_FIXED_VH = 44;

/** @deprecated use COLLAPSED constant */
export const HOME_RAIL_COURSE_SHEET_VH = HOME_RAIL_COURSE_SHEET_COLLAPSED_VH;

/** 슬림 도크(접힘) 높이 — 지도 fit padding */
export const HOME_RAIL_COURSE_DOCK_PX = 118;

function readLayoutViewportHeight() {
  if (typeof window === "undefined") return 800;
  const vv = window.visualViewport;
  return Math.max(320, Math.round(vv?.height ?? window.innerHeight));
}

export function homeRailCourseSheetHeightPx(viewportHeight, expanded = false, docked = false) {
  if (docked) return HOME_RAIL_COURSE_DOCK_PX;
  if (expanded) {
    const h =
      typeof viewportHeight === "number" && viewportHeight > 0
        ? viewportHeight
        : readLayoutViewportHeight();
    return Math.round((h * HOME_RAIL_COURSE_SHEET_EXPANDED_VH) / 100);
  }
  return homeHotStripCoursesSheetHeightPx();
}

export function homeRailCourseMapFitPadding(sheetHeightPx) {
  const padB = Math.max(0, Math.round(Number(sheetHeightPx) || 0)) + 16;
  return { top: 88, right: 40, bottom: padB, left: 40 };
}

/**
 * 맛집첩 패널 상단~뷰포트 하단까지 — 지도에서 가려진 실제 하단(px)
 * @param {Element | null | undefined} panelEl
 * @param {number} [viewportH]
 */
export function measureHomeListsSheetObscuredBottomPx(panelEl, viewportH) {
  if (!panelEl || typeof panelEl.getBoundingClientRect !== "function") {
    return 0;
  }
  const top = panelEl.getBoundingClientRect().top;
  if (!Number.isFinite(top)) return 0;
  const vh =
    Number.isFinite(viewportH) && viewportH > 0
      ? viewportH
      : typeof window !== "undefined"
        ? window.innerHeight
        : 0;
  return Math.max(0, Math.round(vh - top));
}

/**
 * 맛집첩 펼침 — 시트 위 가시 영역에 핀을 꽉 채움.
 * `obscuredBottomPx`가 있으면(패널 DOM 측정) 그걸 우선하고, 없으면 sheet+dock 추정.
 * @param {number} sheetHeightPx
 * @param {{
 *   obscuredBottomPx?: number,
 *   dockBottomPx?: number,
 *   safeAreaBottomPx?: number,
 *   safeAreaTopPx?: number,
 *   gapAboveSheetPx?: number,
 *   sidePx?: number,
 * }} [opts]
 */
export function homeListsMapFitPadding(sheetHeightPx, opts = {}) {
  const gap = Math.max(
    0,
    Math.round(opts.gapAboveSheetPx != null ? opts.gapAboveSheetPx : 10)
  );
  const side = Math.max(
    12,
    Math.round(opts.sidePx != null ? opts.sidePx : 18)
  );
  const safeT = Math.max(0, Math.round(Number(opts.safeAreaTopPx) || 0));
  const obscured = Math.round(Number(opts.obscuredBottomPx) || 0);
  let bottom;
  if (obscured > 0) {
    bottom = obscured + gap;
  } else {
    const sheet = Math.max(0, Math.round(Number(sheetHeightPx) || 0));
    const dock = Math.max(
      0,
      Math.round(
        opts.dockBottomPx != null
          ? opts.dockBottomPx
          : HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX
      )
    );
    const safeB = Math.max(0, Math.round(Number(opts.safeAreaBottomPx) || 0));
    bottom = sheet + dock + safeB + gap;
  }
  return {
    top: Math.max(10, safeT + 8),
    right: side,
    bottom,
    left: side,
  };
}
