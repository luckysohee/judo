/** 장소 카드·모달용 "한잔함" 공개 카피 (내부는 여전히 check_ins) */

export function normalizeHanjanStats(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    totalDedup: Math.max(0, Number(raw.total_dedup) || 0),
    nearbyDedup: Math.max(0, Number(raw.nearby_dedup) || 0),
    fire24hDedup: Math.max(0, Number(raw.fire_24h_dedup) || 0),
    fireTodayDedup: Math.max(0, Number(raw.fire_today_dedup) || 0),
    regularsNearby: Math.max(0, Number(raw.regulars_nearby) || 0),
    lastAt: raw.last_at ? new Date(raw.last_at) : null,
  };
}

/** 누적 한잔(집계 숫자) 한 줄 — 3명 미만은 null (숨김) */
export function formatHanjanTotalPublicLine(totalDedup) {
  const n = Number(totalDedup) || 0;
  if (n < 3) return null;
  if (n <= 9) return `🍶 ${n}명 한잔`;
  if (n <= 49) return `🍶 ${n}명 한잔`;
  if (n < 100) return `🍶 ${n}명 다녀감`;
  return `🍶 ${n}명은 찍고 간 집`;
}

export function formatNearbyHanjanLine(nearbyDedup) {
  const n = Number(nearbyDedup) || 0;
  if (n < 3) return null;
  return `📍 여기서 ${n}명 한잔`;
}

export function formatRegularsLine(regularsNearby) {
  const n = Number(regularsNearby) || 0;
  if (n < 1) return null;
  return `🔥 단골 ${n}명`;
}

export function formatSaveLine(savedCount) {
  const n = Number(savedCount) || 0;
  if (n < 1) return null;
  return `👣 ${n}명이 담아감`;
}

export function formatFireLine(fireTodayDedup, fire24hDedup) {
  const t = Number(fireTodayDedup) || 0;
  const f = Number(fire24hDedup) || 0;
  if (t >= 1) return `🔥 오늘 ${t}명 한잔`;
  if (f >= 1) return `🔥 최근 24시간 ${f}명 한잔`;
  return null;
}

export function formatRecentActivityLine(lastAt) {
  if (!lastAt || !(lastAt instanceof Date) || Number.isNaN(lastAt.getTime())) return null;
  const diffMs = Date.now() - lastAt.getTime();
  if (diffMs < 0) return null;
  const hours = diffMs / 3600000;
  if (hours <= 1) return "방금 한잔";
  if (hours <= 6) return `${Math.max(1, Math.round(hours))}시간 전에 한잔`;
  return null;
}

/**
 * 카드에 노출할 2~3줄만 선택 (숫자 없는 줄은 후보에서 제외됨)
 * @param {{ savedCount?: number, stats?: ReturnType<typeof normalizeHanjanStats>, maxLines?: number }} p
 */
export function pickHanjanSocialLines({ savedCount = 0, stats, maxLines = 3 }) {
  const cap = Math.max(1, Math.min(3, Number(maxLines) || 3));
  if (!stats) {
    const only = formatSaveLine(savedCount);
    return only ? [only] : [];
  }
  const candidates = [
    formatFireLine(stats.fireTodayDedup, stats.fire24hDedup),
    formatSaveLine(savedCount),
    formatHanjanTotalPublicLine(stats.totalDedup),
    formatNearbyHanjanLine(stats.nearbyDedup),
    formatRegularsLine(stats.regularsNearby),
  ].filter(Boolean);

  const out = [];
  for (const line of candidates) {
    if (out.length >= cap) break;
    if (!out.includes(line)) out.push(line);
  }
  if (out.length < cap && stats.lastAt) {
    const recent = formatRecentActivityLine(stats.lastAt);
    if (recent && !out.includes(recent)) out.push(recent);
  }
  return out.slice(0, cap);
}
