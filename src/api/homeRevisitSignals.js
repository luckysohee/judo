import { supabase } from "./client";
import {
  dedupeAndNormalizeCollectionTags,
  normalizeCollectionTag,
} from "../utils/collectionTags";

/**
 * 홈 상단 리텐션 카드 — "마지막 방문 이후 새로 올라온 것" 을 한두 줄로 알려주기 위한 시그널.
 *
 * 셋 중 가능한 시그널 1~3개를 모아 반환하며, 결과가 0건이면 카드를 노출하지 말라는
 * 의미로 빈 배열을 돌려준다. 검색·지도·`useCourseSearch` 와 무관.
 *
 *  1) `tag_new`
 *      - 내가 최근 저장한 컬렉션의 상위 태그 1개를 골라
 *      - 그 태그를 가진 공개 컬렉션 중 `created_at > lastSeenAt` 인 것을 카운트.
 *      - 비로그인 / 저장이 없으면 → `preference_tags` 첫 태그로 시도.
 *  2) `follow_new`
 *      - 내가 픽한(`user_profile_follows.following_id`) 사용자가
 *        `created_at > lastSeenAt` 이후 새로 공개한 컬렉션 카운트.
 *      - 비로그인 / 팔로우 없음이면 시그널 없음.
 *  3) `featured_new`
 *      - `is_featured=true` & `featured_until` 미래 & `created_at > lastSeenAt`
 *        공개 컬렉션. (운영 큐레이션이 새로 떠올랐는지 보여 주는 용도)
 *  4) `remix_new`
 *      - 내가 저장한 컬렉션이 `remixed_from_collection_id` 로 참조된 새 컬렉션이 있는지
 *        카운트/샘플링. (저장한 코스에 새 리믹스가 생겼는지)
 *
 * 모든 보조 fetch 는 best-effort — 한 줄이 실패해도 다른 줄은 그대로 진행된다.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RECENT_SAVES_FOR_TAG = 24;
const TAG_NEW_LIMIT = 12;
const FOLLOW_NEW_POOL = 60;
const FOLLOW_NEW_DISPLAY = 12;
const FEATURED_NEW_LIMIT = 12;
const REMIX_NEW_LIMIT = 12;

function safeIso(input) {
  if (typeof input === "string" && input) {
    const t = new Date(input).getTime();
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return new Date(input).toISOString();
  }
  return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * @typedef {{
 *   kind: 'tag_new' | 'follow_new' | 'featured_new' | 'remix_new',
 *   message: string,
 *   count: number,
 *   tag?: string,
 *   sample?: { id: string, title: string | null, cover_image_url: string | null } | null,
 * }} HomeRevisitSignal
 */

/**
 * @typedef {{
 *   signals: HomeRevisitSignal[],
 *   last_seen_iso: string,
 * }} HomeRevisitResult
 */

/**
 * @param {string | null} viewerUserId — 비로그인이면 null
 * @param {{ lastSeenAt?: string | number, limit?: number }} [opts]
 * @returns {Promise<HomeRevisitResult>}
 */
export async function fetchHomeRevisitSignals(viewerUserId, opts = {}) {
  const lastSeenIso = safeIso(opts.lastSeenAt);
  const uid =
    typeof viewerUserId === "string" && UUID_RE.test(viewerUserId.trim())
      ? viewerUserId.trim()
      : null;

  /** @type {HomeRevisitSignal[]} */
  const signals = [];

  // 1) tag_new — 내 저장 시그널 → 없으면 preference_tags 첫 항목.
  let topTagFromBehavior = null;
  if (uid) {
    try {
      const { data, error } = await supabase
        .from("collection_saves")
        .select("collection_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(RECENT_SAVES_FOR_TAG);
      if (error) throw error;
      const ids = [
        ...new Set(
          (Array.isArray(data) ? data : [])
            .map((r) => String(r?.collection_id ?? "").trim())
            .filter(Boolean),
        ),
      ];
      if (ids.length > 0) {
        const tagsRes = await supabase
          .from("collections")
          .select("id, tags")
          .in("id", ids);
        if (!tagsRes.error) {
          const freq = new Map();
          for (const row of Array.isArray(tagsRes.data) ? tagsRes.data : []) {
            const tags = dedupeAndNormalizeCollectionTags(row?.tags);
            const seen = new Set();
            for (const t of tags) {
              const norm = normalizeCollectionTag(t);
              if (!norm) continue;
              const k = norm.toLowerCase();
              if (seen.has(k)) continue;
              seen.add(k);
              freq.set(k, {
                raw: norm,
                count: (freq.get(k)?.count ?? 0) + 1,
              });
            }
          }
          let best = null;
          for (const v of freq.values()) {
            if (!best || v.count > best.count) best = v;
          }
          topTagFromBehavior = best?.raw ?? null;
        }
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchHomeRevisitSignals tag from saves:", e?.message || e);
      }
    }
  }

  let topTag = topTagFromBehavior;
  if (!topTag && uid) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("preference_tags")
        .eq("id", uid)
        .maybeSingle();
      if (!error) {
        const list = dedupeAndNormalizeCollectionTags(data?.preference_tags);
        topTag = list[0] ?? null;
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "fetchHomeRevisitSignals preference_tags:",
          e?.message || e,
        );
      }
    }
  }

  if (topTag) {
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("id, title, cover_image_url, created_at, user_id")
        .eq("visibility", "public")
        .overlaps("tags", [topTag])
        .gt("created_at", lastSeenIso)
        .order("created_at", { ascending: false })
        .limit(TAG_NEW_LIMIT);
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []).filter(
        (r) => !uid || String(r?.user_id ?? "") !== uid,
      );
      if (rows.length > 0) {
        const sample = rows[0];
        const reason = topTagFromBehavior
          ? `최근 저장한 흐름과 비슷한 ${topTag} 코스가 늘고 있어요`
          : `새로운 ${topTag} 코스가 올라왔어요`;
        signals.push({
          kind: "tag_new",
          message:
            rows.length === 1
              ? reason
              : `${reason} (+${rows.length - 1})`,
          count: rows.length,
          tag: topTag,
          sample: sample
            ? {
                id: String(sample.id),
                title: sample.title ?? null,
                cover_image_url: sample.cover_image_url ?? null,
              }
            : null,
        });
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchHomeRevisitSignals tag_new:", e?.message || e);
      }
    }
  }

  // 2) follow_new — 내가 픽한 사람들의 신작 공개 컬렉션.
  if (uid) {
    try {
      const fRes = await supabase
        .from("user_profile_follows")
        .select("following_id")
        .eq("follower_id", uid);
      if (fRes.error) throw fRes.error;
      const followingIds = [
        ...new Set(
          (Array.isArray(fRes.data) ? fRes.data : [])
            .map((r) => String(r?.following_id ?? "").trim())
            .filter(Boolean),
        ),
      ];
      if (followingIds.length > 0) {
        const { data, error } = await supabase
          .from("collections")
          .select("id, title, cover_image_url, created_at, user_id")
          .eq("visibility", "public")
          .in("user_id", followingIds)
          .gt("created_at", lastSeenIso)
          .order("created_at", { ascending: false })
          .limit(FOLLOW_NEW_POOL);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : []).slice(
          0,
          FOLLOW_NEW_DISPLAY,
        );
        if (rows.length > 0) {
          const distinctAuthors = new Set(
            rows.map((r) => String(r?.user_id ?? "")),
          ).size;
          const sample = rows[0];
          const message =
            distinctAuthors > 1
              ? `내가 픽한 사람들이 새 코스 ${rows.length}개를 공개했어요`
              : rows.length === 1
                ? "내가 픽한 사람이 새 코스를 공개했어요"
                : `내가 픽한 사람이 새 코스 ${rows.length}개를 공개했어요`;
          signals.push({
            kind: "follow_new",
            message,
            count: rows.length,
            sample: sample
              ? {
                  id: String(sample.id),
                  title: sample.title ?? null,
                  cover_image_url: sample.cover_image_url ?? null,
                }
              : null,
          });
        }
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchHomeRevisitSignals follow_new:", e?.message || e);
      }
    }
  }

  // 3) featured_new — 운영 추천 신작.
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("collections")
      .select(
        "id, title, cover_image_url, created_at, is_featured, featured_until, user_id",
      )
      .eq("visibility", "public")
      .eq("is_featured", true)
      .gt("created_at", lastSeenIso)
      .or(`featured_until.is.null,featured_until.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(FEATURED_NEW_LIMIT);
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []).filter(
      (r) => !uid || String(r?.user_id ?? "") !== uid,
    );
    if (rows.length > 0) {
      const sample = rows[0];
      const message =
        rows.length === 1
          ? "에디터가 새로 추천한 코스가 있어요"
          : `에디터가 새로 추천한 코스 ${rows.length}개가 떴어요`;
      signals.push({
        kind: "featured_new",
        message,
        count: rows.length,
        sample: sample
          ? {
              id: String(sample.id),
              title: sample.title ?? null,
              cover_image_url: sample.cover_image_url ?? null,
            }
          : null,
      });
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchHomeRevisitSignals featured_new:", e?.message || e);
    }
  }

  // 4) remix_new — 내가 저장한 코스를 remixed_from 으로 삼은 신작.
  if (uid) {
    try {
      const { data: saves, error: sErr } = await supabase
        .from("collection_saves")
        .select("collection_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(RECENT_SAVES_FOR_TAG);
      if (sErr) throw sErr;
      const savedIds = [
        ...new Set(
          (Array.isArray(saves) ? saves : [])
            .map((r) => String(r?.collection_id ?? "").trim())
            .filter(Boolean),
        ),
      ];
      if (savedIds.length > 0) {
        const { data, error } = await supabase
          .from("collections")
          .select("id, title, cover_image_url, created_at, remixed_from_collection_id, user_id")
          .eq("visibility", "public")
          .in("remixed_from_collection_id", savedIds)
          .gt("created_at", lastSeenIso)
          .order("created_at", { ascending: false })
          .limit(REMIX_NEW_LIMIT);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : []).filter(
          (r) => !uid || String(r?.user_id ?? "") !== uid,
        );
        if (rows.length > 0) {
          const sample = rows[0];
          const message =
            rows.length === 1
              ? "저장한 코스에 새 리믹스가 생겼어요"
              : `저장한 코스에 새 리믹스 ${rows.length}개가 생겼어요`;
          signals.push({
            kind: "remix_new",
            message,
            count: rows.length,
            sample: sample
              ? {
                  id: String(sample.id),
                  title: sample.title ?? null,
                  cover_image_url: sample.cover_image_url ?? null,
                }
              : null,
          });
        }
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchHomeRevisitSignals remix_new:", e?.message || e);
      }
    }
  }

  // 동일 sample collection_id 가 여러 시그널에 걸리면 follow_new > tag_new > featured_new
  // 우선순위로 한 번씩만 노출.
  const dedupedById = [];
  const seenSampleIds = new Set();
  const order = ["remix_new", "follow_new", "tag_new", "featured_new"];
  for (const k of order) {
    for (const s of signals) {
      if (s.kind !== k) continue;
      const sid = s.sample?.id ?? "";
      if (sid && seenSampleIds.has(sid)) continue;
      if (sid) seenSampleIds.add(sid);
      dedupedById.push(s);
    }
  }

  return { signals: dedupedById, last_seen_iso: lastSeenIso };
}
