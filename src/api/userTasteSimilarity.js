import { supabase } from "./client";
import {
  dedupeAndNormalizeCollectionTags,
  normalizeCollectionTag,
} from "../utils/collectionTags";

/**
 * "취향이 비슷한 사람" — 컬렉션 저장 overlap 기반 lightweight 사용자 추천.
 *
 * 검색·지도·`useCourseSearch` 와 무관하게 단독으로 동작하는 휴리스틱.
 * 운영 데이터가 적어도 자연스럽게 0건이 떨어지도록 모든 보조 fetch 는 best-effort
 * 로 실패하면 빈 배열로 fallback 한다.
 *
 * 시그널은 모두 "내가 저장한 공개 컬렉션" 풀에서 도출된다(다른 사용자의 라이브러리
 * 전체를 훑지 않고도 안정적으로 비교 가능):
 *
 *  - `overlap_collection_count` : 내가 저장한 컬렉션 중 그 사용자도 저장한 갯수
 *  - `common_tag_count`         : overlap 컬렉션에서 등장하는 distinct tag 수
 *  - `common_step_count`        : overlap 컬렉션에서 등장하는 distinct step_label 수
 *
 * 점수: `4·overlap + 2·tagDistinct + 1·stepDistinct`. (overlap 자체가 가장 강한 시그널)
 *
 * 카드 reason 은 overlap 컬렉션 안에서 가장 많이 등장한 tag/step_label 로 자동 생성.
 *
 * 필요 SELECT 권한:
 *  - `collection_saves` (RLS: 공개 컬렉션의 행 또는 본인 행)
 *  - `collections`      (RLS: 공개 또는 본인 행)
 *  - `collection_places` (FK SELECT)
 *  - `user_profile_follows` (RLS: 본인 follower_id 만)
 *  - `profiles`         (anon SELECT 가능 — display_name·avatar_url 노출)
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MY_SAVES_POOL = 50;
const OTHER_SAVES_FETCH_LIMIT = 2000;
const PRE_RANK_CAP = 60;
const MIN_OVERLAP = 1;

const W_OVERLAP = 4;
const W_TAG = 2;
const W_STEP = 1;

function safeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normStepLabel(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

/**
 * @typedef {{
 *   user_id: string,
 *   display_name: string | null,
 *   username: string | null,
 *   avatar_url: string | null,
 *   overlap_collection_count: number,
 *   common_top_tag: string | null,
 *   common_top_step_label: string | null,
 *   common_tag_count: number,
 *   common_step_count: number,
 *   score: number,
 *   reason: string,
 * }} SimilarTasteUser
 */

/**
 * 내가 저장한 컬렉션과 겹침이 큰 다른 사용자 목록.
 *
 * @param {string} viewerUserId — `auth.users.id`
 * @param {{ limit?: number }} [opts] — `limit` 기본 8, 허용 범위 1~12
 * @returns {Promise<SimilarTasteUser[]>}
 */
export async function fetchSimilarTasteUsers(
  viewerUserId,
  { limit = 8 } = {},
) {
  const me = String(viewerUserId ?? "").trim();
  if (!me || !UUID_RE.test(me)) return [];
  const lim = Math.min(Math.max(Math.floor(safeNumber(limit, 8)), 1), 12);

  // 1. 내가 최근 저장한 공개 컬렉션 id pool.
  let myColIds = [];
  try {
    const { data, error } = await supabase
      .from("collection_saves")
      .select("collection_id, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(MY_SAVES_POOL);
    if (error) throw error;
    const seen = new Set();
    for (const row of Array.isArray(data) ? data : []) {
      const cid = String(row?.collection_id ?? "").trim();
      if (cid && !seen.has(cid)) {
        seen.add(cid);
        myColIds.push(cid);
      }
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchSimilarTasteUsers my saves:", e?.message || e);
    }
    return [];
  }
  if (myColIds.length === 0) return [];

  // 2. 같은 컬렉션을 저장한 다른 사용자들의 saves + 내가 이미 픽한 사용자 목록.
  const [otherSavesRes, followingRes] = await Promise.all([
    supabase
      .from("collection_saves")
      .select("user_id, collection_id")
      .in("collection_id", myColIds)
      .neq("user_id", me)
      .limit(OTHER_SAVES_FETCH_LIMIT),
    supabase
      .from("user_profile_follows")
      .select("following_id")
      .eq("follower_id", me),
  ]);

  if (otherSavesRes.error) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchSimilarTasteUsers other saves:",
        otherSavesRes.error.message,
      );
    }
    return [];
  }

  const alreadyFollowing = new Set();
  if (followingRes.error) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchSimilarTasteUsers following list:",
        followingRes.error.message,
      );
    }
    // 비치명적 — 단순히 "이미 픽함" 필터를 못 거는 정도.
  } else {
    for (const row of Array.isArray(followingRes.data)
      ? followingRes.data
      : []) {
      const id = String(row?.following_id ?? "").trim();
      if (id) alreadyFollowing.add(id);
    }
  }

  // 3. user_id → overlap collection id Set.
  const overlapByUser = new Map();
  for (const row of Array.isArray(otherSavesRes.data)
    ? otherSavesRes.data
    : []) {
    const uid = String(row?.user_id ?? "").trim();
    const cid = String(row?.collection_id ?? "").trim();
    if (!uid || !cid) continue;
    if (uid === me) continue;
    if (alreadyFollowing.has(uid)) continue;
    let bag = overlapByUser.get(uid);
    if (!bag) {
      bag = new Set();
      overlapByUser.set(uid, bag);
    }
    bag.add(cid);
  }

  if (overlapByUser.size === 0) return [];

  // 4. overlap 컬렉션의 tag/step_label 메타 (내 컬렉션 풀 = `myColIds` 한정 fetch).
  const tagsByCol = new Map();
  const stepsByCol = new Map();
  try {
    const [tagsRes, placesRes] = await Promise.all([
      supabase.from("collections").select("id, tags").in("id", myColIds),
      supabase
        .from("collection_places")
        .select("collection_id, step_label")
        .in("collection_id", myColIds),
    ]);
    if (tagsRes.error) throw tagsRes.error;
    if (placesRes.error) throw placesRes.error;

    for (const row of Array.isArray(tagsRes.data) ? tagsRes.data : []) {
      const id = String(row?.id ?? "").trim();
      if (!id) continue;
      tagsByCol.set(id, dedupeAndNormalizeCollectionTags(row?.tags));
    }
    for (const row of Array.isArray(placesRes.data) ? placesRes.data : []) {
      const id = String(row?.collection_id ?? "").trim();
      if (!id) continue;
      const lblRaw =
        typeof row?.step_label === "string" ? row.step_label.trim() : "";
      if (!lblRaw) continue;
      let bag = stepsByCol.get(id);
      if (!bag) {
        bag = new Map();
        stepsByCol.set(id, bag);
      }
      // 한 컬렉션 안에서 같은 step_label 은 1번으로만 카운트하기 위해 dedup.
      const norm = normStepLabel(lblRaw);
      if (norm && !bag.has(norm)) bag.set(norm, lblRaw);
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchSimilarTasteUsers overlap col meta:",
        e?.message || e,
      );
    }
    // 비어 있어도 overlap 자체로는 진행 가능.
  }

  // 5. 후보 사전 랭킹 (overlap 갯수 큰 순) + 상위만 profile fetch.
  const preRanked = [...overlapByUser.entries()]
    .map(([uid, set]) => ({ uid, overlap: set.size, ids: set }))
    .filter((c) => c.overlap >= MIN_OVERLAP)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, PRE_RANK_CAP);

  if (preRanked.length === 0) return [];

  const candidateUserIds = preRanked.map((c) => c.uid);

  /** uid → { display_name, username, avatar_url } */
  const profileById = new Map();
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", candidateUserIds);
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.id ?? "").trim();
      if (!id) continue;
      profileById.set(id, {
        display_name:
          typeof row?.display_name === "string" && row.display_name.trim()
            ? row.display_name.trim()
            : null,
        username:
          typeof row?.username === "string" && row.username.trim()
            ? row.username.trim()
            : null,
        avatar_url:
          typeof row?.avatar_url === "string" && row.avatar_url.trim()
            ? row.avatar_url.trim()
            : null,
      });
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchSimilarTasteUsers profiles:", e?.message || e);
    }
  }

  // 6. 점수 + reason.
  const scored = preRanked.map((c) => {
    const overlapColIds = [...c.ids];
    const overlapCount = overlapColIds.length;

    /** norm → { raw, count } */
    const tagFreq = new Map();
    for (const cid of overlapColIds) {
      const tags = tagsByCol.get(cid) || [];
      const seenInCol = new Set();
      for (const t of tags) {
        const norm = normalizeCollectionTag(t);
        if (!norm) continue;
        const k = norm.toLowerCase();
        if (seenInCol.has(k)) continue;
        seenInCol.add(k);
        let entry = tagFreq.get(k);
        if (!entry) {
          entry = { raw: norm, count: 0 };
          tagFreq.set(k, entry);
        }
        entry.count += 1;
      }
    }
    const tagDistinct = tagFreq.size;
    const topTagEntry = [...tagFreq.values()].sort(
      (a, b) => b.count - a.count,
    )[0];

    /** norm → { raw, count } */
    const stepFreq = new Map();
    for (const cid of overlapColIds) {
      const steps = stepsByCol.get(cid);
      if (!steps) continue;
      for (const [norm, raw] of steps) {
        let entry = stepFreq.get(norm);
        if (!entry) {
          entry = { raw, count: 0 };
          stepFreq.set(norm, entry);
        }
        entry.count += 1;
      }
    }
    const stepDistinct = stepFreq.size;
    const topStepEntry = [...stepFreq.values()].sort(
      (a, b) => b.count - a.count,
    )[0];

    const score =
      W_OVERLAP * overlapCount + W_TAG * tagDistinct + W_STEP * stepDistinct;

    let reason;
    if (topTagEntry) {
      reason = `${topTagEntry.raw} 코스를 같이 저장했어요`;
    } else if (topStepEntry) {
      reason = `${topStepEntry.raw} 흐름을 같이 저장했어요`;
    } else if (overlapCount >= 2) {
      reason = `코스 ${overlapCount}개를 같이 저장했어요`;
    } else {
      reason = "같은 코스를 저장했어요";
    }

    const profile = profileById.get(c.uid) || null;

    return {
      user_id: c.uid,
      display_name: profile?.display_name ?? null,
      username: profile?.username ?? null,
      avatar_url: profile?.avatar_url ?? null,
      overlap_collection_count: overlapCount,
      common_top_tag: topTagEntry?.raw ?? null,
      common_top_step_label: topStepEntry?.raw ?? null,
      common_tag_count: tagDistinct,
      common_step_count: stepDistinct,
      score,
      reason,
      _has_profile: Boolean(profile),
    };
  });

  // 표시 가능한 프로필이 없는 후보는 제외(이름·아바타 모두 비어있는 카드 방지).
  // 단, profile 자체가 없어도 username/display_name 둘 다 없을 때만 거른다.
  const visible = scored
    .filter((r) => {
      if (r._has_profile) return true;
      // profile 행 자체를 못 가져왔다면 우리는 fallback 으로 이니셜만 노출 — 그래도 노출 허용.
      return Boolean(r.user_id);
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.overlap_collection_count !== a.overlap_collection_count) {
        return b.overlap_collection_count - a.overlap_collection_count;
      }
      // display_name 있는 쪽 우선(이니셜만 있는 카드는 뒤로).
      const av = a.display_name ? 1 : 0;
      const bv = b.display_name ? 1 : 0;
      return bv - av;
    })
    .slice(0, lim)
    .map((r) => {
      const out = { ...r };
      delete out._has_profile;
      return out;
    });

  return visible;
}
