export const JUDO_OPEN_HOUR = 16;

/** 낮 모드 짧은 힌트 — 핫 스트립·토스트 등 (홈 상단 배너 없음) */
export const JUDO_DAY_BRAND_LINE =
  "지금은 미리 픽하는 시간. 오후 4시. 한잔(live check in) 가능 시간";

/** 좁은 스트립·빈 상태 한 줄 — 헤더 전체 문구와 중복하지 않음 */
export const JUDO_DAY_SIDE_STRIP_HINT = "오후 4시 라이브";

/** 운영 시간 외 한잔 버튼 클릭 시 토스트·힌트 (단일 출처) */
export const JUDO_CHECKIN_SCHEDULE_TOAST =
  "한잔함은 오후 4시부터 가능";

/** `performCheckin` 등 액션 레이어에서 스케줄 불가 시 던지는 식별자 (deep link·재사용 우회 방지) */
export const JUDO_CHECKIN_SCHEDULE_ERROR = "checkin_schedule_closed";

/**
 * 낮·밤 구분은 카피(검색 placeholder 등)용. 한잔함·LIVE·핫 스트립은 상시 오픈.
 */
export function getJudoOperationMode(now = new Date()) {
  const hour = now.getHours();

  /* 밤 모드: 오후 4시~자정 — UI 톤·placeholder 분기용 */
  const isNightMode = hour >= JUDO_OPEN_HOUR;

  return {
    isOpen: true,

    isNightMode,
    isDayMode: !isNightMode,

    canCheckIn: true,
    canShowLiveFlame: true,
    canShowHotNow: true,

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
    sub: "장소를 찾아보고 한잔 기록을 남겨 보세요.",
    checkInDisabledText: JUDO_CHECKIN_SCHEDULE_TOAST,
  };
}
