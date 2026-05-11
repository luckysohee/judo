/**
 * 공통 pick(팔로우) 관계 — `public.user_profile_follows`
 * - follower_id / following_id 는 모두 auth.users.id
 * - DB RPC: follow_user, unfollow_user, is_following_user, user_follow_counts, mutual_follow_with
 *
 * 제품 용어「pick / picked」는 이 모듈의 pick* 이름과 대응한다.
 */

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} followingUserId auth.users id (pick 대상)
 */
export async function followUser(client, followingUserId) {
  const { error } = await client.rpc("follow_user", {
    p_following_id: followingUserId,
  });
  if (error) throw error;
  // first session activation: 첫 픽(팔로우)로 activation 완료
  try {
    const { readActivationState, markActivationEvent, completeActivation } = await import(
      "./activationState"
    );
    const { ACTIVATION_EVENT, logActivationFunnelEvent } = await import(
      "../api/activationFunnelLogs"
    );
    const before = readActivationState();
    const hadFirst = Boolean(before?.events?.first_follow_curator);
    if (!hadFirst) {
      markActivationEvent("first_follow_curator");
      completeActivation("follow");
      logActivationFunnelEvent({
        eventName: ACTIVATION_EVENT.FIRST_FOLLOW_CURATOR,
        experimentBucket: null,
        activationCtaBucket: null,
        appEnv: import.meta.env.MODE,
        source: "follow_user",
      });
      logActivationFunnelEvent({
        eventName: ACTIVATION_EVENT.ACTIVATION_COMPLETED,
        completedBy: "follow",
        experimentBucket: null,
        activationCtaBucket: null,
        appEnv: import.meta.env.MODE,
        source: "activation_completed",
      });
    } else {
      logActivationFunnelEvent({
        eventName: ACTIVATION_EVENT.SECOND_FOLLOW,
        experimentBucket: null,
        activationCtaBucket: null,
        appEnv: import.meta.env.MODE,
        source: "second_follow",
      });
    }
  } catch {
    /* activation best-effort */
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} followingUserId auth.users id
 */
export async function unfollowUser(client, followingUserId) {
  const { error } = await client.rpc("unfollow_user", {
    p_following_id: followingUserId,
  });
  if (error) throw error;
}

/** 제품 카피「pick」와 동일 의미 */
export const followPick = followUser;

export const unfollowPick = unfollowUser;

/**
 * `curators.id`(PK)만 알 때 — 대상의 auth uid로 pick
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} curatorRowId public.curators.id
 */
export async function followPickByCuratorRowId(client, curatorRowId) {
  const { data: row, error: qErr } = await client
    .from("curators")
    .select("user_id")
    .eq("id", curatorRowId)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row?.user_id) throw new Error("curator row not found");
  return followUser(client, row.user_id);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} curatorRowId public.curators.id
 */
export async function unfollowPickByCuratorRowId(client, curatorRowId) {
  const { data: row, error: qErr } = await client
    .from("curators")
    .select("user_id")
    .eq("id", curatorRowId)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row?.user_id) throw new Error("curator row not found");
  return unfollowUser(client, row.user_id);
}

/**
 * 내가 pick 중인 계정 중 **큐레이터 행이 있는** 경우의 `curators.id`(PK) 목록.
 * (홈 큐레이터 카드 하이라이트 등 레거시 UI용 — 전체 pick 목록은 아님.)
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} userId auth uid (viewer)
 * @returns {Promise<string[]>}
 */
export async function fetchFollowingCuratorRowIds(client, userId) {
  if (!userId) return [];

  const { data: follows, error: fErr } = await client
    .from("user_profile_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (fErr) throw fErr;
  const followingIds = (follows || [])
    .map((r) => r.following_id)
    .filter(Boolean);
  if (!followingIds.length) return [];

  const { data: curators, error: cErr } = await client
    .from("curators")
    .select("id")
    .in("user_id", followingIds);

  if (cErr) throw cErr;
  return (curators || []).map((c) => c.id).filter(Boolean);
}

/**
 * 현재 Supabase 세션(`auth.uid`)이 `targetUserId`를 pick 중인지.
 * (뷰어 id는 인자로 받지 않으며, 항상 로그인 사용자 기준.)
 *
 * @see isPickingUser — 동일 함수의 제품 명칭 별칭
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} targetUserId 픽 대상 프로필의 auth.users.id (`profileUserId`)
 */
export async function isFollowingUser(client, targetUserId) {
  const { data, error } = await client.rpc("is_following_user", {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
  return Boolean(data);
}

export const isPickingUser = isFollowingUser;

/**
 * 해당 `userId`(프로필 주인)의 pick 수 · 받은 수.
 * 로그인 무관하게 조회 가능(프로젝트에서 RPC에 anon grant).
 *
 * @returns {Promise<{ followers_count: number, following_count: number }>}
 * `followers_count` = 받은 픽, `following_count` = 내 픽 (이 유저 기준 나간 관계 수)
 */
export async function getUserFollowCounts(client, userId) {
  const { data, error } = await client.rpc("user_follow_counts", {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    followers_count: Number(row?.followers_count) || 0,
    following_count: Number(row?.following_count) || 0,
  };
}

/** Pick 카운트 UI용 별칭 */
export const getPickCounts = getUserFollowCounts;

/**
 * 세션 사용자와 `otherUserId`가 서로 pick(맞픽)했는지.
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} otherUserId 상대 프로필 auth.users.id
 */
export async function mutualFollowWith(client, otherUserId) {
  const { data, error } = await client.rpc("mutual_follow_with", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  return Boolean(data);
}

/** 맞픽(맞팔) 표시용 */
export const mutualPickWith = mutualFollowWith;
