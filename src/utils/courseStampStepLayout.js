import { MAX_COURSE_STAMP_STEPS } from "../api/coursePlaceStamps";

/** 도장 UI에 한 화면에 보여 줄 장소 수 — 초과분은 가로 스와이프 */
export const COURSE_STAMP_VISIBLE_SLOTS = 4;

/**
 * @param {unknown[]|number} stepsOrCount
 * @returns {number}
 */
export function normalizeCourseStampStepCount(stepsOrCount) {
  const n = Array.isArray(stepsOrCount)
    ? stepsOrCount.length
    : Number(stepsOrCount);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(Math.floor(n), MAX_COURSE_STAMP_STEPS);
}

/** 밀도·칸 너비 계산용 — 최대 4칸 기준 */
export function courseStampLayoutSlotCount(stepsOrCount) {
  const count = normalizeCourseStampStepCount(stepsOrCount) || 1;
  return Math.min(count, COURSE_STAMP_VISIBLE_SLOTS);
}

export function isCourseStampStepRowScrollable(stepsOrCount) {
  return (
    normalizeCourseStampStepCount(stepsOrCount) > COURSE_STAMP_VISIBLE_SLOTS
  );
}

function rowGap(slotCount) {
  if (slotCount >= 4) return 6;
  return 8;
}

/** 도장·썸네일 가로 줄 — 4칸까지 꽉 채움, 5칸 이상은 스와이프 */
export function courseStampStepRowStyle(stepsOrCount) {
  const count = normalizeCourseStampStepCount(stepsOrCount) || 1;
  const scrollable = count > COURSE_STAMP_VISIBLE_SLOTS;
  const gap = rowGap(courseStampLayoutSlotCount(stepsOrCount));
  return {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "stretch",
    justifyContent: "flex-start",
    width: "100%",
    minWidth: 0,
    gap,
    boxSizing: "border-box",
    overflowX: scrollable ? "auto" : "hidden",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: scrollable ? "x mandatory" : undefined,
    scrollbarWidth: scrollable ? "thin" : undefined,
  };
}

/** 각 칸 — 4칸 이하면 균등 분할, 5칸 이상이면 4칸 너비 고정 + 스크롤 */
export function courseStampStepCellStyle(stepsOrCount) {
  const count = normalizeCourseStampStepCount(stepsOrCount) || 1;
  if (count <= COURSE_STAMP_VISIBLE_SLOTS) {
    return {
      flex: "1 1 0",
      minWidth: 0,
      maxWidth: "100%",
    };
  }
  const visible = COURSE_STAMP_VISIBLE_SLOTS;
  const gap = rowGap(visible);
  const basis = `calc((100% - ${(visible - 1) * gap}px) / ${visible})`;
  return {
    flex: `0 0 ${basis}`,
    width: basis,
    minWidth: basis,
    maxWidth: basis,
    scrollSnapAlign: "start",
    boxSizing: "border-box",
  };
}

/**
 * 장소 개수별 타이포·썸네일·도장 배지 크기 (화면에 보이는 4칸 기준)
 * @param {unknown[]|number} stepsOrCount
 */
export function courseStampStepDensity(stepsOrCount) {
  const slots = courseStampLayoutSlotCount(stepsOrCount);

  if (slots >= 4) {
    return {
      labelFontSize: 9,
      nameFontSize: 9,
      descFontSize: 8,
      nameMaxLen: 7,
      descMaxLen: 22,
      photoCheckSize: 34,
      photoCheckFontSize: 16,
      thumbMaxHeight: 72,
      cellPadding: 4,
      cellGap: 3,
      placeholderFontSize: 16,
      stampDotSize: 26,
      stampDotFontSize: 13,
    };
  }

  return {
    labelFontSize: 10,
    nameFontSize: 9,
    descFontSize: 9,
    nameMaxLen: 9,
    descMaxLen: 28,
    photoCheckSize: 40,
    photoCheckFontSize: 20,
    thumbMaxHeight: 88,
    cellPadding: 4,
    cellGap: 4,
    placeholderFontSize: 18,
    stampDotSize: 28,
    stampDotFontSize: 14,
  };
}
