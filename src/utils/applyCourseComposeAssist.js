/**
 * LLM이 고른 course.key 순으로 재정렬. 실패·빈 응답 시 pool 점수 순 상위 maxDisplay.
 *
 * @param {object[]} pool
 * @param {{ courseKeys?: string[], summary?: string, reasons?: { courseKey: string, reason: string }[] } | null} assist
 * @param {{ maxDisplay?: number }} [opts]
 * @returns {{ options: object[], summary: string }}
 */
export function applyCourseComposeAssist(pool, assist, opts = {}) {
  const maxDisplay =
    typeof opts.maxDisplay === "number" && opts.maxDisplay > 0
      ? Math.floor(opts.maxDisplay)
      : 3;

  const list = Array.isArray(pool) ? pool : [];
  const byKey = new Map(
    list.filter((c) => c?.key).map((c) => [String(c.key), c])
  );

  if (!assist?.courseKeys?.length) {
    return {
      options: [...byKey.values()]
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
        .slice(0, maxDisplay),
      summary: "",
    };
  }

  const ordered = [];
  for (const k of assist.courseKeys) {
    const c = byKey.get(String(k));
    if (c) ordered.push(c);
  }

  for (const c of [...byKey.values()].sort(
    (a, b) => (b.totalScore || 0) - (a.totalScore || 0)
  )) {
    if (ordered.length >= maxDisplay) break;
    if (!ordered.some((x) => x.key === c.key)) ordered.push(c);
  }

  const reasonByKey = new Map(
    (assist.reasons || []).map((r) => [
      String(r.courseKey),
      String(r.reason || "").trim(),
    ])
  );

  const options = ordered.slice(0, maxDisplay).map((c) => {
    const reason = reasonByKey.get(String(c.key));
    if (!reason) return c;
    return { ...c, assistReason: reason, profileDescription: reason };
  });

  return {
    options,
    summary: String(assist.summary || "").trim(),
  };
}
