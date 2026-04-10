import { formatAuthProviderForUi } from "../lib/syncAuthProviderToProfile";

/**
 * 스튜디오 팔로워 목록: user_follows + profiles 라벨 (최신순, 최대 200)
 */
export async function fetchStudioFollowersEnriched(supabase, curatorId) {
  if (!curatorId) return [];

  const { data: rows, error } = await supabase
    .from("user_follows")
    .select("user_id, created_at")
    .eq("curator_id", curatorId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  if (!rows?.length) return [];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, username, auth_provider, avatar_url")
    .in("id", ids);

  if (pErr) {
    console.warn("팔로워 프로필 로드:", pErr.message);
  }

  const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId[r.user_id];
    const nick = (p?.display_name || "").trim();
    const handle = (p?.username || "").trim();
    let label = "이름 미설정";
    if (nick && handle) label = `${nick} (@${handle})`;
    else if (nick) label = nick;
    else if (handle) label = `@${handle}`;
    else if (p?.auth_provider) {
      const ui = formatAuthProviderForUi(p.auth_provider);
      label = `${ui.replace(/ 로그인$/, "")} 팔로워`;
    }
    const avatarUrl = (p?.avatar_url || "").trim() || null;
    return {
      user_id: r.user_id,
      created_at: r.created_at,
      label,
      avatarUrl,
    };
  });
}
