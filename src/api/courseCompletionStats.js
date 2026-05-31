import { supabase } from "./client";
import { isSupabaseSchemaMissingError } from "../utils/supabaseSchemaErrors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BATCH_CAP = 100;

function parseUuid(id) {
  const s = String(id ?? "").trim().toLowerCase();
  if (!s || !UUID_RE.test(s)) return null;
  return s;
}

/** @returns {{ completion_count: number, unique_user_count: number, recent_completion_count_7d: number }} */
export function normalizeCourseCompletionStats(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const n = (k) => {
    const v = Number(o[k]);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  };
  return {
    completion_count: n("completion_count"),
    unique_user_count: n("unique_user_count"),
    recent_completion_count_7d: n("recent_completion_count_7d"),
  };
}

/** @returns {{ like_count: number, recent_like_count_7d: number }} */
export function normalizeCourseLikeStats(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const n = (k) => {
    const v = Number(o[k]);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  };
  return {
    like_count: n("like_count"),
    recent_like_count_7d: n("recent_like_count_7d"),
  };
}

/**
 * @param {object|null|undefined} completion
 * @param {object|null|undefined} likes
 */
export function mergeCourseEngagementStats(completion, likes) {
  return {
    ...normalizeCourseCompletionStats(completion),
    ...normalizeCourseLikeStats(likes),
  };
}

const ZEROS = Object.freeze({
  completion_count: 0,
  unique_user_count: 0,
  recent_completion_count_7d: 0,
});

const LIKE_ZEROS = Object.freeze({
  like_count: 0,
  recent_like_count_7d: 0,
});

const ENGAGEMENT_ZEROS = Object.freeze({
  ...ZEROS,
  ...LIKE_ZEROS,
});

const ARCHIVE_ZEROS = Object.freeze({
  ...ZEROS,
  total_completion_count: 0,
  unique_completed_users: 0,
  published_course_count: 0,
  top_course: null,
});

function parseTopCourse(raw) {
  if (!raw || typeof raw !== "object") return null;
  const course_id = String(raw.course_id ?? "").trim().toLowerCase();
  if (!course_id) return null;
  const title = String(raw.title ?? "").trim() || "제목 없음";
  const completion_count = Math.max(
    0,
    Math.floor(Number(raw.completion_count) || 0)
  );
  return { course_id, title, completion_count };
}

/**
 * @param {object|null|undefined} raw — RPC `get_curator_completion_stats` JSON
 * @returns {{
 *   completion_count: number,
 *   unique_user_count: number,
 *   recent_completion_count_7d: number,
 *   total_completion_count: number,
 *   unique_completed_users: number,
 *   published_course_count: number,
 *   top_course: { course_id: string, title: string, completion_count: number } | null,
 * }}
 */
export function normalizeCuratorArchiveStats(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const base = normalizeCourseCompletionStats(o);
  const n = (k) => {
    const v = Number(o[k]);
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  };
  const total = n("total_completion_count") || base.completion_count;
  const uniqUsers = n("unique_completed_users") || base.unique_user_count;
  return {
    completion_count: base.completion_count,
    unique_user_count: base.unique_user_count,
    recent_completion_count_7d: base.recent_completion_count_7d,
    total_completion_count: total,
    unique_completed_users: uniqUsers,
    published_course_count: n("published_course_count"),
    top_course: parseTopCourse(o.top_course),
  };
}

/**
 * 스튜디오/프로필 상단 감성 카피 (숫자는 보조).
 * @param {object|null|undefined} stats — normalizeCuratorArchiveStats 결과
 * @returns {{ headline: string|null, whisper: string|null }}
 */
export function buildCuratorArchiveVibes(stats) {
  const s = normalizeCuratorArchiveStats(stats);
  const recent = s.recent_completion_count_7d;
  const total = s.total_completion_count;
  const pub = s.published_course_count;

  let headline = null;
  if (recent >= 1) {
    headline = `이번 주, ${recent}명이 루트를 완주했어요`;
  } else if (total >= 1) {
    headline = `아카이브에 완주 ${total}번이 쌓였어요`;
  }

  let whisper = null;
  if (pub >= 1) {
    whisper =
      total >= 1
        ? `공개 플레이리스트 ${pub}개 · 도시 믹스테이프 선반`
        : `공개 플레이리스트 ${pub}개`;
  }

  return { headline, whisper };
}

/**
 * 잔 아카이브 · 팔로워 행동 칩 (주간 코스 완주).
 * @param {object|null|undefined} stats
 * @returns {string|null}
 */
export function formatCuratorCourseCompletionFollowerChip(stats) {
  const s = normalizeCuratorArchiveStats(stats);
  if (s.recent_completion_count_7d >= 1) {
    return `이번 주 ${s.recent_completion_count_7d}명 코스 완주`;
  }
  if (s.total_completion_count >= 1) {
    return `총 ${s.total_completion_count}명 코스 완주`;
  }
  return null;
}

/**
 * 스튜디오 코스 카드: 주간 + 누적 완주 두 줄(데이터 있을 때만).
 * @param {object|null|undefined} stats
 * @returns {{ key: string, emoji: string, text: string }[]}
 */
export function pickStudioCourseCompletionLines(stats) {
  const s = normalizeCourseCompletionStats(stats);
  const out = [];
  if (s.recent_completion_count_7d >= 1) {
    out.push({
      key: "7d",
      emoji: "🔥",
      text: `이번주 ${s.recent_completion_count_7d}명 완주`,
    });
  }
  if (s.completion_count >= 1) {
    out.push({
      key: "total",
      emoji: "🍻",
      text: `총 ${s.completion_count}명 완주`,
    });
  }
  return out;
}

/**
 * 홈 코스 카드용 한 줄 (이번주 우선, 없으면 누적 완주).
 * @param {{ completion_count?: number, recent_completion_count_7d?: number }} [stats]
 * @returns {{ emoji: string, text: string } | null}
 */
export function pickHomeCourseCompletionMetricLine(stats) {
  const s = stats && typeof stats === "object" ? stats : ZEROS;
  const recent = Math.max(
    0,
    Math.floor(Number(s.recent_completion_count_7d) || 0)
  );
  const total = Math.max(0, Math.floor(Number(s.completion_count) || 0));
  if (recent >= 1) {
    return { emoji: "🔥", text: `이번주 ${recent}명 완주` };
  }
  if (total >= 1) {
    return { emoji: "🍻", text: `${total}명 완주` };
  }
  return null;
}

/**
 * 코스 상세 등: 한 줄 요약 (완주 0이면 null).
 * @param {object|null|undefined} stats
 * @returns {string|null}
 */
export function formatCourseCompletionSocialSummary(stats) {
  const s = normalizeCourseCompletionStats(stats);
  if (s.completion_count <= 0) return null;
  if (s.recent_completion_count_7d >= 1) {
    return `${s.completion_count}명 완주 · 최근 7일 ${s.recent_completion_count_7d}명`;
  }
  return `${s.completion_count}명 완주`;
}

/**
 * 코스별 완주 건수만 (집계 API 래퍼).
 * @param {string} courseId
 * @returns {Promise<number>}
 */
export async function getCourseCompletionCount(courseId) {
  const s = await getCourseStats(courseId);
  return s.completion_count;
}

/**
 * @param {string} courseId
 * @returns {Promise<{ completion_count: number, unique_user_count: number, recent_completion_count_7d: number }>}
 */
export async function getCourseStats(courseId) {
  const id = parseUuid(courseId);
  if (!id) return { ...ZEROS };

  const { data, error } = await supabase.rpc("get_course_completion_stats", {
    p_course_id: id,
  });
  if (error) {
    console.warn("[getCourseStats]", error);
    return { ...ZEROS };
  }
  return normalizeCourseCompletionStats(data);
}

/**
 * 홈 레일 등: 한 번의 RPC로 여러 코스 집계 (N+1 방지).
 * @param {string[]} courseIds
 * @returns {Promise<Map<string, { completion_count: number, unique_user_count: number, recent_completion_count_7d: number }>>}
 */
export async function getCourseStatsBatch(courseIds) {
  const list = Array.isArray(courseIds) ? courseIds : [];
  const uniq = [];
  const seen = new Set();
  for (const raw of list) {
    const id = parseUuid(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= BATCH_CAP) break;
  }
  const out = new Map();
  if (uniq.length === 0) return out;

  const { data, error } = await supabase.rpc(
    "get_course_completion_stats_batch",
    { p_course_ids: uniq }
  );
  if (error) {
    console.warn("[getCourseStatsBatch]", error);
    for (const id of uniq) {
      out.set(id, { ...ZEROS });
    }
    return out;
  }
  for (const row of Array.isArray(data) ? data : []) {
    const cid = row?.course_id != null ? String(row.course_id).trim() : "";
    if (!cid) continue;
    out.set(cid.toLowerCase(), normalizeCourseCompletionStats(row));
  }
  for (const id of uniq) {
    if (!out.has(id)) out.set(id, { ...ZEROS });
  }
  return out;
}

/**
 * 스튜디오 코스 카드: 완주 + 좋아요 (데이터 있을 때만).
 * @param {object|null|undefined} stats — mergeCourseEngagementStats 결과
 * @returns {{ key: string, emoji: string, text: string }[]}
 */
export function pickStudioCourseEngagementLines(stats) {
  const merged = mergeCourseEngagementStats(stats, stats);
  const out = pickStudioCourseCompletionLines(merged);
  const likes = normalizeCourseLikeStats(merged);
  if (likes.recent_like_count_7d >= 1) {
    out.push({
      key: "likes7d",
      emoji: "♥",
      text: `이번주 좋아요 ${likes.recent_like_count_7d}`,
    });
  } else if (likes.like_count >= 1) {
    out.push({
      key: "likes",
      emoji: "♥",
      text: `좋아요 ${likes.like_count}`,
    });
  }
  return out;
}

/**
 * 코스 상세: 완주·좋아요 한 줄 (둘 다 0이면 null).
 * @param {object|null|undefined} stats
 * @returns {string|null}
 */
export function formatCourseEngagementSocialSummary(stats) {
  const merged = mergeCourseEngagementStats(stats, stats);
  const parts = [];
  const completionLine = formatCourseCompletionSocialSummary(merged);
  if (completionLine) parts.push(completionLine);
  const likes = normalizeCourseLikeStats(merged);
  if (likes.like_count >= 1) {
    if (likes.recent_like_count_7d >= 1) {
      parts.push(`좋아요 ${likes.like_count} · 이번 주 ${likes.recent_like_count_7d}`);
    } else {
      parts.push(`좋아요 ${likes.like_count}`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * @param {string[]} courseIds
 * @returns {Promise<Map<string, { like_count: number, recent_like_count_7d: number }>>}
 */
export async function getCourseLikeStatsBatch(courseIds) {
  const list = Array.isArray(courseIds) ? courseIds : [];
  const uniq = [];
  const seen = new Set();
  for (const raw of list) {
    const id = parseUuid(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= BATCH_CAP) break;
  }
  const out = new Map();
  if (uniq.length === 0) return out;

  const { data, error } = await supabase.rpc("get_course_like_stats_batch", {
    p_course_ids: uniq,
  });
  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[getCourseLikeStatsBatch]", error);
    }
    for (const id of uniq) {
      out.set(id, { ...LIKE_ZEROS });
    }
    return out;
  }
  for (const row of Array.isArray(data) ? data : []) {
    const cid = row?.course_id != null ? String(row.course_id).trim() : "";
    if (!cid) continue;
    out.set(cid.toLowerCase(), normalizeCourseLikeStats(row));
  }
  for (const id of uniq) {
    if (!out.has(id)) out.set(id, { ...LIKE_ZEROS });
  }
  return out;
}

/**
 * 완주 + 좋아요 배치 (스튜디오·홈 레일 N+1 방지)
 * @param {string[]} courseIds
 */
export async function getCourseEngagementStatsBatch(courseIds) {
  const list = Array.isArray(courseIds) ? courseIds : [];
  const uniq = [];
  const seen = new Set();
  for (const raw of list) {
    const id = parseUuid(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= BATCH_CAP) break;
  }
  const out = new Map();
  if (uniq.length === 0) return out;

  const [completionMap, likeMap] = await Promise.all([
    getCourseStatsBatch(uniq),
    getCourseLikeStatsBatch(uniq),
  ]);

  for (const id of uniq) {
    out.set(
      id,
      mergeCourseEngagementStats(
        completionMap.get(id) ?? ZEROS,
        likeMap.get(id) ?? LIKE_ZEROS
      )
    );
  }
  return out;
}

/**
 * @param {string} courseId
 */
export async function getCourseEngagementStats(courseId) {
  const id = parseUuid(courseId);
  if (!id) return { ...ENGAGEMENT_ZEROS };

  const [completion, likeRes] = await Promise.all([
    getCourseStats(id),
    supabase.rpc("get_course_like_stats", { p_course_id: id }),
  ]);
  let likes = { ...LIKE_ZEROS };
  if (likeRes.error) {
    if (!isSupabaseSchemaMissingError(likeRes.error)) {
      console.warn("[getCourseLikeStats]", likeRes.error);
    }
  } else {
    likes = normalizeCourseLikeStats(likeRes.data);
  }
  return mergeCourseEngagementStats(completion, likes);
}

/**
 * 큐레이터 아카이브·스튜디오용 전체 스냅샷 (RPC `get_curator_completion_stats`).
 * @param {string} curatorId
 * @returns {Promise<ReturnType<typeof normalizeCuratorArchiveStats>>}
 */
export async function getCuratorArchiveStats(curatorId) {
  const id = parseUuid(curatorId);
  if (!id) return { ...ARCHIVE_ZEROS };

  const { data, error } = await supabase.rpc("get_curator_completion_stats", {
    p_curator_id: id,
  });
  if (error) {
    console.warn("[getCuratorArchiveStats]", error);
    return { ...ARCHIVE_ZEROS };
  }
  return normalizeCuratorArchiveStats(data);
}

/**
 * 큐레이터가 만든 코스에 대한 완주 집계(completed_course_logs.curator_id).
 * @param {string} curatorId
 * @returns {Promise<{ completion_count: number, unique_user_count: number, recent_completion_count_7d: number }>}
 */
export async function getCuratorCompletionStats(curatorId) {
  return getCuratorArchiveStats(curatorId).then((a) => ({
    completion_count: a.completion_count,
    unique_user_count: a.unique_user_count,
    recent_completion_count_7d: a.recent_completion_count_7d,
  }));
}

/**
 * @param {string} curatorId
 * @returns {Promise<number>}
 */
export async function getCuratorCompletionCount(curatorId) {
  const s = await getCuratorArchiveStats(curatorId);
  return s.total_completion_count;
}
