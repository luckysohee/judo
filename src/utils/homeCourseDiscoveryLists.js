/** 홈 「지금 뜨는 코스」 — 에디터픽·주간 랭킹 섹션당 노출 수 */
export const HOME_COURSE_DISCOVERY_SECTION_SIZE = 6;

/** 통합 목록에 붙일 🚀 급상승 배지 상한 */
export const HOME_COURSE_DISCOVERY_RISING_BADGE_LIMIT = 3;

/** 목록 풀 조회 상한 — 통합 추천 목록용 (검색은 `/api/courses/search`) */
export const HOME_COURSE_DISCOVERY_FETCH_LIMIT = 48;

/**
 * 운영 수동 픽 — `.env`: VITE_HOME_COURSE_EDITOR_PICK_IDS=uuid1,uuid2
 * @returns {string[]}
 */
export function parseEditorPickCourseIdsFromEnv() {
  const raw = import.meta.env.VITE_HOME_COURSE_EDITOR_PICK_IDS;
  if (raw == null || raw === "") return [];
  return String(raw)
    .split(/[,，\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {object} course
 * @returns {number}
 */
export function scoreEditorPickCandidate(course) {
  if (!course || typeof course !== "object") return 0;
  let score = 0;
  if (String(course.cover_image_url || "").trim()) score += 3;
  if (String(course.description || "").trim()) score += 2;
  if (String(course.area || "").trim()) score += 1;
  const n = Number(course.place_count);
  if (Number.isFinite(n) && n >= 2) score += 1;
  const tags = Array.isArray(course.theme_tags) ? course.theme_tags : [];
  if (tags.filter(Boolean).length >= 1) score += 1;
  const t = Date.parse(course.updated_at || course.created_at || "");
  if (Number.isFinite(t)) score += t / 1e15;
  return score;
}

/**
 * @param {object|null|undefined} stats
 */
export function weeklyRankingScore(stats) {
  const s = stats && typeof stats === "object" ? stats : {};
  const recent = Math.max(
    0,
    Math.floor(Number(s.recent_completion_count_7d) || 0)
  );
  const total = Math.max(0, Math.floor(Number(s.completion_count) || 0));
  const likes7 = Math.max(
    0,
    Math.floor(Number(s.recent_like_count_7d) || 0)
  );
  const likes = Math.max(0, Math.floor(Number(s.like_count) || 0));
  return recent * 10000 + total * 100 + likes7 * 10 + likes;
}

/**
 * @param {object[]} courses
 * @param {Map<string, object>} [statsByCourseId] — key lowercased uuid
 * @param {{ limit?: number, excludeIds?: Set<string> }} [opts]
 */
export function pickWeeklyRankingCourses(courses, statsByCourseId, opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.floor(opts.limit)
      : HOME_COURSE_DISCOVERY_SECTION_SIZE;
  const exclude = opts.excludeIds instanceof Set ? opts.excludeIds : new Set();
  const list = Array.isArray(courses) ? courses : [];

  const ranked = [...list]
    .filter((c) => {
      const id = String(c?.id || "").trim().toLowerCase();
      return id && !exclude.has(id);
    })
    .sort((a, b) => {
      const idA = String(a.id || "").trim().toLowerCase();
      const idB = String(b.id || "").trim().toLowerCase();
      const sa = weeklyRankingScore(statsByCourseId?.get(idA));
      const sb = weeklyRankingScore(statsByCourseId?.get(idB));
      if (sb !== sa) return sb - sa;
      const ta = Date.parse(a.updated_at || a.created_at || "") || 0;
      const tb = Date.parse(b.updated_at || b.created_at || "") || 0;
      return tb - ta;
    });

  return ranked.slice(0, limit);
}

/**
 * @param {object[]} courses
 * @param {Map<string, object>} [statsByCourseId]
 * @param {{ limit?: number, excludeIds?: Set<string>, manualIds?: string[] }} [opts]
 */
export function pickEditorFeaturedCourses(courses, statsByCourseId, opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.floor(opts.limit)
      : HOME_COURSE_DISCOVERY_SECTION_SIZE;
  const exclude = opts.excludeIds instanceof Set ? opts.excludeIds : new Set();
  const manualIds =
    Array.isArray(opts.manualIds) && opts.manualIds.length
      ? opts.manualIds
      : parseEditorPickCourseIdsFromEnv();

  const byId = new Map();
  for (const c of Array.isArray(courses) ? courses : []) {
    const id = String(c?.id || "").trim().toLowerCase();
    if (id) byId.set(id, c);
  }

  const picked = [];
  const used = new Set([...exclude]);

  for (const rawId of manualIds) {
    if (picked.length >= limit) break;
    const id = String(rawId || "").trim().toLowerCase();
    if (!id || used.has(id)) continue;
    const row = byId.get(id);
    if (!row) continue;
    picked.push(row);
    used.add(id);
  }

  if (picked.length < limit) {
    const rest = [...byId.values()]
      .filter((c) => {
        const id = String(c?.id || "").trim().toLowerCase();
        return id && !used.has(id);
      })
      .sort((a, b) => scoreEditorPickCandidate(b) - scoreEditorPickCandidate(a));
    for (const c of rest) {
      if (picked.length >= limit) break;
      const id = String(c.id || "").trim().toLowerCase();
      picked.push(c);
      used.add(id);
    }
  }

  void statsByCourseId;
  return picked;
}

/**
 * @param {object[]} list
 * @returns {Set<string>}
 */
function courseIdsSet(list) {
  return new Set(
    (Array.isArray(list) ? list : [])
      .map((c) => String(c?.id || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * MVP — 에디터픽 칸이 섹션 상한 미만일 때 품질·최신순으로 남은 공개 코스 채움.
 * (코스 총량이 상한 미만이면 그만큼만)
 */
export function mvpBackfillEditorPicks(courses, editorPicks, limit = HOME_COURSE_DISCOVERY_SECTION_SIZE) {
  const out = Array.isArray(editorPicks) ? [...editorPicks] : [];
  const seen = courseIdsSet(out);
  if (out.length >= limit) return out.slice(0, limit);

  const rest = [...(Array.isArray(courses) ? courses : [])]
    .filter((c) => {
      const id = String(c?.id || "").trim().toLowerCase();
      return id && !seen.has(id);
    })
    .sort(
      (a, b) =>
        scoreEditorPickCandidate(b) - scoreEditorPickCandidate(a) ||
        (Date.parse(b.updated_at || b.created_at || "") || 0) -
          (Date.parse(a.updated_at || a.created_at || "") || 0)
    );

  for (const c of rest) {
    if (out.length >= limit) break;
    const id = String(c?.id || "").trim().toLowerCase();
    out.push(c);
    seen.add(id);
  }
  return out.slice(0, limit);
}

/**
 * MVP — 주간 랭킹 칸이 비거나 섹션 상한 미만일 때 활동·최신순으로 채움.
 * 에디터픽과 같은 코스가 양쪽에 있어도 됨(데모·초기 코스 적을 때).
 */
export function mvpBackfillWeeklyRanking(
  courses,
  statsByCourseId,
  weeklyRanking,
  limit = HOME_COURSE_DISCOVERY_SECTION_SIZE
) {
  const out = Array.isArray(weeklyRanking) ? [...weeklyRanking] : [];
  const seen = courseIdsSet(out);
  if (out.length >= limit) return out.slice(0, limit);

  const ranked = pickWeeklyRankingCourses(courses, statsByCourseId, {
    limit,
    excludeIds: new Set(),
  });
  for (const c of ranked) {
    if (out.length >= limit) break;
    const id = String(c?.id || "").trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    out.push(c);
    seen.add(id);
  }
  return out.slice(0, limit);
}

/**
 * @param {object[]} courses
 * @param {Map<string, object>} [statsByCourseId]
 * @param {{ mvpFill?: boolean }} [opts]
 */
export function partitionHomeCourseDiscovery(courses, statsByCourseId, opts = {}) {
  const mvpFill = opts.mvpFill !== false;
  const limit = HOME_COURSE_DISCOVERY_SECTION_SIZE;

  let editorPicks = pickEditorFeaturedCourses(courses, statsByCourseId, {
    limit,
  });
  if (mvpFill && editorPicks.length < limit) {
    editorPicks = mvpBackfillEditorPicks(courses, editorPicks, limit);
  }

  const editorIds = courseIdsSet(editorPicks);

  let weeklyRanking = pickWeeklyRankingCourses(courses, statsByCourseId, {
    limit,
    excludeIds: editorIds,
  });
  if (mvpFill && weeklyRanking.length < limit) {
    weeklyRanking = mvpBackfillWeeklyRanking(
      courses,
      statsByCourseId,
      weeklyRanking,
      limit
    );
  }
  return { editorPicks, weeklyRanking };
}

/**
 * @param {object} course
 * @param {{
 *   weeklyRankById?: Map<string, number>,
 *   statsByCourseId?: Map<string, object>,
 *   risingBudget?: { remaining: number },
 * }} ctx
 * @returns {{ emoji: string, text: string } | null}
 */
export function resolveHomeCourseDiscoveryBadge(course, ctx = {}) {
  const id = String(course?.id || "").trim().toLowerCase();
  if (!id) return null;

  const weeklyRank = ctx.weeklyRankById?.get(id) ?? null;
  const stats = ctx.statsByCourseId?.get(id);
  const recent7 = Math.max(
    0,
    Math.floor(Number(stats?.recent_completion_count_7d) || 0)
  );

  if (weeklyRank === 1) {
    return { emoji: "🔥", text: "이번주 1위" };
  }

  const wantsRising =
    (weeklyRank != null && weeklyRank >= 2) || recent7 >= 1;
  if (!wantsRising) return null;

  const budget = ctx.risingBudget;
  if (budget && budget.remaining <= 0) return null;
  if (budget) budget.remaining -= 1;
  return { emoji: "🚀", text: "급상승" };
}

/**
 * 에디터픽·주간 랭킹을 하나의 목록으로 — 주간 순 → 에디터 순, 코스당 배지 1개.
 * @param {object[]} editorPicks
 * @param {object[]} weeklyRanking
 * @param {Map<string, object>} [statsByCourseId]
 * @param {{ limit?: number }} [opts]
 * @returns {{ course: object, badge: { emoji: string, text: string } | null }[]}
 */
export function buildHomeCourseDiscoveryUnifiedList(
  editorPicks,
  weeklyRanking,
  statsByCourseId,
  opts = {}
) {
  const editors = Array.isArray(editorPicks) ? editorPicks : [];
  const weekly = Array.isArray(weeklyRanking) ? weeklyRanking : [];

  const weeklyRankById = new Map();
  for (let i = 0; i < weekly.length; i += 1) {
    const id = String(weekly[i]?.id || "")
      .trim()
      .toLowerCase();
    if (id) weeklyRankById.set(id, i + 1);
  }

  const seen = new Set();
  const merged = [];
  const pushUnique = (list) => {
    for (const course of list) {
      const id = String(course?.id || "")
        .trim()
        .toLowerCase();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(course);
    }
  };

  pushUnique(weekly);
  pushUnique(editors);

  const defaultLimit = HOME_COURSE_DISCOVERY_SECTION_SIZE * 2;
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.floor(opts.limit)
      : defaultLimit;

  const ctx = {
    weeklyRankById,
    statsByCourseId,
    risingBudget: { remaining: HOME_COURSE_DISCOVERY_RISING_BADGE_LIMIT },
  };

  return merged.slice(0, limit).map((course) => ({
    course,
    badge: resolveHomeCourseDiscoveryBadge(course, ctx),
  }));
}

/**
 * 중간(접힘) 시트 가로 미리보기 — 통합 목록 상위 N.
 * @param {object[]} editorPicks
 * @param {object[]} weeklyRanking
 * @param {number} [maxItems]
 * @param {Map<string, object>} [statsByCourseId]
 * @returns {{ course: object, badge: { emoji: string, text: string } | null }[]}
 */
export function buildHomeCourseDiscoveryPeekList(
  editorPicks,
  weeklyRanking,
  maxItems = HOME_COURSE_DISCOVERY_SECTION_SIZE,
  statsByCourseId = null
) {
  const max = Math.max(
    1,
    Math.floor(Number(maxItems) || HOME_COURSE_DISCOVERY_SECTION_SIZE)
  );
  return buildHomeCourseDiscoveryUnifiedList(
    editorPicks,
    weeklyRanking,
    statsByCourseId,
    { limit: max }
  );
}

/**
 * 클라이언트 로컬 필터 (레거시·테스트). UI 검색은 `searchPublicCuratorCourses` 서버 API.
 * @param {object[]} courses
 * @param {string} rawQuery
 * @param {{ nameByCurator?: Map<string, string> }} [opts]
 */
export function filterCoursesForDiscoverySearch(courses, rawQuery, opts = {}) {
  const q = String(rawQuery || "")
    .trim()
    .toLowerCase();
  if (!q) return Array.isArray(courses) ? courses : [];
  const nameByCurator = opts.nameByCurator;

  return (Array.isArray(courses) ? courses : []).filter((c) => {
    if (!c || typeof c !== "object") return false;
    const title = String(c.title || "").toLowerCase();
    const area = String(c.area || "").toLowerCase();
    const desc = String(c.description || "").toLowerCase();
    const tags = (Array.isArray(c.theme_tags) ? c.theme_tags : [])
      .map((t) => String(t).toLowerCase())
      .join(" ");
    const cid = String(c.curator_id || "").trim();
    const curator = nameByCurator?.get(cid)?.toLowerCase() || "";
    return (
      title.includes(q) ||
      area.includes(q) ||
      desc.includes(q) ||
      tags.includes(q) ||
      curator.includes(q)
    );
  });
}
