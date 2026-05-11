import { dedupeAndNormalizeCollectionTags } from "../utils/collectionTags";
import { supabase } from "./client";

/**
 * `collections` / `collection_places` 클라이언트 헬퍼.
 *
 * 모든 권한 검사는 DB RLS 가 담당한다(`collections.user_id = auth.uid()` 본인 한정 쓰기,
 * `visibility='public' OR user_id=auth.uid()` 읽기). 별도 RPC 없이 일반 PostgREST 호출만 사용.
 *
 * 호출 스타일은 `src/api/placePicks.js` 와 동일하다.
 *  - 조회 함수(`fetch*`): 에러 시 `throw`, 성공 시 데이터 직접 반환.
 *  - 변경 함수(`create*`, `update*`, `delete*`, `add*`, `remove*`, `reorder*`):
 *    `{ data, error }` 객체 반환(호출자가 분기).
 *
 * `curator_places` 는 전혀 손대지 않는다.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLLECTION_COLUMNS =
  "id, user_id, title, description, visibility, cover_image_url, vibe_caption, created_at, updated_at, is_featured, featured_rank, featured_until, tags, remixed_from_collection_id";

const VIBE_CAPTION_MAX_LEN = 80;

/**
 * `vibe_caption` 트림 + 길이 제한. 빈/공백은 `null` 로 정규화.
 * 길이를 넘으면 명시적으로 자르지 않고 호출자에게 에러를 돌려 입력 폼에서 안내하게 한다.
 *
 * @param {string | null | undefined} v
 * @returns {{ value: string | null, error: Error | null }}
 */
function normalizeVibeCaption(v) {
  if (v === undefined) return { value: null, error: null };
  if (v === null) return { value: null, error: null };
  if (typeof v !== "string") {
    return { value: null, error: new Error("vibe_caption must be string") };
  }
  const trimmed = v.trim();
  if (trimmed.length === 0) return { value: null, error: null };
  if (trimmed.length > VIBE_CAPTION_MAX_LEN) {
    return {
      value: null,
      error: new Error(`vibe_caption must be ≤ ${VIBE_CAPTION_MAX_LEN} chars`),
    };
  }
  return { value: trimmed, error: null };
}

/**
 * 운영자 추천(EDITOR PICK)이 아직 활성인지(만료 안 지났는지) 판정.
 *
 * @param {{ is_featured?: boolean, featured_until?: string | null }} row
 * @returns {boolean}
 */
export function isFeaturedActive(row) {
  if (!row || row.is_featured !== true) return false;
  const until = row.featured_until;
  if (until == null) return true;
  const t = new Date(until).getTime();
  if (!Number.isFinite(t)) return true;
  return t > Date.now();
}

function compareFeaturedFirst(a, b) {
  const af = isFeaturedActive(a);
  const bf = isFeaturedActive(b);
  if (af !== bf) return af ? -1 : 1;
  if (af && bf) {
    const ra = Number.isFinite(a?.featured_rank)
      ? a.featured_rank
      : Number.POSITIVE_INFINITY;
    const rb = Number.isFinite(b?.featured_rank)
      ? b.featured_rank
      : Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
  }
  return 0;
}

/**
 * 카드 그리드용 — 컬렉션 컬럼 + `collection_places` 행 수.
 * PostgREST 가 `collection_places: [{ count: N }]` 모양으로 반환하므로 `unwrapPlaceCount` 로 평탄화.
 */
const COLLECTION_LIST_SELECT = `${COLLECTION_COLUMNS}, collection_places(count)`;

/** 홈 레일용 — 장소·좋아요·저장 카운트를 한 번의 SELECT 로 묶는다. */
const HOME_PUBLIC_COLLECTION_SELECT = `
  ${COLLECTION_COLUMNS},
  collection_places(count),
  collection_likes(count),
  collection_saves(count)
`;

const COLLECTION_PLACE_COLUMNS =
  "id, collection_id, place_id, order_index, memo, step_label, created_at";

const STEP_LABEL_MAX_LEN = 24;

const COLLECTION_PLACE_WITH_PLACE_SELECT = `
  ${COLLECTION_PLACE_COLUMNS},
  places!collection_places_place_id_fkey (*)
`;

const ALLOWED_VISIBILITY = new Set(["public", "private"]);

function assertUuid(value, label) {
  const id = String(value ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    throw new Error(`${label}: invalid uuid`);
  }
  return id;
}

function trimText(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * 컬렉션 원작자 표시용 — `profiles` 는 anon 도 SELECT 가능.
 *
 * @param {string} userId
 * @returns {Promise<string | null>}
 */
async function fetchCreatorDisplayLabel(userId) {
  const id = String(userId ?? "").trim();
  if (!id || !UUID_RE.test(id)) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return trimText(data.display_name) ?? trimText(data.username) ?? null;
}

/**
 * @param {string | null} sourceDescription
 * @param {string | null} creatorLabel
 * @returns {string | null}
 */
function buildRemixDescription(sourceDescription, creatorLabel) {
  const origDesc = trimText(sourceDescription);
  const attribution = creatorLabel
    ? `${creatorLabel}님의 코스를 바탕으로 만들었어요.`
    : null;
  if (attribution && origDesc) return `${attribution}\n\n${origDesc}`;
  if (attribution) return attribution;
  return origDesc;
}

/**
 * 컬렉션 행에서 `collection_places(count)` 결과를 평탄화해 `place_count` 숫자 필드로 옮긴다.
 *
 * @param {object} row
 * @returns {object}
 */
function unwrapPlaceCount(row) {
  if (!row || typeof row !== "object") return row;
  const nested = Array.isArray(row.collection_places) ? row.collection_places : [];
  const count = nested.length > 0 ? Number(nested[0]?.count) || 0 : 0;
  const out = { ...row, place_count: count };
  delete out.collection_places;
  return out;
}

/**
 * 홈 레일용 행 평탄화 — `collection_places` / `collection_likes` / `collection_saves`
 * 임베디드 `(count)` 배열을 숫자 필드로 옮긴다.
 *
 * @param {object} row
 * @returns {object}
 */
function unwrapHomePublicCollectionRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };

  const placesNested = Array.isArray(out.collection_places)
    ? out.collection_places
    : [];
  out.place_count =
    placesNested.length > 0 ? Number(placesNested[0]?.count) || 0 : 0;
  delete out.collection_places;

  const likesNested = Array.isArray(out.collection_likes)
    ? out.collection_likes
    : [];
  out.like_count =
    likesNested.length > 0 ? Number(likesNested[0]?.count) || 0 : 0;
  delete out.collection_likes;

  const savesNested = Array.isArray(out.collection_saves)
    ? out.collection_saves
    : [];
  out.save_count =
    savesNested.length > 0 ? Number(savesNested[0]?.count) || 0 : 0;
  delete out.collection_saves;

  return out;
}

async function getMyUid(label) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error(`${label}: not authenticated`);
  }
  return user.id;
}

// ---------------------------------------------------------------------------
// 조회 (throw on error)
// ---------------------------------------------------------------------------

/**
 * 로그인 사용자의 컬렉션 전체 목록(공개 + 비공개). 최신 생성순.
 * 각 행에는 `place_count`(장소 수)가 함께 반환된다.
 *
 * @returns {Promise<object[]>}
 */
export async function fetchMyCollections() {
  const uid = await getMyUid("fetchMyCollections");
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_LIST_SELECT)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message || "fetchMyCollections failed");
  }
  return (Array.isArray(data) ? data : []).map(unwrapPlaceCount);
}

/**
 * 특정 사용자의 공개 컬렉션 목록(타인 프로필 노출용). 비로그인에서도 호출 가능.
 * 각 행에는 `place_count` 가 함께 반환된다.
 *
 * @param {string} userId — `auth.users.id`
 * @returns {Promise<object[]>}
 */
export async function fetchPublicCollectionsByUser(userId) {
  const uid = assertUuid(userId, "fetchPublicCollectionsByUser");
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_LIST_SELECT)
    .eq("user_id", uid)
    .eq("visibility", "public")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message || "fetchPublicCollectionsByUser failed");
  }
  return (Array.isArray(data) ? data : []).map(unwrapPlaceCount);
}

/**
 * 홈 상단 레일용 공개 컬렉션 목록. 비로그인 호출 가능(RLS).
 *
 * 최근 생성된 공개 컬렉션 풀을 한 번 가져온 뒤, 저장 수 → 좋아요 수 → 생성일
 * 순으로 정렬해 상위 `limit` 건만 반환한다(저장·반응이 많은 코스가 오른쪽으로
 * 올라오되, 전혀 노출되지 않는 오래된 행만 있는 경우를 줄이기 위해 최근 풀에서만 고른다).
 *
 * @param {{ limit?: number }} [opts] — 기본 8, 허용 범위 6~10
 * @returns {Promise<object[]>} — 각 행에 `place_count`, `like_count`, `save_count` 포함
 */
export async function fetchHomePublicCollections({ limit = 8 } = {}) {
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 8), 6), 10);
  const pool = Math.min(48, Math.max(lim * 5, 24));

  const { data, error } = await supabase
    .from("collections")
    .select(HOME_PUBLIC_COLLECTION_SELECT)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(pool);

  if (error) {
    throw new Error(error.message || "fetchHomePublicCollections failed");
  }

  const rows = (Array.isArray(data) ? data : []).map(unwrapHomePublicCollectionRow);

  rows.sort((a, b) => {
    const fcmp = compareFeaturedFirst(a, b);
    if (fcmp !== 0) return fcmp;
    const ds = Number(b.save_count || 0) - Number(a.save_count || 0);
    if (ds !== 0) return ds;
    const dl = Number(b.like_count || 0) - Number(a.like_count || 0);
    if (dl !== 0) return dl;
    const bt = new Date(b.created_at || 0).getTime();
    const at = new Date(a.created_at || 0).getTime();
    return bt - at;
  });

  return rows.slice(0, lim);
}

/**
 * 홈 상단 레일 — **내가 픽한 사용자들**이 만든 공개 컬렉션만 모아서 반환.
 *
 * 정렬·구조는 `fetchHomePublicCollections` 와 동일하지만, 후보 풀이
 * `user_profile_follows.follower_id = viewerUserId` 인 사용자들의 행으로 한정된다.
 * 비로그인이거나 `following` 이 없으면 빈 배열을 반환 → 호출자가 fallback 결정.
 *
 * @param {string} viewerUserId — `auth.users.id`
 * @param {{ limit?: number }} [opts] — 기본 8, 허용 범위 1~24
 * @returns {Promise<object[]>} — 행마다 `place_count`, `like_count`, `save_count` 포함
 */
export async function fetchHomePublicCollectionsByFollowed(
  viewerUserId,
  { limit = 8 } = {},
) {
  const me = String(viewerUserId ?? "").trim();
  if (!me) return [];
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 8), 1), 24);
  const pool = Math.min(80, Math.max(lim * 5, 24));

  const { data: follows, error: fErr } = await supabase
    .from("user_profile_follows")
    .select("following_id")
    .eq("follower_id", me);
  if (fErr) {
    throw new Error(
      fErr.message || "fetchHomePublicCollectionsByFollowed follows failed",
    );
  }
  const followingIds = (Array.isArray(follows) ? follows : [])
    .map((r) => String(r?.following_id ?? "").trim())
    .filter(Boolean);
  if (followingIds.length === 0) return [];

  const { data, error } = await supabase
    .from("collections")
    .select(HOME_PUBLIC_COLLECTION_SELECT)
    .eq("visibility", "public")
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(pool);

  if (error) {
    throw new Error(
      error.message || "fetchHomePublicCollectionsByFollowed failed",
    );
  }

  const rows = (Array.isArray(data) ? data : []).map(
    unwrapHomePublicCollectionRow,
  );

  rows.sort((a, b) => {
    const fcmp = compareFeaturedFirst(a, b);
    if (fcmp !== 0) return fcmp;
    const ds = Number(b.save_count || 0) - Number(a.save_count || 0);
    if (ds !== 0) return ds;
    const dl = Number(b.like_count || 0) - Number(a.like_count || 0);
    if (dl !== 0) return dl;
    const bt = new Date(b.created_at || 0).getTime();
    const at = new Date(a.created_at || 0).getTime();
    return bt - at;
  });

  return rows.slice(0, lim);
}

/**
 * 홈 「지금 뜨는 코스」 — 공개 컬렉션 풀에서 최근 24h 체크인 + 현재 불꽃 장소를
 * 합산한 `hot_score` 기준으로 정렬한 라이트 목록.
 *
 * 정확한 랭킹보다 "살아있는 느낌" 이 목적. 모든 보조 fetch(`hot_places_24h` /
 * `get_hot_places`) 는 best-effort 로 실패해도 컬렉션 자체는 그대로 반환된다.
 *
 * - 점수 = `recent_checkin_count` + `fire_place_count` * 10
 *   (불꽃 장소 1개가 24h 체크인 ~10건과 동등한 가중치)
 * - 동점·전부 0 점이면 최신 생성순 fallback (초기 데이터가 적어도 비어 보이지 않게)
 *
 * Home 검색·지도 fetch 와 무관하게 단독 호출.
 *
 * @param {{ limit?: number }} [opts] — 기본 6, 허용 범위 3~8
 * @returns {Promise<object[]>} 각 행에 다음 필드:
 *   - `id`, `title`, `cover_image_url`, `vibe_caption`, `created_at`, `place_count`
 *   - `step_labels`: 최대 4개의 코스 스텝 라벨 (order_index 기준)
 *   - `recent_checkin_count`, `fire_place_count`, `hot_score`
 */
export async function fetchHotCollectionsNow({ limit = 6 } = {}) {
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 6), 3), 8);
  const pool = Math.min(40, Math.max(lim * 6, 24));

  const { data, error } = await supabase
    .from("collections")
    .select(
      `
      id, title, visibility, cover_image_url, vibe_caption, created_at,
      is_featured, featured_rank, featured_until,
      collection_places (
        place_id,
        step_label,
        order_index,
        places!collection_places_place_id_fkey ( kakao_place_id )
      )
    `,
    )
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(pool);

  if (error) {
    throw new Error(error.message || "fetchHotCollectionsNow failed");
  }

  const rows = Array.isArray(data) ? data : [];

  // place_id(UUID) ↔ kakao_place_id 양쪽 키 모두 hot 소스에서 매칭되도록 canon map 구성.
  const canonByAny = new Map();
  const allUuids = new Set();
  const allKakao = new Set();
  rows.forEach((r) => {
    const places = Array.isArray(r.collection_places) ? r.collection_places : [];
    places.forEach((p) => {
      const uuid = String(p?.place_id ?? "").trim();
      if (uuid) {
        canonByAny.set(uuid, uuid);
        allUuids.add(uuid);
      }
      const k = String(p?.places?.kakao_place_id ?? "").trim();
      if (k && /^\d+$/.test(k) && uuid) {
        canonByAny.set(k, uuid);
        allKakao.add(k);
      }
    });
  });

  const lookupKeys = [...allUuids, ...allKakao];
  const recentCountByCanon = new Map();
  const fireCanonSet = new Set();

  if (lookupKeys.length > 0) {
    try {
      const { data: hot24 } = await supabase
        .from("hot_places_24h")
        .select("place_id, checkin_count")
        .in("place_id", lookupKeys)
        .limit(500);
      (hot24 || []).forEach((row) => {
        const pidStr = String(row?.place_id ?? "").trim();
        const canon = canonByAny.get(pidStr);
        const c = Number(row?.checkin_count) || 0;
        if (canon && c > 0) {
          recentCountByCanon.set(canon, (recentCountByCanon.get(canon) || 0) + c);
        }
      });
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("fetchHotCollectionsNow hot_places_24h:", e?.message || e);
      }
    }
  }

  try {
    const { data: fireRows } = await supabase.rpc("get_hot_places");
    (Array.isArray(fireRows) ? fireRows : []).forEach((row) => {
      const pidStr = String(row?.place_id ?? "").trim();
      const canon = canonByAny.get(pidStr);
      if (canon) fireCanonSet.add(canon);
    });
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchHotCollectionsNow get_hot_places:", e?.message || e);
    }
  }

  const enriched = rows.map((r) => {
    const places = Array.isArray(r.collection_places) ? r.collection_places : [];
    const sortedByOrder = [...places].sort(
      (a, b) => (Number(a?.order_index) || 0) - (Number(b?.order_index) || 0),
    );
    let recent = 0;
    let fire = 0;
    const stepLabels = [];
    sortedByOrder.forEach((p) => {
      const uuid = String(p?.place_id ?? "").trim();
      if (uuid) {
        recent += recentCountByCanon.get(uuid) || 0;
        if (fireCanonSet.has(uuid)) fire += 1;
      }
      const lbl =
        typeof p?.step_label === "string" ? p.step_label.trim() : "";
      if (lbl) stepLabels.push(lbl);
    });
    const hot_score = recent + fire * 10;
    return {
      id: r.id,
      title: r.title,
      cover_image_url: r.cover_image_url,
      vibe_caption: typeof r.vibe_caption === "string" ? r.vibe_caption : null,
      created_at: r.created_at,
      is_featured: r.is_featured === true,
      featured_rank: Number.isFinite(r.featured_rank) ? r.featured_rank : null,
      featured_until: r.featured_until ?? null,
      place_count: places.length,
      step_labels: stepLabels.slice(0, 4),
      recent_checkin_count: recent,
      fire_place_count: fire,
      hot_score,
    };
  });

  enriched.sort((a, b) => {
    const fcmp = compareFeaturedFirst(a, b);
    if (fcmp !== 0) return fcmp;
    if (b.hot_score !== a.hot_score) return b.hot_score - a.hot_score;
    return (
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
    );
  });

  return enriched.slice(0, lim);
}

/**
 * 컬렉션 1건 + 포함 장소 목록(`places` 조인). RLS 가 비공개 컬렉션은 본인에게만 노출.
 *
 * @param {string} collectionId
 * @returns {Promise<object | null>} — `collection_places` 는 `order_index` 오름차순.
 *   `null` 은 비공개거나 존재하지 않을 때(둘은 RLS 상 구분되지 않음).
 */
export async function fetchCollectionDetail(collectionId) {
  const cid = assertUuid(collectionId, "fetchCollectionDetail");
  const { data, error } = await supabase
    .from("collections")
    .select(
      `
      ${COLLECTION_COLUMNS},
      collection_places:collection_places (
        ${COLLECTION_PLACE_WITH_PLACE_SELECT}
      )
    `,
    )
    .eq("id", cid)
    .order("order_index", {
      foreignTable: "collection_places",
      ascending: true,
    })
    .order("created_at", {
      foreignTable: "collection_places",
      ascending: true,
    })
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "fetchCollectionDetail failed");
  }
  if (!data) return null;

  // 방어적 정렬 — foreignTable order 옵션이 어떤 환경에서 무시될 가능성 대비.
  if (Array.isArray(data.collection_places)) {
    data.collection_places.sort((a, b) => {
      const ai = Number.isFinite(a?.order_index) ? a.order_index : 0;
      const bi = Number.isFinite(b?.order_index) ? b.order_index : 0;
      if (ai !== bi) return ai - bi;
      const at = a?.created_at ?? "";
      const bt = b?.created_at ?? "";
      return at < bt ? -1 : at > bt ? 1 : 0;
    });
  }
  return data;
}

/**
 * 리믹스 lineage 의 부모(원본) 컬렉션 lightweight 조회.
 *
 * `collections.remixed_from_collection_id` 가 가리키는 원본을 한 줄 라벨용으로만 가져온다.
 * RLS 가 비공개 부모를 가려 주므로 노출 가능 여부는 DB 가 판정 — 가려진 경우 `null` 반환.
 *
 * 추천/정렬 score 에는 영향 X. 출처 라벨/링크에만 사용.
 *
 * @param {string} collectionId — child collection id
 * @returns {Promise<{
 *   id: string,
 *   title: string | null,
 *   user_id: string,
 *   visibility: string,
 *   creator_label: string | null,
 * } | null>}
 */
export async function fetchCollectionRemixSource(collectionId) {
  const cid = assertUuid(collectionId, "fetchCollectionRemixSource");
  const { data: child, error: childErr } = await supabase
    .from("collections")
    .select("remixed_from_collection_id")
    .eq("id", cid)
    .maybeSingle();
  if (childErr || !child) return null;
  const parentId =
    typeof child.remixed_from_collection_id === "string"
      ? child.remixed_from_collection_id.trim()
      : null;
  if (!parentId || !UUID_RE.test(parentId)) return null;

  const { data: parent, error: parentErr } = await supabase
    .from("collections")
    .select("id, title, user_id, visibility")
    .eq("id", parentId)
    .maybeSingle();
  if (parentErr || !parent) return null;

  let creatorLabel = null;
  try {
    creatorLabel = await fetchCreatorDisplayLabel(parent.user_id);
  } catch {
    creatorLabel = null;
  }

  return {
    id: parent.id,
    title: trimText(parent.title),
    user_id: parent.user_id,
    visibility: parent.visibility,
    creator_label: creatorLabel,
  };
}

/**
 * "이 코스를 바탕으로 만들어진 코스 N개" — 자식 카운트.
 *
 * RLS 가 자식 행 가시성을 정해주므로(`public OR own`), 비로그인/타인은 공개 자식만 세고,
 * 본인이 보고 있는 컬렉션이라면 본인 비공개 자식까지 포함된다(분리 불필요한 lightweight 표시).
 *
 * @param {string} collectionId — parent collection id
 * @returns {Promise<number>}
 */
export async function fetchCollectionRemixCount(collectionId) {
  const cid = assertUuid(collectionId, "fetchCollectionRemixCount");
  const { count, error } = await supabase
    .from("collections")
    .select("id", { head: true, count: "exact" })
    .eq("remixed_from_collection_id", cid);
  if (error) return 0;
  return Number.isFinite(count) ? count : 0;
}

/**
 * "이 흐름을 바탕으로 한 코스" 섹션용 — 부모로 지목된 공개 자식 컬렉션 lightweight 목록.
 *
 * 정책:
 *  - **공개 자식만** 노출(`visibility = 'public'`). 본인 비공개 자식은 카운트에는 합쳐지지만
 *    이 리스트 섹션에서는 가려, 다른 사용자에게 공개되는 카드와 동일한 시야를 유지한다.
 *  - 정렬: `save_count desc → like_count desc → created_at desc`. 추천/검색 score 와는 분리.
 *  - 카드 props: `cover_image_url`, `title`, `tags`, `creator_label`, `place_count`,
 *    `like_count`, `save_count`.
 *
 * `useCourseSearch` / 추천 / 정렬 score 와 무관한 단일 SELECT 기반 구현.
 *
 * @param {string} parentCollectionId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<object>>}
 */
export async function fetchCollectionRemixChildren(
  parentCollectionId,
  { limit = 8 } = {},
) {
  const cid = assertUuid(parentCollectionId, "fetchCollectionRemixChildren");
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 8), 1), 24);
  const pool = Math.min(48, Math.max(lim * 3, 12));

  const { data, error } = await supabase
    .from("collections")
    .select(HOME_PUBLIC_COLLECTION_SELECT)
    .eq("remixed_from_collection_id", cid)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(pool);
  if (error) {
    throw new Error(error.message || "fetchCollectionRemixChildren failed");
  }

  const rows = (Array.isArray(data) ? data : []).map(unwrapHomePublicCollectionRow);
  if (rows.length === 0) return [];

  rows.sort((a, b) => {
    const ds = Number(b.save_count || 0) - Number(a.save_count || 0);
    if (ds !== 0) return ds;
    const dl = Number(b.like_count || 0) - Number(a.like_count || 0);
    if (dl !== 0) return dl;
    const bt = new Date(b.created_at || 0).getTime();
    const at = new Date(a.created_at || 0).getTime();
    return bt - at;
  });

  const top = rows.slice(0, lim);

  // creator label best-effort 부착 — RLS 상 profiles 는 anon SELECT 가능.
  const ownerIds = Array.from(
    new Set(
      top
        .map((r) => String(r?.user_id ?? "").trim())
        .filter((id) => UUID_RE.test(id)),
    ),
  );
  const labelById = {};
  if (ownerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", ownerIds);
    if (Array.isArray(profileRows)) {
      profileRows.forEach((p) => {
        const id = String(p?.id ?? "").trim();
        if (!id) return;
        const lbl = trimText(p?.display_name) ?? trimText(p?.username) ?? null;
        labelById[id] = lbl;
      });
    }
  }

  return top.map((r) => ({
    ...r,
    creator_label: labelById[String(r?.user_id ?? "").trim()] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// 변경 ({ data, error } 반환)
// ---------------------------------------------------------------------------

/**
 * 새 컬렉션 생성. `user_id` 는 `auth.uid()` 로 강제 세팅(RLS WITH CHECK).
 *
 * @param {{
 *   title: string,
 *   description?: string | null,
 *   visibility?: 'public'|'private',
 *   cover_image_url?: string | null,
 *   vibe_caption?: string | null,
 *   remixed_from_collection_id?: string | null,
 * }} input
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function createCollection({
  title,
  description = null,
  visibility = "public",
  cover_image_url: coverImageUrlIn,
  vibe_caption: vibeCaptionIn,
  remixed_from_collection_id: remixedFromIn,
} = {}) {
  const t = trimText(title);
  if (!t) {
    return {
      data: null,
      error: new Error("createCollection: title is required"),
    };
  }
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    return {
      data: null,
      error: new Error("createCollection: invalid visibility"),
    };
  }

  let uid;
  try {
    uid = await getMyUid("createCollection");
  } catch (err) {
    return { data: null, error: err };
  }

  const insertRow = {
    user_id: uid,
    title: t,
    description: trimText(description),
    visibility,
  };
  if (coverImageUrlIn !== undefined) {
    insertRow.cover_image_url = trimText(coverImageUrlIn);
  }
  if (vibeCaptionIn !== undefined) {
    const { value: vibeValue, error: vibeErr } = normalizeVibeCaption(vibeCaptionIn);
    if (vibeErr) return { data: null, error: vibeErr };
    insertRow.vibe_caption = vibeValue;
  }
  if (remixedFromIn !== undefined && remixedFromIn !== null) {
    const remixedFrom = String(remixedFromIn).trim();
    if (UUID_RE.test(remixedFrom)) {
      insertRow.remixed_from_collection_id = remixedFrom;
    }
  }

  const { data, error } = await supabase
    .from("collections")
    .insert(insertRow)
    .select(COLLECTION_COLUMNS)
    .single();

  // first session activation: 첫 컬렉션 생성으로 activation 완료 (best-effort)
  if (!error && data?.id) {
    try {
      const { markActivationEvent, completeActivation } = await import(
        "../utils/activationState"
      );
      markActivationEvent("first_collection_create");
      completeActivation("create");
    } catch {
      /* ignore */
    }
  }

  return { data, error };
}

/**
 * 컬렉션 메타 수정. `title` / `description` / `visibility` / `cover_image_url` /
 * `vibe_caption` / `tags` 만 화이트리스트.
 * 본인 행이 아니면 RLS 가 0행을 반환 → `data === null`, `error === null`.
 *
 * @param {string} collectionId
 * @param {{
 *   title?: string,
 *   description?: string | null,
 *   visibility?: 'public'|'private',
 *   cover_image_url?: string | null,
 *   vibe_caption?: string | null,
 *   tags?: string[] | null,
 * }} patch
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function updateCollection(collectionId, patch) {
  const cid = assertUuid(collectionId, "updateCollection");
  const updates = {};

  if (patch && typeof patch === "object") {
    if ("title" in patch) {
      const t = trimText(patch.title);
      if (!t) {
        return {
          data: null,
          error: new Error("updateCollection: title cannot be empty"),
        };
      }
      updates.title = t;
    }
    if ("description" in patch) {
      updates.description = trimText(patch.description);
    }
    if ("visibility" in patch) {
      if (!ALLOWED_VISIBILITY.has(patch.visibility)) {
        return {
          data: null,
          error: new Error("updateCollection: invalid visibility"),
        };
      }
      updates.visibility = patch.visibility;
    }
    if ("cover_image_url" in patch) {
      updates.cover_image_url = trimText(patch.cover_image_url);
    }
    if ("vibe_caption" in patch) {
      const { value: vibeValue, error: vibeErr } = normalizeVibeCaption(
        patch.vibe_caption,
      );
      if (vibeErr) return { data: null, error: vibeErr };
      updates.vibe_caption = vibeValue;
    }
    if ("tags" in patch) {
      const cleaned = dedupeAndNormalizeCollectionTags(patch.tags);
      updates.tags = cleaned.length > 0 ? cleaned : null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      data: null,
      error: new Error("updateCollection: empty patch"),
    };
  }

  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", cid)
    .select(COLLECTION_COLUMNS)
    .maybeSingle();
  return { data, error };
}

/**
 * 홈 태그 레일 groundwork — 특정 태그로 필터된 공개 컬렉션 풀 fetch.
 *
 * `collections.tags` 가 `tag` 를 **포함**(`@>`) 하는 행만 가져온다. featured-active
 * 가 우선 노출되고, 그 다음은 `fetchHomePublicCollections` 와 동일하게
 * save_count → like_count → 최신순.
 *
 * @param {string} tag — 비교는 `dedupeAndNormalizeCollectionTags` 로 정규화 후 적용.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>} — 행마다 `place_count`, `like_count`, `save_count` 포함.
 */
export async function fetchHomeCollectionsByTag(tag, { limit = 8 } = {}) {
  const cleaned = dedupeAndNormalizeCollectionTags([tag]);
  if (cleaned.length === 0) return [];
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 8), 1), 60);
  const pool = Math.min(120, Math.max(lim * 3, 24));

  const { data, error } = await supabase
    .from("collections")
    .select(HOME_PUBLIC_COLLECTION_SELECT)
    .eq("visibility", "public")
    .contains("tags", cleaned)
    .order("created_at", { ascending: false })
    .limit(pool);

  if (error) {
    throw new Error(error.message || "fetchHomeCollectionsByTag failed");
  }

  const rows = (Array.isArray(data) ? data : []).map(unwrapHomePublicCollectionRow);

  rows.sort((a, b) => {
    const fcmp = compareFeaturedFirst(a, b);
    if (fcmp !== 0) return fcmp;
    const ds = Number(b.save_count || 0) - Number(a.save_count || 0);
    if (ds !== 0) return ds;
    const dl = Number(b.like_count || 0) - Number(a.like_count || 0);
    if (dl !== 0) return dl;
    const bt = new Date(b.created_at || 0).getTime();
    const at = new Date(a.created_at || 0).getTime();
    return bt - at;
  });

  return rows.slice(0, lim);
}

/**
 * 운영자 전용: 컬렉션의 추천(EDITOR PICK) 상태를 토글/조정.
 *
 * RLS 가 admin role 한정으로 UPDATE 를 허용한다(`profiles.role = 'admin'`).
 * 일반 owner UPDATE 정책과 OR 결합되어, 본인 행이면 admin 이 아니어도 통과되지만
 * 본인 행은 어차피 `updateCollection` 화이트리스트가 featured 컬럼을 거른다.
 *
 * @param {string} collectionId
 * @param {{
 *   isFeatured?: boolean,
 *   featuredRank?: number | null,
 *   featuredUntil?: string | null,
 * }} patch
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function setCollectionFeatured(collectionId, patch = {}) {
  const cid = assertUuid(collectionId, "setCollectionFeatured");
  const updates = {};
  if ("isFeatured" in patch) {
    updates.is_featured = Boolean(patch.isFeatured);
  }
  if ("featuredRank" in patch) {
    if (patch.featuredRank == null) {
      updates.featured_rank = null;
    } else {
      const n = Number(patch.featuredRank);
      updates.featured_rank = Number.isFinite(n) ? Math.floor(n) : null;
    }
  }
  if ("featuredUntil" in patch) {
    if (patch.featuredUntil == null) {
      updates.featured_until = null;
    } else {
      const t = String(patch.featuredUntil).trim();
      updates.featured_until = t.length > 0 ? t : null;
    }
  }
  if (Object.keys(updates).length === 0) {
    return {
      data: null,
      error: new Error("setCollectionFeatured: empty patch"),
    };
  }

  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", cid)
    .select(COLLECTION_COLUMNS)
    .maybeSingle();
  return { data, error };
}

/**
 * 운영자 페이지용: 현재 활성 추천(공개·미만료) 목록.
 *
 * RLS 상 anon/authenticated 모두 SELECT 가능(공개 컬렉션 한정). 만료된 행은
 * 클라이언트에서 한 번 더 거른다.
 *
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchFeaturedCollections({ limit = 30 } = {}) {
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 30), 1), 100);
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .eq("is_featured", true)
    .eq("visibility", "public")
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error) {
    throw new Error(error.message || "fetchFeaturedCollections failed");
  }
  return (Array.isArray(data) ? data : []).filter(isFeaturedActive);
}

/**
 * 컬렉션 삭제. 자식 `collection_places` 는 FK ON DELETE CASCADE 로 함께 정리.
 *
 * @param {string} collectionId
 * @returns {Promise<{ data: { id: string } | null, error: Error | null }>}
 */
export async function deleteCollection(collectionId) {
  const cid = assertUuid(collectionId, "deleteCollection");
  const { data, error } = await supabase
    .from("collections")
    .delete()
    .eq("id", cid)
    .select("id")
    .maybeSingle();
  return { data, error };
}

/**
 * 기존 컬렉션을 본인 명의로 복제(remix). 새 컬렉션은 기본 비공개로 시작해
 * 사용자가 이름·공개 범위를 다듬은 뒤 직접 공개로 바꾸도록 한다.
 *
 * 절차:
 *  1. `fetchCollectionDetail` 로 원본 + 장소(places, step_label, memo, order_index) 로드
 *  2. 원작자 `profiles` 로 출처 한 줄을 description 상단에 붙임(가능할 때)
 *  3. `createCollection` (비공개 기본, cover·설명·`remixed_from_collection_id` 세팅) 후
 *     `tags` 가 있으면 `updateCollection`
 *  4. `collection_places` 일괄 INSERT — 자식 RLS 가 부모 user_id 매칭으로 통과
 *  5. 태그·자식 INSERT 실패 시 best-effort 로 새 컬렉션 삭제(고아 방지)
 *
 * lineage 는 `remixed_from_collection_id` 한 단계만 기록(부모만). 추천/정렬 score 에는
 * 영향 X — UI 라벨/카운트에만 활용.
 *
 * 검색·지도·추천 파이프라인과 무관. RLS 가 비공개 원본을 막아주므로 권한 검증은 DB 가 담당.
 *
 * @param {string} sourceCollectionId
 * @param {{ title?: string, visibility?: 'public'|'private', skipAttribution?: boolean }} [opts]
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function duplicateCollection(
  sourceCollectionId,
  { title: titleIn, visibility: visibilityIn, skipAttribution = false } = {},
) {
  const cid = assertUuid(sourceCollectionId, "duplicateCollection");

  let source;
  try {
    source = await fetchCollectionDetail(cid);
  } catch (e) {
    return { data: null, error: e };
  }
  if (!source) {
    return {
      data: null,
      error: new Error("duplicateCollection: source not found or not visible"),
    };
  }

  let creatorLabel = null;
  if (!skipAttribution && source.user_id) {
    try {
      creatorLabel = await fetchCreatorDisplayLabel(source.user_id);
    } catch {
      creatorLabel = null;
    }
  }

  const baseTitle =
    trimText(titleIn) ??
    `${trimText(source.title) ?? "가져온 컬렉션"} (가져옴)`;
  const visibility = ALLOWED_VISIBILITY.has(visibilityIn)
    ? visibilityIn
    : "private";

  const remixDescription = skipAttribution
    ? trimText(source.description)
    : buildRemixDescription(source.description, creatorLabel);

  const { data: created, error: createErr } = await createCollection({
    title: baseTitle,
    description: remixDescription,
    visibility,
    cover_image_url: trimText(source.cover_image_url),
    vibe_caption: trimText(source.vibe_caption),
    remixed_from_collection_id: source.id,
  });
  if (createErr) return { data: null, error: createErr };
  if (!created?.id) {
    return {
      data: null,
      error: new Error("duplicateCollection: create returned no id"),
    };
  }

  const tagCopy = dedupeAndNormalizeCollectionTags(source.tags);
  if (tagCopy.length > 0) {
    const { error: tagErr } = await updateCollection(created.id, {
      tags: tagCopy,
    });
    if (tagErr) {
      try {
        await deleteCollection(created.id);
      } catch (e) {
        if (import.meta?.env?.DEV) {
          console.warn("duplicateCollection tag rollback:", e?.message || e);
        }
      }
      return { data: null, error: tagErr };
    }
  }

  const places = Array.isArray(source.collection_places)
    ? source.collection_places
    : [];
  if (places.length === 0) {
    return { data: created, error: null };
  }

  const rows = places
    .map((p, idx) => {
      const placeId = String(p?.place_id ?? "").trim();
      if (!UUID_RE.test(placeId)) return null;
      const stepRaw =
        typeof p?.step_label === "string" ? p.step_label.trim() : "";
      const memoRaw =
        typeof p?.memo === "string" ? p.memo.trim() : "";
      return {
        collection_id: created.id,
        place_id: placeId,
        order_index: Number.isFinite(p?.order_index) ? p.order_index : idx,
        step_label: stepRaw.length > 0 ? stepRaw : null,
        memo: memoRaw.length > 0 ? memoRaw : null,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return { data: created, error: null };
  }

  const { error: insErr } = await supabase
    .from("collection_places")
    .insert(rows);
  if (insErr) {
    // 고아 빈 컬렉션이 남지 않게 best-effort 롤백.
    try {
      await deleteCollection(created.id);
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("duplicateCollection rollback:", e?.message || e);
      }
    }
    return { data: null, error: insErr };
  }

  return { data: created, error: null };
}

/**
 * 컬렉션에 장소 추가. 마지막 행 다음 `order_index` 로 자동 부여.
 * 동일 (`collection_id`, `place_id`) 중복은 23505 로 반환(호출자가 분기).
 *
 * @param {string} collectionId
 * @param {string} placeId
 * @param {string | null} [memo]
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function addPlaceToCollection(collectionId, placeId, memo = null) {
  const cid = assertUuid(collectionId, "addPlaceToCollection");
  const pid = assertUuid(placeId, "addPlaceToCollection");

  const { data: maxRow, error: maxErr } = await supabase
    .from("collection_places")
    .select("order_index")
    .eq("collection_id", cid)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) {
    return { data: null, error: maxErr };
  }
  const nextIdx = Number.isFinite(maxRow?.order_index)
    ? maxRow.order_index + 1
    : 0;

  const payload = {
    collection_id: cid,
    place_id: pid,
    order_index: nextIdx,
    memo: trimText(memo),
  };

  const { data, error } = await supabase
    .from("collection_places")
    .insert(payload)
    .select(COLLECTION_PLACE_WITH_PLACE_SELECT)
    .single();
  return { data, error };
}

/**
 * 컬렉션 장소 행의 `step_label` 만 갱신.
 *
 * 빈 문자열·공백만 있는 입력은 `NULL` 로 정규화한다(서버 트리거에서도 한 번 더 정규화).
 * 길이 24자 초과 입력은 거부.
 *
 * @param {string} collectionId
 * @param {string} placeId
 * @param {string | null | undefined} stepLabel
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function updateCollectionPlaceStepLabel(
  collectionId,
  placeId,
  stepLabel,
) {
  const cid = assertUuid(collectionId, "updateCollectionPlaceStepLabel");
  const pid = assertUuid(placeId, "updateCollectionPlaceStepLabel");

  let normalized = null;
  if (stepLabel != null) {
    const t = String(stepLabel).trim();
    if (t.length > STEP_LABEL_MAX_LEN) {
      return {
        data: null,
        error: new Error(
          `updateCollectionPlaceStepLabel: step_label too long (max ${STEP_LABEL_MAX_LEN})`,
        ),
      };
    }
    normalized = t.length > 0 ? t : null;
  }

  const { data, error } = await supabase
    .from("collection_places")
    .update({ step_label: normalized })
    .eq("collection_id", cid)
    .eq("place_id", pid)
    .select(COLLECTION_PLACE_COLUMNS)
    .maybeSingle();
  return { data, error };
}

/**
 * 컬렉션에서 장소 제거.
 *
 * @param {string} collectionId
 * @param {string} placeId
 * @returns {Promise<{ data: { id: string } | null, error: Error | null }>}
 */
export async function removePlaceFromCollection(collectionId, placeId) {
  const cid = assertUuid(collectionId, "removePlaceFromCollection");
  const pid = assertUuid(placeId, "removePlaceFromCollection");
  const { data, error } = await supabase
    .from("collection_places")
    .delete()
    .eq("collection_id", cid)
    .eq("place_id", pid)
    .select("id")
    .maybeSingle();
  return { data, error };
}

/**
 * 컬렉션 내 장소 순서 재정렬. `orderedPlaceIds` 의 인덱스를 그대로 `order_index` 로 세팅.
 *
 * 모든 ID 가 이미 컬렉션에 들어 있는지 검증 후 `upsert` 한 번으로 처리(2 round-trips).
 * 하나라도 컬렉션에 없으면 변경 없이 에러를 반환한다(누락된 행이 새로 INSERT 되는 footgun 방지).
 *
 * @param {string} collectionId
 * @param {string[]} orderedPlaceIds
 * @returns {Promise<{ data: object[] | null, error: Error | null }>}
 */
export async function reorderCollectionPlaces(collectionId, orderedPlaceIds) {
  const cid = assertUuid(collectionId, "reorderCollectionPlaces");

  if (!Array.isArray(orderedPlaceIds)) {
    return {
      data: null,
      error: new Error(
        "reorderCollectionPlaces: orderedPlaceIds must be an array",
      ),
    };
  }

  const ids = [];
  for (const raw of orderedPlaceIds) {
    const id = String(raw ?? "").trim();
    if (!UUID_RE.test(id)) {
      return {
        data: null,
        error: new Error(
          `reorderCollectionPlaces: invalid place id: ${String(raw)}`,
        ),
      };
    }
    ids.push(id);
  }
  if (ids.length === 0) {
    return { data: [], error: null };
  }
  if (new Set(ids).size !== ids.length) {
    return {
      data: null,
      error: new Error("reorderCollectionPlaces: duplicate place ids"),
    };
  }

  const { data: existing, error: existErr } = await supabase
    .from("collection_places")
    .select("place_id")
    .eq("collection_id", cid)
    .in("place_id", ids);
  if (existErr) {
    return { data: null, error: existErr };
  }
  const existingSet = new Set(
    (existing || []).map((r) => String(r.place_id)),
  );
  const missing = ids.filter((id) => !existingSet.has(id));
  if (missing.length > 0) {
    return {
      data: null,
      error: new Error(
        `reorderCollectionPlaces: place(s) not in collection: ${missing.join(", ")}`,
      ),
    };
  }

  const rows = ids.map((pid, idx) => ({
    collection_id: cid,
    place_id: pid,
    order_index: idx,
  }));

  const { data, error } = await supabase
    .from("collection_places")
    .upsert(rows, { onConflict: "collection_id,place_id" })
    .select("id, place_id, order_index");
  return { data, error };
}

// ---------------------------------------------------------------------------
// 컬렉션 커버 fallback (auto cover)
// ---------------------------------------------------------------------------

const _autoCoverPromiseByCollectionId = new Map();

function isLikelyImageUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/api/")) return s;
  return "";
}

function pickPlaceCoverUrl(place) {
  if (!place || typeof place !== "object") return "";
  const candidates = [
    place.image_url,
    place.thumbnail_url,
    place.photo_url,
    place.image,
    place.thumbnail,
    place.photo,
    place.picture,
    place.cover_image_url,
    place.coverImageUrl,
  ];
  for (const c of candidates) {
    const url = isLikelyImageUrl(c);
    if (url) return url;
  }
  return "";
}

function pickPlaceSocialScore(place) {
  if (!place || typeof place !== "object") return 0;
  const saves = Number(place.save_count ?? place.saveCount ?? place.saves_count ?? 0) || 0;
  const likes = Number(place.like_count ?? place.likeCount ?? place.likes_count ?? 0) || 0;
  // "저장/좋아요가 많은 장소"를 우선. 저장은 신호가 강하다고 가정해 가중치 2x.
  return Math.max(0, saves) * 2 + Math.max(0, likes);
}

/**
 * `collections.cover_image_url` 이 비어 있을 때 사용하는 자동 대표 커버 후보.
 *
 * 정책(최소 구현):
 *  - collection_places 중 이미지가 있는 place 를 찾는다.
 *  - place 에 save/like 카운트가 존재하면(스키마에 따라 optional) 가장 높은 장소를 우선.
 *  - 카운트가 없거나 전부 0 이면 "첫 장소 이미지"(order_index 오름차순) 를 사용한다.
 *
 * @param {string} collectionId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<string | null>}
 */
export async function fetchCollectionAutoCoverImageUrl(
  collectionId,
  { limit = 36 } = {},
) {
  const cid = assertUuid(collectionId, "fetchCollectionAutoCoverImageUrl");
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 36), 1), 80);

  const cached = _autoCoverPromiseByCollectionId.get(cid);
  if (cached) return await cached;

  const p = (async () => {
    const { data, error } = await supabase
      .from("collection_places")
      .select(
        `
        order_index,
        places!collection_places_place_id_fkey (*)
      `,
      )
      .eq("collection_id", cid)
      .order("order_index", { ascending: true })
      .limit(lim);

    if (error) {
      // 커버 fallback 은 best-effort: 실패해도 UI 는 기존 gradient 로 내려간다.
      if (import.meta?.env?.DEV) {
        console.warn("fetchCollectionAutoCoverImageUrl:", error?.message || error);
      }
      return null;
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return null;

    let firstUrl = "";
    let bestUrl = "";
    let bestScore = 0;
    let bestOrder = Number.POSITIVE_INFINITY;

    for (const r of rows) {
      const orderIndex = Number.isFinite(r?.order_index) ? r.order_index : 0;
      const place = r?.places || null;
      const url = pickPlaceCoverUrl(place);
      if (!url) continue;

      if (!firstUrl) firstUrl = url;

      const score = pickPlaceSocialScore(place);
      if (
        score > bestScore ||
        (score === bestScore && score > 0 && orderIndex < bestOrder)
      ) {
        bestScore = score;
        bestUrl = url;
        bestOrder = orderIndex;
      }
    }

    if (bestScore > 0 && bestUrl) return bestUrl;
    return firstUrl || null;
  })();

  _autoCoverPromiseByCollectionId.set(cid, p);
  try {
    return await p;
  } finally {
    // 성공/실패 모두 캐시를 유지해 과도한 재호출을 막는다.
    // cover 변경이 필요하면 호출자가 full reload/새 key 를 쓴다.
  }
}
