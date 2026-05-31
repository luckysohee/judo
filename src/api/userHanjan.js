import { supabase } from "./client";

/**
 * 프로필「한잔함」·라이브성 피드용 `check_ins` 조회.
 *
 * 제품 정책(초기): 한잔함은 공개가 맞다. “지금 어디서 한잔했는지”가 주도앱의 살아 있는
 * 인상에 필요하므로, 프로필·타인 조회에서도 한잔 기록을 보여 준다.
 *
 * 향후 옵션(미구현): 유저 단위로 (1) 공개 / 비공개, 또는 (2) 프로필에만 공개 /
 * 전체 피드 공개 같은 세분화를 둘 수 있다. 그때는 컬럼·RLS·RPC로 노출 범위를
 * 분리하고, 이 모듈의 쿼리도 visibility 에 맞게 좁히면 된다.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUserUuid(userId, label) {
  const s = typeof userId === "string" ? userId.trim() : "";
  if (!s || !UUID_RE.test(s)) {
    throw new Error(`${label}: invalid user id`);
  }
  return s;
}

/**
 * 특정 사용자의 한잔 기록 (`check_ins`, `user_id` 기준, 최신순).
 * 초기 정책: 공개 조회(비로그인·타인 포함) 전제 — DB RLS·스키마와 일치해야 함.
 *
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchUserHanjanHistory(userId, opts = {}) {
  const uid = assertUserUuid(userId, "fetchUserHanjanHistory");
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(200, Math.floor(opts.limit))
      : 80;
  const { data, error } = await supabase
    .from("check_ins")
    .select(
      "id, user_id, place_id, place_name, place_address, created_at, user_nickname"
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message || "fetchUserHanjanHistory failed");
  }
  return Array.isArray(data) ? data : [];
}
