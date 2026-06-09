const HIDE_FOR_DAY_KEY = "judo_taste_today_popup_hide_v1";
const SESSION_AUTO_KEY = "judo_taste_today_popup_auto_v1";

function todayDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘 하루 안 보기 체크 후 닫았는지 */
export function isTodayTasteSuggestHiddenForDay() {
  try {
    return localStorage.getItem(HIDE_FOR_DAY_KEY) === todayDateKey();
  } catch {
    return false;
  }
}

export function hideTodayTasteSuggestForDay() {
  try {
    localStorage.setItem(HIDE_FOR_DAY_KEY, todayDateKey());
  } catch {
    /* ignore */
  }
}

/** 이번 탭 세션에서 자동 팝업을 이미 띄웠는지 */
export function wasTodayTasteSuggestAutoShownThisSession() {
  try {
    return sessionStorage.getItem(SESSION_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTodayTasteSuggestAutoShownThisSession() {
  try {
    sessionStorage.setItem(SESSION_AUTO_KEY, "1");
  } catch {
    /* ignore */
  }
}
