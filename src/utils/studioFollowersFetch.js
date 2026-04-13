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

const CURATOR_FOLLOWING_FIELDS =
  "id, user_id, display_name, username, name, avatar_url, avatar, image, grade";

function normUuidishKey(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return s.toLowerCase();
  }
  return s;
}

function looksLikeUuid(s) {
  const t = String(s || "").trim();
  return (
    t.includes("-") &&
    /^[0-9a-f-]{36}$/i.test(t)
  );
}

/**
 * curators 행을 id · user_id · username · slug 로 역인덱싱 (팔로우 키 혼재 대응)
 */
function indexCuratorsForFollowingLookup(rows) {
  const byId = new Map();
  const byUserId = new Map();
  const byUsername = new Map();
  const bySlug = new Map();

  for (const c of rows || []) {
    if (!c) continue;
    const idK = normUuidishKey(c.id);
    const uidK = normUuidishKey(c.user_id);
    if (idK) byId.set(idK, c);
    if (uidK) byUserId.set(uidK, c);
    const u = String(c.username || "").trim();
    if (u) {
      byUsername.set(u, c);
      byUsername.set(u.toLowerCase(), c);
    }
    const sl = String(c.slug || "").trim();
    if (sl) {
      bySlug.set(sl, c);
      bySlug.set(sl.toLowerCase(), c);
    }
  }

  return { byId, byUserId, byUsername, bySlug };
}

function resolveCuratorForFollowingId(raw, maps) {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) return null;

  if (looksLikeUuid(s)) {
    const k = normUuidishKey(s);
    return maps.byId.get(k) || maps.byUserId.get(k) || null;
  }

  return (
    maps.byUsername.get(s) ||
    maps.byUsername.get(s.toLowerCase()) ||
    maps.bySlug.get(s) ||
    maps.bySlug.get(s.toLowerCase()) ||
    null
  );
}

/** RPC·REST 공통 lookup 키 (studio_following_previews.curator_id_raw 와 맞춤) */
function followingMergeKey(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (looksLikeUuid(s)) return normUuidishKey(s);
  return s.toLowerCase();
}

function mapFollowingRpcRow(row, createdAt) {
  const lines = followerDisplayLines(row.display_nick, row.handle_raw, null);
  const avatarUrl = String(row.avatar_url || "").trim() || null;
  const hasCurator = Boolean(row.curator_user_id);
  return {
    user_id: row.curator_user_id ?? row.curator_id_raw,
    curator_id: row.curator_id_raw,
    created_at: createdAt,
    ...lines,
    avatarUrl,
    isCurator: hasCurator,
    curatorGrade: row.curator_grade || null,
  };
}

function fallbackFollowingEnriched(follow) {
  const raw = follow.curator_id;
  const s = raw == null ? "" : String(raw).trim();
  const h = normalizeHandle(s);
  return {
    user_id: s || `unknown-${follow.created_at}`,
    curator_id: raw,
    created_at: follow.created_at,
    primaryText: "큐레이터 정보를 불러올 수 없음",
    secondaryText: h ? `@${h}` : null,
    label: h ? `@${h}` : String(raw || "알 수 없음"),
    avatarUrl: null,
    isCurator: false,
    curatorGrade: null,
  };
}

/**
 * picks REST 경로 (RPC 미배포·일부 행만 보강)
 */
async function fetchStudioFollowingEnrichedBatch(supabase, follows) {
  if (!follows?.length) return [];

  const rawIds = [...new Set(follows.map((f) => f.curator_id).filter(Boolean))];
  const uuidLike = [];
  const stringLike = [];
  for (const id of rawIds) {
    const s = String(id).trim();
    if (!s) continue;
    if (looksLikeUuid(s)) uuidLike.push(s);
    else stringLike.push(s);
  }

  const curatorRows = [];

  if (uuidLike.length) {
    const [idRes, uidRes] = await Promise.all([
      supabase
        .from("curators")
        .select(CURATOR_FOLLOWING_FIELDS)
        .in("id", uuidLike),
      supabase
        .from("curators")
        .select(CURATOR_FOLLOWING_FIELDS)
        .in("user_id", uuidLike),
    ]);
    if (idRes.error) {
      console.warn("팔로잉 큐레이터(id) 로드:", idRes.error.message);
    } else if (idRes.data) {
      curatorRows.push(...idRes.data);
    }
    if (uidRes.error) {
      console.warn("팔로잉 큐레이터(user_id) 로드:", uidRes.error.message);
    } else if (uidRes.data) {
      curatorRows.push(...uidRes.data);
    }
  }

  if (stringLike.length) {
    const [unRes, slugRes] = await Promise.all([
      supabase
        .from("curators")
        .select(CURATOR_FOLLOWING_FIELDS)
        .in("username", stringLike),
      supabase
        .from("curators")
        .select(`${CURATOR_FOLLOWING_FIELDS}, slug`)
        .in("slug", stringLike),
    ]);
    if (unRes.error) {
      console.warn("팔로잉 큐레이터(username) 로드:", unRes.error.message);
    } else if (unRes.data) {
      curatorRows.push(...unRes.data);
    }
    if (slugRes.error) {
      const msg = String(slugRes.error.message || "").toLowerCase();
      if (
        slugRes.error.code !== "42703" &&
        !msg.includes("column") &&
        !msg.includes("does not exist")
      ) {
        console.warn("팔로잉 큐레이터(slug) 로드:", slugRes.error.message);
      }
    } else if (slugRes.data) {
      curatorRows.push(...slugRes.data);
    }
  }

  const dedup = new Map();
  for (const c of curatorRows) {
    if (c?.id != null) dedup.set(String(c.id), c);
  }
  const maps = indexCuratorsForFollowingLookup([...dedup.values()]);

  return follows.map((follow) => {
    const raw = follow.curator_id;
    const curator = resolveCuratorForFollowingId(raw, maps);

    if (curator) {
      const lines = followerDisplayLines(
        curator.display_name || curator.name,
        curator.username,
        null
      );
      const avatarUrl =
        String(
          curator.avatar_url || curator.avatar || curator.image || ""
        ).trim() || null;
      return {
        user_id: curator.user_id,
        curator_id: raw,
        created_at: follow.created_at,
        ...lines,
        avatarUrl,
        isCurator: true,
        curatorGrade: curator.grade || null,
      };
    }

    return fallbackFollowingEnriched(follow);
  });
}

/**
 * 내가 팔로우한 큐레이터 (picks)
 * - studio_following_previews RPC 우선 (curators RLS 우회)
 * - user_follows ∪ curator_follows 병합 후, RPC에 없는 행만 REST 보강
 */
export async function fetchStudioFollowingEnriched(supabase, userId) {
  if (!userId) return [];

  const [{ data: ufRows, error: ufErr }, cfRes] = await Promise.all([
    supabase
      .from("user_follows")
      .select("curator_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("curator_follows")
      .select("curator_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (ufErr) throw ufErr;

  let cfRows = [];
  if (!cfRes.error && Array.isArray(cfRes.data)) {
    cfRows = cfRes.data;
  } else if (cfRes.error) {
    const msg = String(cfRes.error.message || "").toLowerCase();
    if (
      !msg.includes("does not exist") &&
      cfRes.error.code !== "42P01" &&
      cfRes.error.code !== "PGRST205"
    ) {
      console.warn("팔로잉 curator_follows 로드:", cfRes.error.message);
    }
  }

  const merged = new Map();
  for (const row of [...(ufRows || []), ...cfRows]) {
    const cid = row?.curator_id;
    if (cid == null || cid === "") continue;
    const k = String(cid).trim();
    const prev = merged.get(k);
    const t = row.created_at ? new Date(row.created_at).getTime() : 0;
    const pt = prev?.created_at ? new Date(prev.created_at).getTime() : 0;
    if (!prev || t >= pt) {
      merged.set(k, { curator_id: row.curator_id, created_at: row.created_at });
    }
  }

  const follows = [...merged.values()]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 200);

  if (!follows.length) return [];

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "studio_following_previews",
    { p_user_id: userId }
  );

  const rpcMap = new Map();
  if (!rpcErr && Array.isArray(rpcData)) {
    for (const row of rpcData) {
      const k = followingMergeKey(row.curator_id_raw);
      if (k) rpcMap.set(k, row);
    }
  } else if (rpcErr) {
    console.warn(
      "studio_following_previews RPC 사용 불가 — REST로 폴백:",
      rpcErr.message
    );
  }

  if (rpcErr || rpcMap.size === 0) {
    return fetchStudioFollowingEnrichedBatch(supabase, follows);
  }

  const missing = [];
  for (const f of follows) {
    if (!rpcMap.has(followingMergeKey(f.curator_id))) {
      missing.push(f);
    }
  }

  let legacyMap = new Map();
  if (missing.length) {
    const batch = await fetchStudioFollowingEnrichedBatch(supabase, missing);
    missing.forEach((f, i) => {
      legacyMap.set(followingMergeKey(f.curator_id), batch[i]);
    });
  }

  return follows.map((f) => {
    const k = followingMergeKey(f.curator_id);
    const rpcRow = rpcMap.get(k);
    if (rpcRow) return mapFollowingRpcRow(rpcRow, f.created_at);
    const leg = legacyMap.get(k);
    if (leg) return { ...leg, created_at: f.created_at };
    return fallbackFollowingEnriched(f);
  });
}

/** 잔 아카이브 팔로잉 숫자: user_follows ∪ curator_follows 의 서로 다른 curator_id 개수 */
export async function countStudioFollowingDistinct(supabase, userId) {
  if (!userId) return 0;

  const [ufRes, cfRes] = await Promise.all([
    supabase.from("user_follows").select("curator_id").eq("user_id", userId),
    supabase.from("curator_follows").select("curator_id").eq("user_id", userId),
  ]);

  if (ufRes.error) {
    console.warn("팔로잉 수 user_follows:", ufRes.error.message);
    return 0;
  }

  const keys = new Set();
  for (const r of ufRes.data || []) {
    if (r?.curator_id != null && String(r.curator_id).trim() !== "") {
      keys.add(String(r.curator_id).trim());
    }
  }

  if (!cfRes.error && Array.isArray(cfRes.data)) {
    for (const r of cfRes.data) {
      if (r?.curator_id != null && String(r.curator_id).trim() !== "") {
        keys.add(String(r.curator_id).trim());
      }
    }
  } else if (cfRes.error) {
    const msg = String(cfRes.error.message || "").toLowerCase();
    if (
      !msg.includes("does not exist") &&
      cfRes.error.code !== "42P01" &&
      cfRes.error.code !== "PGRST205"
    ) {
      console.warn("팔로잉 수 curator_follows:", cfRes.error.message);
    }
  }

  return keys.size;
}
