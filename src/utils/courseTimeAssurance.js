/**
 * 코스 시간 보장(Time Assurance) — 배지·시간표·외부 예약 링크
 */

export const COURSE_BOOKING_STATUS = Object.freeze({
  UNKNOWN: "unknown",
  BOOKABLE: "bookable",
  RECOMMENDED: "recommended",
  WALKIN: "walkin",
});

export const COURSE_BOOKING_STATUS_OPTIONS = [
  { value: "unknown", label: "미정" },
  { value: "bookable", label: "예약 가능" },
  { value: "recommended", label: "예약 권장" },
  { value: "walkin", label: "현장 방문" },
];

/**
 * @param {unknown} raw
 * @returns {'unknown'|'bookable'|'recommended'|'walkin'}
 */
export function normalizeCourseBookingStatus(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    s === COURSE_BOOKING_STATUS.BOOKABLE ||
    s === COURSE_BOOKING_STATUS.RECOMMENDED ||
    s === COURSE_BOOKING_STATUS.WALKIN
  ) {
    return s;
  }
  return COURSE_BOOKING_STATUS.UNKNOWN;
}

/**
 * @param {string} status
 * @param {string} [crowdNote]
 * @returns {{ kind: string, label: string }|null}
 */
export function courseBookingBadge(status, crowdNote) {
  const note = String(crowdNote ?? "").trim();
  if (note) {
    return { kind: "crowd", label: `⚠️ ${note}` };
  }
  const st = normalizeCourseBookingStatus(status);
  if (st === COURSE_BOOKING_STATUS.BOOKABLE) {
    return { kind: "bookable", label: "✅ 예약 가능" };
  }
  if (st === COURSE_BOOKING_STATUS.RECOMMENDED) {
    return { kind: "recommended", label: "예약 권장" };
  }
  if (st === COURSE_BOOKING_STATUS.WALKIN) {
    return { kind: "walkin", label: "현장 방문" };
  }
  return null;
}

/**
 * @param {string|null|undefined} url
 * @param {string|null|undefined} phone
 * @returns {{ href: string, label: string }|null}
 */
export function courseBookingAction(url, phone) {
  const u = String(url ?? "").trim();
  if (u && /^https?:\/\//i.test(u)) {
    return { href: u, label: "예약하기" };
  }
  const p = String(phone ?? "").trim().replace(/\s+/g, "");
  if (p) {
    const digits = p.replace(/[^\d+]/g, "");
    if (digits) {
      return { href: `tel:${digits}`, label: "전화 예약" };
    }
  }
  return null;
}

/** HH:MM (로컬 분 단위 0~24*60+ 허용) */
export function formatMinutesAsClock(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return "";
  let m = Math.round(totalMinutes);
  while (m < 0) m += 24 * 60;
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * @param {string} hhmm — "18:00" | "18"
 * @param {number} [fallback=18*60]
 */
export function parseClockToMinutes(hhmm, fallback = 18 * 60) {
  const s = String(hhmm ?? "").trim();
  if (!s) return fallback;
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2] || 0)));
  return h * 60 + min;
}

/**
 * 출발 시각 + 체류(+이동)로 스텝 시간표 생성
 * @param {Array<{
 *   stay_minutes?: number|null,
 *   walk_to_next_minutes?: number|null,
 * }>} steps
 * @param {{ startMinutes?: number, defaultStayMin?: number, defaultWalkMin?: number }} [opts]
 */
export function buildCourseStepSchedule(steps, opts = {}) {
  const list = Array.isArray(steps) ? steps : [];
  const start = Number.isFinite(opts.startMinutes)
    ? opts.startMinutes
    : 18 * 60;
  const defaultStay =
    Number.isFinite(opts.defaultStayMin) && opts.defaultStayMin >= 0
      ? opts.defaultStayMin
      : 60;
  const defaultWalk =
    Number.isFinite(opts.defaultWalkMin) && opts.defaultWalkMin >= 0
      ? opts.defaultWalkMin
      : 15;

  let cursor = start;
  return list.map((step, i) => {
    const arriveMinutes = cursor;
    const rawStay = Number(step?.stay_minutes);
    const stayMin =
      Number.isFinite(rawStay) && rawStay >= 0 ? Math.floor(rawStay) : defaultStay;
    const departMinutes = arriveMinutes + stayMin;
    const rawWalk = Number(step?.walk_to_next_minutes);
    const walkMin =
      i >= list.length - 1
        ? 0
        : Number.isFinite(rawWalk) && rawWalk >= 0
          ? Math.floor(rawWalk)
          : defaultWalk;
    cursor = departMinutes + walkMin;
    return {
      arriveMinutes,
      departMinutes,
      stayMin,
      walkToNextMin: walkMin,
      arriveLabel: formatMinutesAsClock(arriveMinutes),
      departLabel: formatMinutesAsClock(departMinutes),
    };
  });
}
