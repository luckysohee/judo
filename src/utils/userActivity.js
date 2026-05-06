/**
 * 제품 활동 로그 계열 클라이언트 (예: 맞픽 유저 최근 한잔).
 * @see get_mutual_checkins RPC
 */

/**
 * 세션 사용자 기준 맞픽 관계 사용자들의 최근 체크인 로그 행 목록.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ user_id: string, place_id: string | null, raw_place_name: string, raw_address: string | null, created_at: string }>>}
 */
export async function fetchMutualCheckins(supabase, opts = {}) {
  const rawLimit =
    opts?.limit != null && Number.isFinite(Number(opts.limit))
      ? Math.floor(Number(opts.limit))
      : 24;

  const capped = Math.min(Math.max(rawLimit, 1), 30);

  const { data, error } = await supabase.rpc("get_mutual_checkins", {
    limit_count: capped,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((r) => {
      const pid = r?.place_id != null ? String(r.place_id).trim() : "";
      return {
        user_id: String(r?.user_id ?? "").trim(),
        place_id: pid || null,
        raw_place_name: String(r?.raw_place_name ?? "").trim(),
        raw_address: r?.raw_address != null ? String(r.raw_address).trim() : null,
        created_at: String(r?.created_at ?? ""),
      };
    })
    .filter((r) => r.user_id);
}
