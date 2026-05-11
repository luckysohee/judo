/**
 * 홈 vibe chip 섹션 — 큐레이티드 분위기 프리셋.
 *
 * 자동 생성이 아닌 운영 큐레이션 리스트. 각 칩은 `vibe_caption` ILIKE 검색의
 * 관문이며, 실 데이터가 매칭되지 않으면 해당 칩은 자동으로 가려진다(API 가 0건 필터).
 *
 * 추천/랭킹/`useCourseSearch` 와는 무관한 표시·내비게이션 레이어.
 *
 * @typedef {{
 *   id: string,
 *   emoji: string,
 *   label: string,
 *   keyword: string,
 * }} HomeVibeChipPreset
 *
 * @type {ReadonlyArray<HomeVibeChipPreset>}
 */
export const HOME_VIBE_CHIP_PRESETS = Object.freeze([
  { id: "rainy", emoji: "🌧", label: "비 오는 날", keyword: "비" },
  { id: "dawn", emoji: "🌙", label: "새벽 감성", keyword: "새벽" },
  { id: "quiet", emoji: "🍷", label: "조용한 와인바 흐름", keyword: "조용" },
  { id: "thumb", emoji: "💕", label: "썸 분위기", keyword: "썸" },
  { id: "night-view", emoji: "🌃", label: "야경 보기 좋은", keyword: "야경" },
  { id: "old-school", emoji: "🥃", label: "노포 / 옛날 분위기", keyword: "노포" },
  { id: "alley", emoji: "🚶", label: "골목 산책", keyword: "골목" },
  { id: "alone", emoji: "🍶", label: "혼자 마시기 좋은", keyword: "혼자" },
]);
