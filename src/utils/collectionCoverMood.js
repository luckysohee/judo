/**
 * 컬렉션 "무드" — `cover_image_url` 이 비어 있을 때 tags / step_label 만으로
 * 자연스러운 그라데이션 + 짧은 라벨을 만들어주는 lightweight 데코레이터.
 *
 * 검색·추천·`useCourseSearch` 와 무관하며, 시각 데코레이션 외 부수효과 없음.
 *
 * 매핑 우선순위:
 *  1) 태그 명시적 매핑 (야장 / 데이트 / 새벽 …)
 *  2) step_label 키워드 매핑 (야장 1차 → 야장, 와인바 → 와인 …)
 *  3) 모두 없으면 fallback("기본") — 다만 mood label 은 비워서 placeholder 만 사용.
 *
 * 동일 입력에 대해 항상 같은 결과를 돌려주는 순수 함수(메모이제이션 없이도 안전).
 */

import { dedupeAndNormalizeCollectionTags } from "./collectionTags";

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   gradient: string,
 *   accentColor: string,
 *   icon: string,
 * }} CollectionMood
 */

/**
 * 잘 알려진 무드 정의 — `key` 가 매칭 결과에서 그대로 노출된다.
 * Gradient / accent 는 어두운 배경에서 카드 위에 충분한 대비를 가지도록 미세 조정.
 */
const MOODS = Object.freeze({
  yajang: {
    key: "yajang",
    label: "야장",
    gradient:
      "linear-gradient(160deg, rgba(34,80,46,0.95) 0%, rgba(186,107,40,0.85) 65%, rgba(54,42,28,0.95) 100%)",
    accentColor: "#fde68a",
    icon: "🌿",
  },
  nopo: {
    key: "nopo",
    label: "노포",
    gradient:
      "linear-gradient(155deg, rgba(70,42,20,0.96) 0%, rgba(176,84,40,0.85) 55%, rgba(46,30,18,0.96) 100%)",
    accentColor: "#fbbf24",
    icon: "🏮",
  },
  date: {
    key: "date",
    label: "데이트",
    gradient:
      "linear-gradient(150deg, rgba(132,55,153,0.95) 0%, rgba(232,98,142,0.78) 60%, rgba(54,30,80,0.95) 100%)",
    accentColor: "#ffd1e6",
    icon: "💗",
  },
  blind: {
    key: "blind",
    label: "소개팅",
    gradient:
      "linear-gradient(150deg, rgba(176,72,166,0.85) 0%, rgba(232,148,182,0.75) 55%, rgba(60,32,76,0.95) 100%)",
    accentColor: "#ffd6ef",
    icon: "🌹",
  },
  midnight: {
    key: "midnight",
    label: "새벽",
    gradient:
      "linear-gradient(160deg, rgba(14,30,68,0.98) 0%, rgba(45,76,143,0.88) 55%, rgba(8,16,40,0.98) 100%)",
    accentColor: "#a3c4ff",
    icon: "🌙",
  },
  honsul: {
    key: "honsul",
    label: "혼술",
    gradient:
      "linear-gradient(150deg, rgba(40,40,52,0.96) 0%, rgba(86,76,108,0.78) 55%, rgba(22,22,30,0.98) 100%)",
    accentColor: "#cbb8ff",
    icon: "🥃",
  },
  wine: {
    key: "wine",
    label: "와인",
    gradient:
      "linear-gradient(150deg, rgba(94,16,40,0.96) 0%, rgba(176,40,84,0.78) 55%, rgba(48,12,28,0.98) 100%)",
    accentColor: "#ffc6d4",
    icon: "🍷",
  },
  cafe: {
    key: "cafe",
    label: "카페",
    gradient:
      "linear-gradient(155deg, rgba(120,80,40,0.92) 0%, rgba(200,156,108,0.78) 55%, rgba(72,48,28,0.96) 100%)",
    accentColor: "#ffe8c2",
    icon: "☕",
  },
  vibe: {
    key: "vibe",
    label: "분위기",
    gradient:
      "linear-gradient(155deg, rgba(60,28,84,0.95) 0%, rgba(120,68,176,0.75) 55%, rgba(36,16,52,0.98) 100%)",
    accentColor: "#dcc6ff",
    icon: "✨",
  },
  budget: {
    key: "budget",
    label: "가성비",
    gradient:
      "linear-gradient(150deg, rgba(28,90,72,0.96) 0%, rgba(76,176,124,0.72) 55%, rgba(20,52,44,0.98) 100%)",
    accentColor: "#bff5dc",
    icon: "🪙",
  },
});

/**
 * Fallback — tags/step_label 모두 매칭 안 됐을 때.
 */
const DEFAULT_MOOD = Object.freeze({
  key: "default",
  label: "",
  gradient:
    "linear-gradient(135deg, rgba(46,204,113,0.35) 0%, rgba(52,152,219,0.35) 50%, rgba(155,89,182,0.35) 100%)",
  accentColor: "#cfe6f7",
  icon: "🍶",
});

/** 태그 정확/부분 매칭 테이블 (소문자). */
const TAG_MAP = Object.freeze({
  야장: MOODS.yajang,
  outdoor: MOODS.yajang,

  노포: MOODS.nopo,
  oldschool: MOODS.nopo,

  데이트: MOODS.date,
  date: MOODS.date,

  소개팅: MOODS.blind,

  새벽: MOODS.midnight,
  late: MOODS.midnight,
  latenight: MOODS.midnight,

  혼술: MOODS.honsul,
  solo: MOODS.honsul,

  와인: MOODS.wine,
  wine: MOODS.wine,
  와인바: MOODS.wine,

  카페: MOODS.cafe,
  cafe: MOODS.cafe,

  분위기: MOODS.vibe,
  vibe: MOODS.vibe,

  가성비: MOODS.budget,
});

/** step_label 부분 매칭 — `1차 야장`, `2차 와인바` 등도 잡기 위해 substring 검색. */
const STEP_PATTERNS = Object.freeze([
  { needle: "야장", mood: MOODS.yajang },
  { needle: "노포", mood: MOODS.nopo },
  { needle: "와인", mood: MOODS.wine },
  { needle: "wine", mood: MOODS.wine },
  { needle: "데이트", mood: MOODS.date },
  { needle: "소개팅", mood: MOODS.blind },
  { needle: "새벽", mood: MOODS.midnight },
  { needle: "late", mood: MOODS.midnight },
  { needle: "혼술", mood: MOODS.honsul },
  { needle: "카페", mood: MOODS.cafe },
  { needle: "cafe", mood: MOODS.cafe },
]);

/**
 * 다중 입력 중 가장 그럴듯한 무드 1개 + 보조 무드를 골라 반환.
 *
 * @param {{ tags?: unknown, stepLabels?: unknown, fallback?: CollectionMood }} input
 * @returns {{ primary: CollectionMood, secondary: CollectionMood | null, source: 'tag'|'step'|'default' }}
 */
export function pickCollectionMood({ tags, stepLabels, fallback } = {}) {
  const fb = fallback || DEFAULT_MOOD;
  const tagList = dedupeAndNormalizeCollectionTags(tags);
  const steps = Array.isArray(stepLabels) ? stepLabels : [];

  const matched = [];
  const seenKeys = new Set();

  for (const t of tagList) {
    const key = String(t || "").trim().toLowerCase();
    if (!key) continue;
    const hit = TAG_MAP[key];
    if (hit && !seenKeys.has(hit.key)) {
      matched.push({ mood: hit, source: "tag" });
      seenKeys.add(hit.key);
    }
  }

  if (matched.length < 2) {
    for (const s of steps) {
      const text = String(s || "")
        .trim()
        .toLowerCase();
      if (!text) continue;
      for (const p of STEP_PATTERNS) {
        if (text.includes(p.needle) && !seenKeys.has(p.mood.key)) {
          matched.push({ mood: p.mood, source: "step" });
          seenKeys.add(p.mood.key);
          break;
        }
      }
      if (matched.length >= 2) break;
    }
  }

  if (matched.length === 0) {
    return { primary: fb, secondary: null, source: "default" };
  }

  return {
    primary: matched[0].mood,
    secondary: matched[1]?.mood ?? null,
    source: matched[0].source,
  };
}

/**
 * 카드 커버에 얹을 짧은 step_label 1개 — `1차 야장` 처럼 첫 라벨을 그대로 노출.
 *
 * `collection_places`(상세)·`step_labels`(요약 카드)·평탄 배열 모두 받을 수 있다.
 *
 * @param {unknown} input
 * @returns {string | null}
 */
export function pickFirstStepLabelForCover(input) {
  const candidates = [];
  if (Array.isArray(input)) {
    for (const x of input) {
      if (typeof x === "string") candidates.push(x);
      else if (x && typeof x === "object" && typeof x.step_label === "string") {
        candidates.push(x.step_label);
      }
    }
  }
  for (const c of candidates) {
    const t = c.trim();
    if (t) return t.length > 12 ? `${t.slice(0, 11)}…` : t;
  }
  return null;
}

export const COLLECTION_DEFAULT_MOOD = DEFAULT_MOOD;
