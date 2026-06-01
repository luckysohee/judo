import { homeHotStripCoursesSheetHeightPx } from "./homeHotStripLayout.js";

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
