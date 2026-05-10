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
  "id, user_id, title, description, visibility, created_at, updated_at";

/**
 * 카드 그리드용 — 컬렉션 컬럼 + `collection_places` 행 수.
 * PostgREST 가 `collection_places: [{ count: N }]` 모양으로 반환하므로 `unwrapPlaceCount` 로 평탄화.
 */
const COLLECTION_LIST_SELECT = `${COLLECTION_COLUMNS}, collection_places(count)`;

const COLLECTION_PLACE_COLUMNS =
  "id, collection_id, place_id, order_index, memo, created_at";

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

// ---------------------------------------------------------------------------
// 변경 ({ data, error } 반환)
// ---------------------------------------------------------------------------

/**
 * 새 컬렉션 생성. `user_id` 는 `auth.uid()` 로 강제 세팅(RLS WITH CHECK).
 *
 * @param {{ title: string, description?: string | null, visibility?: 'public'|'private' }} input
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function createCollection({
  title,
  description = null,
  visibility = "public",
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

  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: uid,
      title: t,
      description: trimText(description),
      visibility,
    })
    .select(COLLECTION_COLUMNS)
    .single();
  return { data, error };
}

/**
 * 컬렉션 메타 수정. `title` / `description` / `visibility` 만 화이트리스트.
 * 본인 행이 아니면 RLS 가 0행을 반환 → `data === null`, `error === null`.
 *
 * @param {string} collectionId
 * @param {{ title?: string, description?: string | null, visibility?: 'public'|'private' }} patch
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
