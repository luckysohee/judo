/**
 * =============================================================================
 * curator_places 전용 정체성 (이 파일이 유일한 기준)
 * =============================================================================
 *
 * 단일 규칙 (Supabase 스키마와 동일):
 *   `curator_places.curator_id`  ←  **`curators.user_id`** (같은 UUID)
 *   `public.curator_places.curator_id` === `public.curators.user_id` === `auth.users.id`
 *
 * **`curators.id`(PK)는 `curator_places.curator_id`에 넣지 않는다.** (팔로우 등 다른 테이블과 혼동 주의)
 * INSERT / `.eq("curator_id", …)` / RLS 비교는 항상 **로그인 사용자 UUID(auth uid)** 를 쓴다.
 *
 * 다른 테이블은 이름이 같아도 의미가 다를 수 있다. 예:
 * - `user_follows.curator_id` → 보통 `curators.id`(PK) 를 가리키는 경우가 많음 (팔로우 스키마는 별도).
 * - 이 헬퍼들은 **curator_places 한정**이다.
 *
 * DB 마이그레이션: `curator_places` FK → `curators(user_id)` 정렬됨.
 */

/**
 * curator_places 에 넣거나 필터할 때 쓰는 값 (항상 auth uid).
 * @param {string | null | undefined} authUserId `auth.getUser().user.id`
 * @returns {string}
 */
export function curatorPlacesCuratorId(authUserId) {
  const s = String(authUserId ?? "").trim();
  if (!s) {
    throw new Error(
      "curator_places: curator_id 는 curators.user_id(= auth uid) 여야 합니다. 로그인 상태를 확인하세요."
    );
  }
  return s;
}

/**
 * 선택: uid 없이 조용히 실패할 때
 * @returns {string|null}
 */
export function tryCuratorPlacesCuratorId(authUserId) {
  const s = String(authUserId ?? "").trim();
  return s || null;
}

/**
 * `curator_places` 행이 로그인 큐레이터 본인 것인지 (curator_id === auth uid).
 */
export function curatorPlaceMatchesLoggedInCurator(cp, curatorProfile, userId) {
  const cid = String(cp?.curator_id ?? "").trim();
  if (!cid) return false;

  const authUid = String(userId ?? "").trim();
  const rowUserId = String(
    curatorProfile?.user_id ?? curatorProfile?.userId ?? ""
  ).trim();

  if (authUid && cid === authUid) return true;
  if (rowUserId && cid === rowUserId) return true;
  return false;
}
