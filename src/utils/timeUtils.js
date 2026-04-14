const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function getNowInfo(date = new Date()) {
  return {
    dayKey: DAY_KEYS[date.getDay()],
    minutes: date.getHours() * 60 + date.getMinutes(),
  };
}

/**
 * @param {object} place normalizePlace 결과 등
 * @returns {boolean|null} null이면 알 수 없음
 */
export function isPlaceOpenNow(place, now = new Date()) {
  if (typeof place?.openNow === "boolean") {
    return place.openNow;
  }

  if (!place?.openingHours || typeof place.openingHours !== "object") {
    return null;
  }

  const { dayKey, minutes } = getNowInfo(now);
  const dayHours = place.openingHours[dayKey];
  if (!dayHours || typeof dayHours !== "object") return null;

  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);

  if (openMinutes == null || closeMinutes == null) return null;

  if (closeMinutes < openMinutes) {
    return minutes >= openMinutes || minutes <= closeMinutes;
  }

  return minutes >= openMinutes && minutes <= closeMinutes;
}

/**
 * @returns {number|null} 오늘(또는 자정 넘김 구간) 기준 마감까지 남은 분
 */
export function getMinutesUntilClose(place, now = new Date()) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (place?.closeTime) {
    const closeMinutes = parseTimeToMinutes(place.closeTime);
    if (closeMinutes == null) return null;

    if (closeMinutes < nowMinutes) {
      return 24 * 60 - nowMinutes + closeMinutes;
    }

    return closeMinutes - nowMinutes;
  }

  if (!place?.openingHours || typeof place.openingHours !== "object") {
    return null;
  }

  const { dayKey, minutes } = getNowInfo(now);
  const dayHours = place.openingHours[dayKey];
  if (!dayHours || typeof dayHours !== "object") return null;

  const closeMinutes = parseTimeToMinutes(dayHours.close);
  const openMinutes = parseTimeToMinutes(dayHours.open);

  if (closeMinutes == null || openMinutes == null) return null;

  if (closeMinutes < openMinutes) {
    if (minutes <= closeMinutes) {
      return closeMinutes - minutes;
    }
    return 24 * 60 - minutes + closeMinutes;
  }

  return closeMinutes - minutes;
}
