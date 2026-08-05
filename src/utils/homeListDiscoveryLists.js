/** 홈 「맛집첩」 디스커버리 — 주간 좋아요 순위·급상승 배지 */

export const HOME_LIST_DISCOVERY_RISING_BADGE_LIMIT = 3;

/**
 * @param {object|null|undefined} stats
 */
export function weeklyListRankingScore(stats) {
  const s = stats && typeof stats === "object" ? stats : {};
  const likes7 = Math.max(
    0,
    Math.floor(Number(s.recent_like_count_7d) || 0)
  );
  const likes = Math.max(0, Math.floor(Number(s.like_count) || 0));
  return likes7 * 100 + likes;
}

/**
 * @param {object[]} lists
 * @param {Map<string, object>} [statsByListId]
 * @returns {object[]}
 */
export function rankListsByWeeklyLikes(lists, statsByListId) {
  const rows = Array.isArray(lists) ? lists : [];
  return [...rows].sort((a, b) => {
    const idA = String(a?.id || "").trim().toLowerCase();
    const idB = String(b?.id || "").trim().toLowerCase();
    const sa = weeklyListRankingScore(statsByListId?.get(idA));
    const sb = weeklyListRankingScore(statsByListId?.get(idB));
    if (sb !== sa) return sb - sa;
    const ta = Date.parse(a?.updated_at || a?.created_at || "") || 0;
    const tb = Date.parse(b?.updated_at || b?.created_at || "") || 0;
    return tb - ta;
  });
}

/**
 * @param {object} list
 * @param {{
 *   weeklyRankById?: Map<string, number>,
 *   statsByListId?: Map<string, object>,
 *   risingBudget?: { remaining: number },
 * }} ctx
 * @returns {{ emoji: string, text: string } | null}
 */
export function resolveHomeListDiscoveryBadge(list, ctx = {}) {
  const id = String(list?.id || "").trim().toLowerCase();
  if (!id) return null;

  const weeklyRank = ctx.weeklyRankById?.get(id) ?? null;
  const stats = ctx.statsByListId?.get(id);
  const recent7 = Math.max(
    0,
    Math.floor(Number(stats?.recent_like_count_7d) || 0)
  );

  if (weeklyListRankingScore(stats) <= 0) return null;

  if (weeklyRank === 1) {
    return { emoji: "🔥", text: "이번주 1위" };
  }

  const wantsRising =
    (weeklyRank != null && weeklyRank >= 2 && weeklyRank <= 6) ||
    recent7 >= 1;
  if (!wantsRising) return null;

  const budget = ctx.risingBudget;
  if (budget && budget.remaining <= 0) return null;
  if (budget) budget.remaining -= 1;
  return { emoji: "🚀", text: "급상승" };
}

/**
 * @param {object|null|undefined} stats
 * @returns {{ emoji: string, text: string } | null}
 */
export function pickHomeListLikeMetricLine(stats) {
  const s = stats && typeof stats === "object" ? stats : {};
  const recent = Math.max(
    0,
    Math.floor(Number(s.recent_like_count_7d) || 0)
  );
  const total = Math.max(0, Math.floor(Number(s.like_count) || 0));
  if (recent >= 1) {
    return { emoji: "❤️", text: `이번주 좋아요 ${recent}` };
  }
  if (total >= 1) {
    return { emoji: "♡", text: `좋아요 ${total}` };
  }
  return null;
}

/**
 * 공개 탭 — 주간 순위 정렬 + 배지.
 * @param {object[]} lists
 * @param {Map<string, object>} [statsByListId]
 * @param {{ limit?: number }} [opts]
 * @returns {{ list: object, badge: { emoji: string, text: string } | null }[]}
 */
export function buildHomeListDiscoveryUnifiedList(
  lists,
  statsByListId,
  opts = {}
) {
  const ranked = rankListsByWeeklyLikes(lists, statsByListId);
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.floor(opts.limit)
      : ranked.length;

  const weeklyRankById = new Map();
  for (let i = 0; i < ranked.length; i += 1) {
    const id = String(ranked[i]?.id || "")
      .trim()
      .toLowerCase();
    if (id) weeklyRankById.set(id, i + 1);
  }

  const ctx = {
    weeklyRankById,
    statsByListId,
    risingBudget: { remaining: HOME_LIST_DISCOVERY_RISING_BADGE_LIMIT },
  };

  return ranked.slice(0, limit).map((list) => ({
    list,
    badge: resolveHomeListDiscoveryBadge(list, ctx),
  }));
}
