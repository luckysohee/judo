/**
 * AI·홈 코스 — N차 = N곳 규칙 (서버에서도 import 가능, searchParser 의존 없음).
 */

/**
 * 검색어의 N차 → 장소 수 (1~6). 없으면 null.
 * @param {string} text
 */
export function parseRoundStopCount(text) {
  const t = String(text || "");
  const digit = t.match(/([1-6])\s*차/);
  if (digit) return parseInt(digit[1], 10);
  if (/육\s*차|6\s*차/.test(t)) return 6;
  if (/오\s*차|5\s*차/.test(t)) return 5;
  if (/사\s*차|4\s*차/.test(t)) return 4;
  if (/삼\s*차|3\s*차/.test(t)) return 3;
  if (/이\s*차|2\s*차/.test(t)) return 2;
  if (/일\s*차|1\s*차/.test(t)) return 1;
  return null;
}

/** 홈 코스 엔진·패턴용 step 수 (레거시) */
export function parseCourseStepCount(text) {
  const round = parseRoundStopCount(text);
  if (round != null) return Math.min(6, Math.max(1, round));
  if (/코스|루트|코스\s*짜|짜\s*줘|순례|투어|바투어/i.test(text)) return 2;
  return 1;
}

/**
 * AI 코스 초안 — 목표 장소 수.
 * 코스는 최소 2곳. 3차→3곳, 4차→4곳 … (차 번호 = 장소 수).
 * @param {{ raw?: string, steps?: number, forAiCourseDraft?: boolean }} parsed
 */
export function courseStopTargetForDraft(parsed) {
  const raw = String(parsed?.raw || "").trim();
  const round = parseRoundStopCount(raw);
  const isCourseLike =
    parsed?.forAiCourseDraft === true ||
    round != null ||
    /코스|루트|순례|투어|바투어/i.test(raw) ||
    Number(parsed?.steps) >= 2;

  if (round != null) {
    let target = Math.min(6, Math.max(1, round));
    if (isCourseLike && target < 2) target = 2;
    return {
      min: target,
      max: target,
      exact: true,
      target,
      label: `${target}곳`,
    };
  }

  if (isCourseLike) {
    return {
      min: 2,
      max: 6,
      exact: false,
      target: null,
      label: "2~6곳",
    };
  }

  return {
    min: 2,
    max: 6,
    exact: false,
    target: null,
    label: "2곳 이상",
  };
}

/** 코스/non-course 공통 draft step 수 맞추기 */
export function sanitizeCourseDraftForStopCount(draft, stopTarget) {
  if (!draft || !Array.isArray(draft.steps) || !stopTarget) return draft;
  let steps = draft.steps.filter(Boolean);
  const min = Math.max(2, Number(stopTarget.min) || 2);
  const max = Math.min(6, Number(stopTarget.max) || 6);

  if (stopTarget.exact && steps.length > max) {
    steps = steps.slice(0, max);
  } else if (!stopTarget.exact && steps.length > max) {
    steps = steps.slice(0, max);
  }

  if (steps.length < min) return draft;
  return { ...draft, steps };
}
