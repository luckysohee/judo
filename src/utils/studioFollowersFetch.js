import { formatAuthProviderForUi } from "../lib/syncAuthProviderToProfile";
import { rewriteLegacySupabaseStorageUrl } from "./rewriteLegacySupabaseStorageUrl";

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
 * 팔로워 한 명 표시: 큐레이터 행이 있으면 name/slug를 단일 진실원으로 사용
 * (profiles OAuth 본명·curators.display_name 혼선 방지)
 * @param {object|null|undefined} profile — profiles 행
 * @param {object|null|undefined} curatorRow — curators 행 (user_id 기준)
 */
export function resolveFollowerPresentation(profile, curatorRow) {
  const p = profile && typeof profile === "object" ? profile : {};
  const c =
    curatorRow && typeof curatorRow === "object" ? curatorRow : null;

  const isCurator = Boolean(c);
  const nick = String(
    isCurator
      ? (c?.name || "")
      : (p.display_name || "")
  ).trim();
  // 큐레이터는 slug를 단일 진실원으로 사용 (username 구값 폴백 금지)
  const handle = normalizeHandle(
    isCurator ? (c?.slug || "") : (p?.username || "")
  );

  const lines = followerDisplayLines(nick, handle, p.auth_provider);

  const avatarUrl =
    rewriteLegacySupabaseStorageUrl(
      String(c?.avatar_url || c?.image || p.avatar_url || "").trim()
    ) || null;

  return {
    ...lines,
    avatarUrl,
    isCurator,
    curatorName: isCurator ? String(c?.name || "").trim() : null,
    curatorSlug: isCurator ? normalizeHandle(c?.slug || "") : null,
    curatorGrade: c?.grade || null,
  };
}

function mapFollowerRpcRows(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((row) => {
    const lines = followerDisplayLines(
      row.display_nick,
      row.handle_raw,
      null
    );
    return {
      user_id: row.user_id,
      created_at: row.created_at,
      ...lines,
      avatarUrl:
        rewriteLegacySupabaseStorageUrl(String(row.avatar_url || "").trim()) ||
        null,
      isCurator: Boolean(row.is_curator),
      curatorGrade: row.curator_grade || null,
    };
  });
}

/**
 * RPC가 과거 스냅샷 핸들/닉을 줄 수 있어, 현재 profiles/curators 기준으로 표시를 재정규화.
 * - 큐레이터: curators.slug + curators.name
 * - 일반 유저: profiles.username + profiles.display_name
 */
async function hydrateRowsWithCurrentIdentity(supabase, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return list;
  const ids = [...new Set(list.map((r) => String(r?.user_id || "").trim()).filter(Boolean))];
  if (!ids.length) return list;

  const [{ data: profs, error: pErr }, { data: curs, error: cErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username, auth_provider, avatar_url")
        .in("id", ids),
      supabase
        .from("curators")
        .select("user_id, slug, name, username, avatar_url, image, grade")
        .in("user_id", ids),
    ]);
  if (pErr) console.warn("identity hydrate profiles:", pErr.message);
  if (cErr) console.warn("identity hydrate curators:", cErr.message);

  const byId = Object.fromEntries((profs || []).map((p) => [String(p.id), p]));
  const byCuratorUserId = Object.fromEntries((curs || []).map((c) => [String(c.user_id), c]));

  return list.map((row) => {
    const uid = String(row?.user_id || "").trim();
    if (!uid) return row;
    const pres = resolveFollowerPresentation(byId[uid], byCuratorUserId[uid]);
    return {
      ...row,
      ...pres,
    };
  });
}

/**
 * @param {string} [curatorId] — curators.id
 * @param {{ byFollowingUserId?: string }} [opts] — auth user id of the followee (내 팔로워 탭)
 */
async function fetchStudioFollowersViaRpc(supabase, curatorId, opts = {}) {
  const byUid = opts.byFollowingUserId;
  if (byUid) {
    const { data, error } = await supabase.rpc(
      "studio_follower_previews_by_following",
      { p_following_user_id: byUid }
    );
    if (error) return { error, rows: null };
    return { error: null, rows: mapFollowerRpcRows(data) };
  }
  const { data, error } = await supabase.rpc("studio_follower_previews", {
    p_curator_id: curatorId,
  });
  if (error) return { error, rows: null };
  return { error: null, rows: mapFollowerRpcRows(data) };
}

/** REST만 (RPC 실패·미배포 시). curators.select에 slug 넣지 않음 — 컬럼 없으면 전체 쿼리 400 */
async function fetchStudioFollowersEnrichedRest(
  supabase,
  curatorId,
  opts = {}
) {
  let rows;
  let error;

  if (opts.byFollowingUserId) {
    const res = await supabase
      .from("user_profile_follows")
      .select("follower_id, created_at")
      .eq("following_id", opts.byFollowingUserId)
      .order("created_at", { ascending: false })
      .limit(200);
    rows = res.data;
    error = res.error;
    if (!error && rows?.length) {
      rows = rows.map((r) => ({
        user_id: r.follower_id,
        created_at: r.created_at,
      }));
    }
  } else {
    const { data: cur } = await supabase
      .from("curators")
      .select("user_id")
      .eq("id", curatorId)
      .maybeSingle();
    if (!cur?.user_id) return [];

    const res = await supabase
      .from("user_profile_follows")
      .select("follower_id, created_at")
      .eq("following_id", cur.user_id)
      .order("created_at", { ascending: false })
      .limit(200);
    rows = res.data;
    error = res.error;
    if (!error && rows?.length) {
      rows = rows.map((r) => ({
        user_id: r.follower_id,
        created_at: r.created_at,
      }));
    }
  }

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
          "user_id, slug, name, username, avatar_url, image, grade"
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
 * @param {string} curatorIdOrFollowingUid — curators.id 또는, opts.byFollowingUserId 사용 시 following auth uid
 * @param {{ byFollowingUserId?: string }} [opts]
 */
export async function fetchStudioFollowersEnriched(
  supabase,
  curatorIdOrFollowingUid,
  opts = {}
) {
  const id = curatorIdOrFollowingUid;
  if (!opts.byFollowingUserId && !id) return [];

  const { error: rpcErr } = await fetchStudioFollowersViaRpc(
    supabase,
    id,
    opts
  );
  // picked/picks 표시는 최신 profiles/curators 기준으로 강제 정규화.
  // RPC의 display_nick/handle_raw 스냅샷은 사용하지 않는다.
  if (rpcErr) {
    console.warn(
      "studio_follower_previews RPC 사용 불가 — REST로 폴백:",
      rpcErr.message
    );
  }
  return fetchStudioFollowersEnrichedRest(supabase, id, opts);
}

const CURATOR_FOLLOWING_FIELDS =
  "id, user_id, slug, name, username, avatar_url, image, grade";

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

function mapFollowingRpcRow(row, createdAt) {
  const lines = followerDisplayLines(row.display_nick, row.handle_raw, null);
  const avatarUrl =
    rewriteLegacySupabaseStorageUrl(String(row.avatar_url || "").trim()) ||
    null;
  const targetUserId =
    row.following_user_id ??
    row.curator_user_id ??
    row.curator_id_raw;
  return {
    user_id: targetUserId,
    following_user_id: row.following_user_id ?? targetUserId,
    curator_id: row.curator_id_raw,
    created_at: createdAt,
    ...lines,
    avatarUrl,
    isCurator: Boolean(row.is_curator),
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

  const needProfileUuids = new Set();
  for (const follow of follows) {
    const raw = follow.curator_id;
    if (!resolveCuratorForFollowingId(raw, maps)) {
      const s = String(raw ?? "").trim();
      if (looksLikeUuid(s)) {
        needProfileUuids.add(normUuidishKey(s));
      }
    }
  }

  let profilesById = {};
  if (needProfileUuids.size) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, username, auth_provider, avatar_url")
      .in("id", [...needProfileUuids]);
    if (pErr) {
      console.warn("팔로잉 프로필 로드:", pErr.message);
    } else {
      profilesById = Object.fromEntries(
        (profs || []).map((p) => [p.id, p])
      );
    }
  }

  return follows.map((follow) => {
    const raw = follow.curator_id;
    const curator = resolveCuratorForFollowingId(raw, maps);

    if (curator) {
      const lines = followerDisplayLines(
        curator.name,
        curator.slug,
        null
      );
      const avatarUrl =
        rewriteLegacySupabaseStorageUrl(
          String(curator.avatar_url || curator.image || "").trim()
        ) || null;
      return {
        user_id: curator.user_id,
        following_user_id: curator.user_id,
        curator_id: raw,
        created_at: follow.created_at,
        ...lines,
        avatarUrl,
        isCurator: true,
        curatorName: String(curator.name || "").trim() || null,
        curatorSlug: normalizeHandle(curator.slug || "") || null,
        curatorGrade: curator.grade || null,
      };
    }

    const s = String(raw ?? "").trim();
    if (looksLikeUuid(s)) {
      const prof = profilesById[normUuidishKey(s)];
      if (prof) {
        const lines = followerDisplayLines(
          prof.display_name,
          prof.username,
          prof.auth_provider
        );
        return {
          user_id: prof.id,
          following_user_id: prof.id,
          curator_id: prof.id,
          created_at: follow.created_at,
          ...lines,
          avatarUrl:
            rewriteLegacySupabaseStorageUrl(
              String(prof.avatar_url || "").trim()
            ) || null,
          isCurator: false,
          curatorGrade: null,
        };
      }
    }

    return fallbackFollowingEnriched(follow);
  });
}

/**
 * 내가 팔로우한 사용자 (picks) — 큐레이터·일반 프로필
 * studio_following_previews RPC 우선, 실패 시 user_profile_follows + REST 보강
 */
export async function fetchStudioFollowingEnriched(supabase, userId) {
  if (!userId) return [];

  const { error: rpcErr } = await supabase.rpc(
    "studio_following_previews",
    { p_user_id: userId }
  );
  // 최신 slug/name 표기를 보장하기 위해 RPC 결과 표시는 사용하지 않고 REST 재조합 고정.

  if (rpcErr) {
    console.warn(
      "studio_following_previews RPC 사용 불가 — REST로 폴백:",
      rpcErr.message
    );
  }

  const { data: ufRows, error: ufErr } = await supabase
    .from("user_profile_follows")
    .select("following_id, created_at")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (ufErr) throw ufErr;
  if (!ufRows?.length) return [];

  const follows = ufRows.map((r) => ({
    curator_id: r.following_id,
    created_at: r.created_at,
  }));

  return fetchStudioFollowingEnrichedBatch(supabase, follows);
}

/** 팔로잉 수 (고유 following_id) */
export async function countStudioFollowingDistinct(supabase, userId) {
  if (!userId) return 0;

  const { data, error } = await supabase.rpc("user_follow_counts", {
    p_user_id: userId,
  });
  if (!error && data != null) {
    const row = Array.isArray(data) ? data[0] : data;
    const n = Number(row?.following_count);
    if (Number.isFinite(n)) return n;
  }
  if (error) {
    console.warn("user_follow_counts RPC:", error.message);
  }

  const { count, error: cErr } = await supabase
    .from("user_profile_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", userId);

  if (cErr) {
    console.warn("팔로잉 수 user_profile_follows:", cErr.message);
    return 0;
  }
  return count ?? 0;
}
