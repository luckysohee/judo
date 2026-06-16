/**
 * `/curator-profile/:key` 라우트 키 → curators 행 조회.
 * slug 우선, 없으면 username·별명·user_id 순으로 매칭.
 */
export async function fetchCuratorRowByRouteKey(supabase, routeKey) {
  const k = String(routeKey ?? "").trim();
  if (!k || !supabase) return null;

  const tryEq = async (column) => {
    const { data, error } = await supabase
      .from("curators")
      .select("*")
      .eq(column, k)
      .maybeSingle();
    if (error) {
      console.warn(`fetchCuratorRowByRouteKey ${column}:`, error.message);
      return null;
    }
    return data ?? null;
  };

  for (const column of ["slug", "username", "display_name", "name"]) {
    const row = await tryEq(column);
    if (row) return row;
  }

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      k
    )
  ) {
    const row = await tryEq("user_id");
    if (row) return row;
  }

  return null;
}

/** curators 행 또는 카탈로그 행 → 프로필 URL용 slug(@핸들) */
export function curatorRowProfileSlug(row) {
  if (!row) return null;
  const slug = String(row.slug ?? row.username ?? "").trim();
  return slug || null;
}
