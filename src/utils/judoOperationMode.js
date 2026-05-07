export const JUDO_OPEN_HOUR = 16;

/** 낮 모드 브랜드 한 줄 — 헤더(`judoCopy.sub`) 전용 */
export const JUDO_DAY_BRAND_LINE =
  "지금은 미리 픽하는 시간. 오후 4시, 한잔지도가 열려요.";

/** 좁은 스트립·빈 상태 한 줄 — 헤더 전체 문구와 중복하지 않음 */
export const JUDO_DAY_SIDE_STRIP_HINT = "오후 4시 라이브";

/** 운영 시간 외 한잔 버튼 클릭 시 토스트·힌트 (단일 출처) */
export const JUDO_CHECKIN_SCHEDULE_TOAST =
  "한잔함은 오후 4시부터 가능";

/** `performCheckin` 등 액션 레이어에서 스케줄 불가 시 던지는 식별자 (deep link·재사용 우회 방지) */
export const JUDO_CHECKIN_SCHEDULE_ERROR = "checkin_schedule_closed";

/**
 * 낮 모드에서만 줄이는 것: 한잔함·실시간 불꽃·「지금 뜨는 곳」(및 동일 정책을 쓰는 실시간 스트립/랭킹 UI).
 * 검색·지도 fetch·장소 상세·픽/저장·큐레이터·코스 추천 로직에는 넣지 않는다.
 */
export function getJudoOperationMode(now = new Date()) {
  const hour = now.getHours();

  /* 밤 모드: 오후 4시~자정. getHours()는 0~23이므로 hour >= 16 만으로 충분 */
  const isNightMode = hour >= JUDO_OPEN_HOUR;

  return {
    isOpen: isNightMode,

    isNightMode,
    isDayMode: !isNightMode,

    canCheckIn: isNightMode,
    canShowLiveFlame: isNightMode,
    canShowHotNow: isNightMode,

    modeLabel: isNightMode ? "night" : "day",
  };
}

export function getJudoModeCopy(mode) {
  if (mode.isNightMode) {
    return {
      headline: "오늘 1차 어디서 시작할까?",
      sub: "지금 한잔하기 좋은 곳을 찾아보세요.",
      checkInDisabledText: "",
    };
  }

  return {
    headline: "오늘 저녁 어디 갈까?",
    sub: JUDO_DAY_BRAND_LINE,
    checkInDisabledText: JUDO_CHECKIN_SCHEDULE_TOAST,
  };
}
