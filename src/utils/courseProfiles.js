/** 코스 3종 — 정석 / 분위기 / 큐레이터 픽 (주도 톤) */
export const COURSE_PROFILES = {
  normal: {
    key: "normal",
    title: "정석 코스",
    description: "식사부터 2차까지 자연스럽게 이어지는 코스",
    weights: {
      category: 1.0,
      vibe: 1.0,
      liquor: 1.0,
      tag: 1.0,
      curator: 1.0,
      overlap: 1.0,
      distance: 1.0,
      openNow: 1.0,
    },
  },

  mood: {
    key: "mood",
    title: "분위기 코스",
    description: "무드와 분위기를 더 우선한 코스",
    weights: {
      category: 0.9,
      vibe: 1.5,
      liquor: 1.0,
      tag: 1.2,
      curator: 0.8,
      overlap: 0.9,
      distance: 0.9,
      openNow: 1.0,
    },
  },

  featured: {
    key: "featured",
    title: "큐레이터 픽 코스",
    description: "큐레이터 선택이 겹치는 신뢰도 높은 코스",
    weights: {
      category: 1.0,
      vibe: 1.0,
      liquor: 1.0,
      tag: 1.0,
      curator: 1.3,
      overlap: 1.8,
      distance: 0.9,
      openNow: 1.0,
    },
  },
};

export const COURSE_PROFILE_ORDER = [
  COURSE_PROFILES.normal,
  COURSE_PROFILES.mood,
  COURSE_PROFILES.featured,
];
