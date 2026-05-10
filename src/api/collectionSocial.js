import { supabase } from "./client";

/**
 * 컬렉션 좋아요(`collection_likes`) / 저장(`collection_saves`) 클라이언트 헬퍼.
 *
 * 권한은 모두 DB RLS 가 처리한다.
 *  - SELECT: 공개 컬렉션의 행은 anon 에게도 보이고, 비공개여도 본인 행은 보임.
 *  - INSERT/DELETE: `auth.uid() = user_id` 본인만.
 *  - UPDATE 정책 없음 → 토글은 INSERT/DELETE 로만 동작.
 *
 * 호출 스타일은 `src/api/placePicks.js`, `src/api/collections.js` 와 동일.
 *  - 조회 함수(`fetch*`): 에러 시 `throw`, 성공 시 데이터 직접 반환.
 *  - 변경 함수(`like*`, `unlike*`, `save*`, `unsave*`): `{ data, error }` 객체 반환.
 *
 * `collections`, `collection_places`, `curator_places` 등은 전혀 손대지 않는다.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIKES_ROW_COLS = "id, collection_id, user_id, created_at";
const SAVES_ROW_COLS = "id, collection_id, user_id, created_at";

function assertUuid(value, label) {
  const id = String(value ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    throw new Error(`${label}: invalid uuid`);
  }
  return id;
}

/**
 * 비로그인 시 `null`. 호출 실패도 비로그인으로 간주.
 *
 * @returns {Promise<string | null>}
 */
async function getMyUidOrNull() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.id) return null;
    return user.id;
  } catch {
    return null;
  }
}

async function requireMyUid(label) {
  const uid = await getMyUidOrNull();
  if (!uid) throw new Error(`${label}: not authenticated`);
  return uid;
}

/**
 * `collection_likes` / `collection_saves` 의 임베디드 `(count)` 결과를
 * `[{ count: N }]` 모양에서 숫자로 평탄화.
 *
 * @param {unknown} embedded
 * @returns {number}
 */
function unwrapEmbeddedCount(embedded) {
  if (!Array.isArray(embedded) || embedded.length === 0) return 0;
  const n = Number(embedded[0]?.count);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// 조회 (throw on error)
// ---------------------------------------------------------------------------

/**
 * 컬렉션의 좋아요/저장 사회적 상태를 한 번에 가져온다.
 *
 * - count 는 `collections` 한 번 SELECT 에 `collection_likes(count)` /
 *   `collection_saves(count)` 를 임베디드로 묶어 1 round-trip 으로 받는다(N+1 방지).
 * - 비로그인이면 `liked_by_me` / `saved_by_me` 는 항상 `false` 이고,
 *   본인 행 조회는 아예 발사하지 않는다(불필요한 RTT 절감).
 * - 로그인 상태이면 본인의 like/save 행 존재 여부를 `Promise.all` 로 병렬 조회.
 * - 비공개 컬렉션 + 비소유자처럼 RLS 가 컬렉션을 가리는 경우엔
 *   카운트도 0 으로 떨어진다(타인은 그 행 자체를 볼 수 없음).
 *
 * @param {string} collectionId
 * @returns {Promise<{
 *   collection_id: string,
 *   like_count: number,
 *   save_count: number,
 *   liked_by_me: boolean,
 *   saved_by_me: boolean,
 * }>}
 */
export async function fetchCollectionSocialState(collectionId) {
  const cid = assertUuid(collectionId, "fetchCollectionSocialState");
  const myUid = await getMyUidOrNull();

  const countsPromise = supabase
    .from("collections")
    .select(
      `
      id,
      likes_agg:collection_likes(count),
      saves_agg:collection_saves(count)
    `,
    )
    .eq("id", cid)
    .maybeSingle();

  const myLikePromise = myUid
    ? supabase
        .from("collection_likes")
        .select("id")
        .eq("collection_id", cid)
        .eq("user_id", myUid)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const mySavePromise = myUid
    ? supabase
        .from("collection_saves")
        .select("id")
        .eq("collection_id", cid)
        .eq("user_id", myUid)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [countsRes, likeRes, saveRes] = await Promise.all([
    countsPromise,
    myLikePromise,
    mySavePromise,
  ]);

  const firstError =
    countsRes.error || likeRes.error || saveRes.error || null;
  if (firstError) {
    throw new Error(
      firstError.message || "fetchCollectionSocialState failed",
    );
  }

  const row = countsRes.data || null;
  const like_count = row ? unwrapEmbeddedCount(row.likes_agg) : 0;
  const save_count = row ? unwrapEmbeddedCount(row.saves_agg) : 0;

  return {
    collection_id: cid,
    like_count,
    save_count,
    liked_by_me: Boolean(myUid && likeRes.data),
    saved_by_me: Boolean(myUid && saveRes.data),
  };
}

// ---------------------------------------------------------------------------
// 변경 ({ data, error } 반환)
// ---------------------------------------------------------------------------

/**
 * 공통 토글 ON 구현. UNIQUE 위반(23505) 은 "이미 켜져 있음" 으로 보고
 * 기존 행을 다시 SELECT 해 멱등성 있게 같은 모양으로 반환한다.
 *
 * @param {"collection_likes" | "collection_saves"} table
 * @param {string} cid
 * @param {string} uid
 * @param {string} cols
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
async function insertReactionRow(table, cid, uid, cols) {
  const { data, error } = await supabase
    .from(table)
    .insert({ collection_id: cid, user_id: uid })
    .select(cols)
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: refetchErr } = await supabase
      .from(table)
      .select(cols)
      .eq("collection_id", cid)
      .eq("user_id", uid)
      .maybeSingle();
    if (refetchErr) {
      return { data: null, error: refetchErr };
    }
    return { data: existing ?? null, error: null };
  }

  return { data, error };
}

/**
 * 컬렉션 좋아요(켜기). 이미 좋아요 상태면 기존 행을 반환(에러 아님).
 *
 * @param {string} collectionId
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function likeCollection(collectionId) {
  let cid;
  try {
    cid = assertUuid(collectionId, "likeCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  let uid;
  try {
    uid = await requireMyUid("likeCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  return insertReactionRow("collection_likes", cid, uid, LIKES_ROW_COLS);
}

/**
 * 컬렉션 좋아요 해제.
 *
 * @param {string} collectionId
 * @returns {Promise<{ data: { id: string } | null, error: Error | null }>}
 */
export async function unlikeCollection(collectionId) {
  let cid;
  try {
    cid = assertUuid(collectionId, "unlikeCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  let uid;
  try {
    uid = await requireMyUid("unlikeCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  const { data, error } = await supabase
    .from("collection_likes")
    .delete()
    .eq("collection_id", cid)
    .eq("user_id", uid)
    .select("id")
    .maybeSingle();
  return { data, error };
}

/**
 * 컬렉션 저장(내 라이브러리에 보관). 이미 저장돼 있으면 기존 행을 반환.
 *
 * @param {string} collectionId
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function saveCollection(collectionId) {
  let cid;
  try {
    cid = assertUuid(collectionId, "saveCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  let uid;
  try {
    uid = await requireMyUid("saveCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  return insertReactionRow("collection_saves", cid, uid, SAVES_ROW_COLS);
}

/**
 * 컬렉션 저장 해제.
 *
 * @param {string} collectionId
 * @returns {Promise<{ data: { id: string } | null, error: Error | null }>}
 */
export async function unsaveCollection(collectionId) {
  let cid;
  try {
    cid = assertUuid(collectionId, "unsaveCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  let uid;
  try {
    uid = await requireMyUid("unsaveCollection");
  } catch (err) {
    return { data: null, error: err };
  }
  const { data, error } = await supabase
    .from("collection_saves")
    .delete()
    .eq("collection_id", cid)
    .eq("user_id", uid)
    .select("id")
    .maybeSingle();
  return { data, error };
}
