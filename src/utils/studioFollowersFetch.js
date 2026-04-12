import { formatAuthProviderForUi } from "../lib/syncAuthProviderToProfile";

function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "");
}

function labelFromNickHandle(nickRaw, handleRaw, authProvider) {
  const nick = String(nickRaw || "").trim();
  const handle = normalizeHandle(handleRaw);
  let label = "이름 미설정";
  if (nick && handle) label = `${nick} (@${handle})`;
  else if (nick) label = nick;
  else if (handle) label = `@${handle}`;
  else if (authProvider) {
    const ui = formatAuthProviderForUi(authProvider);
    label = `${ui.replace(/ 로그인$/, "")} 팔로워`;
  }
  return label;
}

/** UI 2줄용: 1줄 닉(또는 단일 라벨) + 2줄 @핸들 (토스트·title은 label 유지) */
function followerDisplayLines(nickRaw, handleRaw, authProvider) {
  const nick = String(nickRaw || "").trim();
  const handle = normalizeHandle(handleRaw);
  const label = labelFromNickHandle(nick, handle, authProvider);
  if (nick && handle) {
    return { primaryText: nick, secondaryText: `@${handle}`, label };
  }
  if (nick) {
    return { primaryText: nick, secondaryText: null, label };
  }
  if (handle) {
    return { primaryText: `@${handle}`, secondaryText: null, label };
  }
  return { primaryText: label, secondaryText: null, label };
}

/**
 * 팔로워 한 명 표시: 큐레이터 행이 있으면 스튜디오 공개명·핸들 우선 (profiles OAuth 본명 혼선 방지)
 * username이 비어 있으면 profiles.username 순으로 @핸들 보강 (slug는 DB에 없을 수 있어 REST 조회에서는 제외)
 * @param {object|null|undefined} profile — profiles 행
 * @param {object|null|undefined} curatorRow — curators 행 (user_id 기준)
 */
export function resolveFollowerPresentation(profile, curatorRow) {
  const p = profile && typeof profile === "object" ? profile : {};
  const c =
    curatorRow && typeof curatorRow === "object" ? curatorRow : null;

  const nick = String(
    c?.display_name || c?.name || p.display_name || ""
  ).trim();
  const handle = normalizeHandle(
    c?.username || c?.slug || p?.username || ""
  );

  const lines = followerDisplayLines(nick, handle, p.auth_provider);

  const avatarUrl =
    String(
      c?.avatar_url || c?.avatar || c?.image || p.avatar_url || ""
    ).trim() || null;

  return {
    ...lines,
    avatarUrl,
    isCurator: Boolean(c),
    curatorGrade: c?.grade || null,
  };
}

/**
 * DB RPC studio_follower_previews — curators RLS와 무관하게 팔로워 조인
 */
async function fetchStudioFollowersViaRpc(supabase, curatorId) {
  const { data, error } = await supabase.rpc("studio_follower_previews", {
    p_curator_id: curatorId,
  });
  if (error) return { error, rows: null };
  const raw = Array.isArray(data) ? data : [];
  const rows = raw.map((row) => {
    const lines = followerDisplayLines(
      row.display_nick,
      row.handle_raw,
      null
    );
    return {
      user_id: row.user_id,
      created_at: row.created_at,
      ...lines,
      avatarUrl: row.avatar_url || null,
      isCurator: Boolean(row.is_curator),
      curatorGrade: row.curator_grade || null,
    };
  });
  return { error: null, rows };
}

/** REST만 (RPC 실패·미배포 시). curators.select에 slug 넣지 않음 — 컬럼 없으면 전체 쿼리 400 */
async function fetchStudioFollowersEnrichedRest(supabase, curatorId) {
  const { data: rows, error } = await supabase
    .from("user_follows")
    .select("user_id, created_at")
    .eq("curator_id", curatorId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  if (!rows?.length) return [];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: profs, error: pErr }, { data: curs, error: cErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username, auth_provider, avatar_url")
        .in("id", ids),
      supabase
        .from("curators")
        .select(
          "user_id, display_name, username, name, avatar_url, avatar, image, grade"
        )
        .in("user_id", ids),
    ]);

  if (pErr) {
    console.warn("팔로워 프로필 로드:", pErr.message);
  }
  if (cErr) {
    console.warn("팔로워 큐레이터 로드:", cErr.message);
  }

  const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  const byCuratorUserId = Object.fromEntries(
    (curs || []).map((c) => [c.user_id, c])
  );

  return rows.map((r) => {
    const pres = resolveFollowerPresentation(
      byId[r.user_id],
      byCuratorUserId[r.user_id]
    );
    return {
      user_id: r.user_id,
      created_at: r.created_at,
      ...pres,
    };
  });
}

/**
 * 스튜디오 팔로워 목록: RPC 우선, 실패 시 REST
 */
export async function fetchStudioFollowersEnriched(supabase, curatorId) {
  if (!curatorId) return [];

  const { error: rpcErr, rows } = await fetchStudioFollowersViaRpc(
    supabase,
    curatorId
  );
  if (!rpcErr && rows) {
    return rows;
  }
  if (rpcErr) {
    console.warn(
      "studio_follower_previews RPC 사용 불가 — REST로 폴백:",
      rpcErr.message
    );
  }
  return fetchStudioFollowersEnrichedRest(supabase, curatorId);
}
