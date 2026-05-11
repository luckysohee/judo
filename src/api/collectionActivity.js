import { supabase } from "./client";

/**
 * "큐레이터 활동 피드" — 공개 `collections` / `collection_places` / `collection_saves`
 * 테이블에서 직접 파생하는 라이트 활동 소스.
 *
 * - 별도 RPC·뷰·집계 테이블 없이 4개의 작은 SELECT 만 병렬로 호출한다.
 * - 정확한 랭킹보다 "살아있는 느낌" 이 목적: 최근 14일 풀에서 컬렉션 1건당
 *   가장 의미 있는 이벤트 1개로 dedupe → 최근 occurred_at 으로 정렬.
 * - 호출자(액터)는 `profiles` + `curators` 를 한 번씩 lookup 해 합치며, 어느 한쪽이
 *   비어 있어도 표시 가능한 best-effort 매칭이다.
 *
 * Home 검색·지도 fetch 와 무관한 단독 호출.
 */

const COLL_BASE =
  "id, title, visibility, cover_image_url, user_id, created_at, updated_at";

const PRIORITY = {
  collection_saved_trending: 4,
  place_added: 3,
  collection_updated: 2,
  collection_created: 1,
};

const SAVE_TRENDING_MIN_COUNT = 3;
const UPDATE_GRACE_MS = 60_000;

function toIsoDaysAgo(days) {
  const d = Math.min(Math.max(Math.floor(Number(days) || 14), 1), 30);
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * 뷰어가 팔로우(pick) 중인 사용자 id 목록.
 * `user_profile_follows.follower_id = viewer` 단순 SELECT.
 *
 * @param {string | null | undefined} viewerUserId
 * @returns {Promise<string[]>}
 */
async function fetchFollowingUserIds(viewerUserId) {
  const id = String(viewerUserId ?? "").trim();
  if (!id) return [];
  try {
    const { data, error } = await supabase
      .from("user_profile_follows")
      .select("following_id")
      .eq("follower_id", id);
    if (error) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchRecentCuratorActivity follows:", error.message);
      }
      return [];
    }
    return [
      ...new Set(
        (data || [])
          .map((r) => String(r?.following_id ?? "").trim())
          .filter(Boolean),
      ),
    ];
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchRecentCuratorActivity follows ex:", e?.message || e);
    }
    return [];
  }
}

/**
 * @param {{
 *   limit?: number,
 *   sinceDays?: number,
 *   followedOnly?: boolean,
 *   viewerUserId?: string | null,
 * }} [opts]
 *   limit 4~16(기본 8), sinceDays 1~30(기본 14)
 *   - `followedOnly=true` + `viewerUserId` 가 있으면 뷰어가 픽한 사용자 owner 의
 *     공개 컬렉션 활동만 반환. 팔로우가 0명이면 빈 배열.
 *   - `followedOnly=true` 인데 `viewerUserId` 가 없으면 그대로 빈 배열(호출자 fallback 책임).
 * @returns {Promise<Array<{
 *   key: string,
 *   type: 'collection_created'|'collection_updated'|'place_added'|'collection_saved_trending',
 *   occurred_at: string,
 *   actor: { user_id: string, display_name: string|null, username: string|null, avatar_url: string|null, is_curator: boolean },
 *   collection: { id: string, title: string|null, cover_image_url: string|null },
 *   place?: { id: string, name: string|null, step_label: string|null } | null,
 *   save_recent_count?: number,
 * }>>}
 */
export async function fetchRecentCuratorActivity({
  limit = 8,
  sinceDays = 14,
  followedOnly = false,
  viewerUserId = null,
} = {}) {
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 8), 4), 16);
  const sinceIso = toIsoDaysAgo(sinceDays);
  const pool = Math.min(40, lim * 4);

  let followingIds = null;
  if (followedOnly) {
    followingIds = await fetchFollowingUserIds(viewerUserId);
    if (!followingIds.length) {
      return [];
    }
  }

  const buildCollectionsQuery = (orderCol) => {
    let q = supabase
      .from("collections")
      .select(COLL_BASE)
      .eq("visibility", "public")
      .gte(orderCol, sinceIso)
      .order(orderCol, { ascending: false })
      .limit(pool);
    if (followingIds && followingIds.length > 0) {
      q = q.in("user_id", followingIds);
    }
    return q;
  };

  const buildPlacesQuery = () => {
    let q = supabase
      .from("collection_places")
      .select(
        `
        id, collection_id, place_id, step_label, created_at,
        places!collection_places_place_id_fkey ( id, name ),
        collections!inner ( ${COLL_BASE} )
      `,
      )
      .eq("collections.visibility", "public")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(pool * 2);
    if (followingIds && followingIds.length > 0) {
      q = q.in("collections.user_id", followingIds);
    }
    return q;
  };

  const buildSavesQuery = () => {
    let q = supabase
      .from("collection_saves")
      .select(
        `
        id, collection_id, user_id, created_at,
        collections!inner ( ${COLL_BASE} )
      `,
      )
      .eq("collections.visibility", "public")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(pool * 3);
    if (followingIds && followingIds.length > 0) {
      q = q.in("collections.user_id", followingIds);
    }
    return q;
  };

  const [
    { data: created, error: errCreated },
    { data: updated, error: errUpdated },
    { data: addedRows, error: errPlaces },
    { data: saveRows, error: errSaves },
  ] = await Promise.all([
    buildCollectionsQuery("created_at"),
    buildCollectionsQuery("updated_at"),
    buildPlacesQuery(),
    buildSavesQuery(),
  ]);

  if (import.meta?.env?.DEV) {
    if (errCreated) {
      console.warn("fetchRecentCuratorActivity created:", errCreated.message);
    }
    if (errUpdated) {
      console.warn("fetchRecentCuratorActivity updated:", errUpdated.message);
    }
    if (errPlaces) {
      console.warn("fetchRecentCuratorActivity places:", errPlaces.message);
    }
    if (errSaves) {
      console.warn("fetchRecentCuratorActivity saves:", errSaves.message);
    }
  }

  const events = [];

  (created || []).forEach((c) => {
    if (!c?.id || !c?.user_id) return;
    events.push({
      key: `created:${c.id}`,
      type: "collection_created",
      occurred_at: c.created_at,
      actor_id: c.user_id,
      collection: c,
    });
  });

  (updated || []).forEach((c) => {
    if (!c?.id || !c?.user_id) return;
    const ct = new Date(c.created_at || 0).getTime();
    const ut = new Date(c.updated_at || 0).getTime();
    if (
      Number.isFinite(ct) &&
      Number.isFinite(ut) &&
      ut - ct < UPDATE_GRACE_MS
    ) {
      return;
    }
    events.push({
      key: `updated:${c.id}:${c.updated_at}`,
      type: "collection_updated",
      occurred_at: c.updated_at,
      actor_id: c.user_id,
      collection: c,
    });
  });

  // 컬렉션당 최신 place_added 1건만
  const seenPlaceColl = new Set();
  (addedRows || []).forEach((row) => {
    const c = row?.collections;
    if (!c || c.visibility !== "public") return;
    if (!c.id || !c.user_id) return;
    if (seenPlaceColl.has(c.id)) return;
    seenPlaceColl.add(c.id);
    events.push({
      key: `place:${row.id}`,
      type: "place_added",
      occurred_at: row.created_at,
      actor_id: c.user_id,
      collection: c,
      place: {
        id: row.place_id,
        name: row?.places?.name || null,
        step_label:
          typeof row.step_label === "string" && row.step_label.trim()
            ? row.step_label.trim()
            : null,
      },
    });
  });

  // 최근 N일 saves >= 3 인 컬렉션은 trending 이벤트
  const saveCountByCid = new Map();
  const latestSaveByCid = new Map();
  (saveRows || []).forEach((row) => {
    const cid = row?.collection_id;
    if (!cid) return;
    saveCountByCid.set(cid, (saveCountByCid.get(cid) || 0) + 1);
    const ts = new Date(row.created_at || 0).getTime();
    const prev = latestSaveByCid.get(cid);
    if (!prev || ts > prev.ts) {
      latestSaveByCid.set(cid, { ts, row });
    }
  });
  saveCountByCid.forEach((count, cid) => {
    if (count < SAVE_TRENDING_MIN_COUNT) return;
    const latest = latestSaveByCid.get(cid);
    const c = latest?.row?.collections;
    if (!c?.id || !c?.user_id) return;
    events.push({
      key: `save:${cid}`,
      type: "collection_saved_trending",
      occurred_at: latest.row.created_at,
      actor_id: c.user_id,
      collection: c,
      save_recent_count: count,
    });
  });

  // 컬렉션 기준으로 가장 의미 있는 이벤트 1개만 남긴다.
  const bestByColl = new Map();
  events.forEach((e) => {
    const cid = e.collection?.id;
    if (!cid) return;
    const cur = bestByColl.get(cid);
    if (!cur) {
      bestByColl.set(cid, e);
      return;
    }
    const ep = PRIORITY[e.type] || 0;
    const cp = PRIORITY[cur.type] || 0;
    const et = new Date(e.occurred_at || 0).getTime();
    const ct = new Date(cur.occurred_at || 0).getTime();
    if (ep > cp || (ep === cp && et > ct)) bestByColl.set(cid, e);
  });

  const merged = [...bestByColl.values()].sort(
    (a, b) =>
      new Date(b.occurred_at || 0).getTime() -
      new Date(a.occurred_at || 0).getTime(),
  );
  const top = merged.slice(0, lim);

  const actorIds = [...new Set(top.map((e) => e.actor_id).filter(Boolean))];
  const profileMap = new Map();
  const curatorMap = new Map();
  if (actorIds.length > 0) {
    try {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", actorIds);
      (profs || []).forEach((p) => {
        if (p?.id) profileMap.set(p.id, p);
      });
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchRecentCuratorActivity profiles:", e?.message || e);
      }
    }
    try {
      const { data: curs } = await supabase
        .from("curators")
        .select("user_id, display_name, name, username, avatar_url")
        .in("user_id", actorIds);
      (curs || []).forEach((c) => {
        if (c?.user_id) curatorMap.set(c.user_id, c);
      });
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchRecentCuratorActivity curators:", e?.message || e);
      }
    }
  }

  return top.map((e) => {
    const prof = profileMap.get(e.actor_id) || null;
    const cur = curatorMap.get(e.actor_id) || null;
    const displayName =
      String(
        cur?.display_name || cur?.name || prof?.display_name || "",
      ).trim() || null;
    const username =
      String(cur?.username || prof?.username || "").trim() || null;
    const avatarUrl =
      String(cur?.avatar_url || prof?.avatar_url || "").trim() || null;
    return {
      key: e.key,
      type: e.type,
      occurred_at: e.occurred_at,
      actor: {
        user_id: e.actor_id,
        display_name: displayName,
        username,
        avatar_url: avatarUrl,
        is_curator: Boolean(cur),
      },
      collection: {
        id: e.collection.id,
        title: e.collection.title || null,
        cover_image_url: e.collection.cover_image_url || null,
      },
      place: e.place || null,
      save_recent_count: Number(e.save_recent_count) || 0,
    };
  });
}
