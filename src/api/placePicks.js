import { supabase } from "./client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(placeId, label) {
  const id = String(placeId ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    throw new Error(`${label}: invalid place id`);
  }
  return id;
}

function assertUserUuid(userId, label) {
  const id = String(userId ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    throw new Error(`${label}: invalid user id`);
  }
  return id;
}

/**
 * 공개 픽 추가. `place_picks` UNIQUE(user_id, place_id) 위반 시 Postgres 23505.
 * `is_curator` 는 DB 트리거가 `curators` 존재 여부로 덮어씀.
 *
 * @param {string} placeId — `places.id` (UUID)
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function pickPlace(placeId) {
  const pid = assertUuid(placeId, "pickPlace");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    return { data: null, error: new Error("pickPlace: not authenticated") };
  }
  const { data, error } = await supabase
    .from("place_picks")
    .insert({ user_id: user.id, place_id: pid })
    .select("id, user_id, place_id, is_curator, created_at, updated_at")
    .single();
  return { data, error };
}

/**
 * 공개 픽 취소.
 *
 * @param {string} placeId
 * @returns {Promise<{ data: object | null, error: Error | null }>} — `data` 는 삭제된 행(없으면 null)
 */
export async function unpickPlace(placeId) {
  const pid = assertUuid(placeId, "unpickPlace");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    return { data: null, error: new Error("unpickPlace: not authenticated") };
  }
  const { data, error } = await supabase
    .from("place_picks")
    .delete()
    .eq("place_id", pid)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  return { data, error };
}

/**
 * 로그인 사용자 기준, 해당 장소를 픽했는지.
 *
 * @param {string} placeId
 * @returns {Promise<{ picked: boolean, pick: object | null }>}
 */
export async function fetchPickState(placeId) {
  const pid = assertUuid(placeId, "fetchPickState");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { picked: false, pick: null };
  }
  const { data, error } = await supabase
    .from("place_picks")
    .select("id, user_id, place_id, is_curator, created_at, updated_at")
    .eq("place_id", pid)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || "fetchPickState failed");
  }
  return { picked: Boolean(data), pick: data };
}

/**
 * 최근 픽한 유저 최대 5명 (2단계 UI 아바타 스택). RPC `get_place_recent_pickers`.
 *
 * @param {string} placeId
 * @returns {Promise<{ user_id: string, created_at: string }[]>}
 */
export async function fetchPlaceRecentPickers(placeId) {
  const pid = assertUuid(placeId, "fetchPlaceRecentPickers");
  const { data, error } = await supabase.rpc("get_place_recent_pickers", {
    p_place_id: pid,
  });
  if (error) {
    throw new Error(error.message || "fetchPlaceRecentPickers failed");
  }
  return Array.isArray(data) ? data : [];
}

/**
 * 장소별 픽 집계 (비로그인 가능). RPC `get_place_pick_summary`.
 * 최근 픽 유저 아바타는 `fetchPlaceRecentPickers` 별도 호출.
 *
 * @param {string} placeId
 * @returns {Promise<{ total_count: number, curator_pick_count: number, user_pick_count: number }>}
 */
export async function fetchPickSummary(placeId) {
  const pid = assertUuid(placeId, "fetchPickSummary");
  const { data, error } = await supabase.rpc("get_place_pick_summary", {
    p_place_id: pid,
  });
  if (error) {
    throw new Error(error.message || "fetchPickSummary failed");
  }
  const row = data && typeof data === "object" ? data : {};
  return {
    total_count: Number(row.total_count) || 0,
    curator_pick_count: Number(row.curator_pick_count) || 0,
    user_pick_count: Number(row.user_pick_count) || 0,
  };
}

/**
 * 특정 사용자의 공개 픽 목록 (`places` 조인). RLS `place_picks_select_public`.
 * 저장 폴더·`user_saved_places` 와 섞지 않음.
 *
 * @param {string} userId — `auth.users.id` / `profiles.id`
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchUserPickedPlaces(userId, opts = {}) {
  const uid = assertUserUuid(userId, "fetchUserPickedPlaces");
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(500, Math.floor(opts.limit))
      : 200;
  const { data, error } = await supabase
    .from("place_picks")
    .select(
      `
      id,
      user_id,
      place_id,
      is_curator,
      created_at,
      updated_at,
      places!place_picks_place_id_fkey (*)
    `
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message || "fetchUserPickedPlaces failed");
  }
  return Array.isArray(data) ? data : [];
}

/**
 * 내가 픽한 장소 목록 (`places` 조인).
 * `userId === auth.uid()` 검증 유지 — 본인 세션 전용.
 *
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>} — `place_picks` 행 + `places` FK 조인 (키: `places`)
 */
export async function fetchMyPickedPlaces(userId, opts = {}) {
  const uid = assertUserUuid(userId, "fetchMyPickedPlaces");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id || user.id !== uid) {
    throw new Error(
      "fetchMyPickedPlaces: userId must match the signed-in user"
    );
  }
  return fetchUserPickedPlaces(uid, opts);
}
