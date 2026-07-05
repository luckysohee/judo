/** 이메일 로컬파트 (체크인 히스토리와의 OR 매칭용) */
export function legacyEmailLocalPart(email) {
  if (!email || typeof email !== "string") return "";
  return email.split("@")[0]?.trim() || "";
}

function stripLeadingAt(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.startsWith("@") ? t.slice(1).trim() : t;
}

function looksLikeFullEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

/**
 * 공개 표시용 — profiles.username(핸들) 우선, 없으면 display_name
 * @param {{ display_name?: string, username?: string }|null|undefined} profileRow
 */
export function resolveProfilePublicLabel(profileRow) {
  const handle = stripLeadingAt(profileRow?.username);
  if (handle) return handle.slice(0, 100);
  const fromProfile = (profileRow?.display_name || "").trim();
  if (fromProfile) return fromProfile.slice(0, 100);
  return "";
}

/**
 * check_ins 행 표시 — profile 핸들 우선, 없으면 저장된 user_nickname
 * @param {object|null|undefined} row
 * @param {Record<string, { display_name?: string, username?: string }>|null|undefined} profilesById
 */
export function resolveCheckinRowDisplayName(row, profilesById) {
  const uid = row?.user_id != null ? String(row.user_id) : "";
  if (uid && profilesById && typeof profilesById === "object") {
    const label = resolveProfilePublicLabel(profilesById[uid]);
    if (label) return label;
  }
  const stored = String(row?.user_nickname || row?.user || "").trim();
  if (stored) return stored.slice(0, 100);
  return "아는 사람";
}

/**
 * check_ins.user_nickname 에 넣을 표시 이름 (핸들 우선)
 * @param {object|null} user — Supabase auth user
 * @param {{ display_name?: string, username?: string }|null|undefined} profileRow — profiles 한 행
 */
export function resolveCheckinDisplayName(user, profileRow) {
  if (!user) return "게스트";

  const handle = stripLeadingAt(profileRow?.username);
  if (handle) return handle.slice(0, 100);

  const md = user.user_metadata || {};
  let uName = stripLeadingAt(md.username);
  if (uName && !looksLikeFullEmail(uName)) return uName.slice(0, 100);

  const fromProfile = (profileRow?.display_name || "").trim();
  if (fromProfile) return fromProfile.slice(0, 100);

  const mdName = (md.display_name || md.full_name || md.name || "").trim();
  if (mdName) return mdName.slice(0, 100);

  const nick = String(md.nickname || "").trim();
  if (nick && !nick.includes("@") && !looksLikeFullEmail(nick)) return nick.slice(0, 100);

  const local = legacyEmailLocalPart(user.email);
  if (local) return local.slice(0, 100);

  return "사용자";
}

/**
 * profiles.display_name 이 비어 있을 때만 채우기 (OAuth/이메일).
 * 큐레이터 팔로우 알림에 이름이 가도록 로그인·팔로우 시 sync에 사용.
 */
export function seedDisplayNameFromAuthUser(user) {
  if (!user) return "";
  const md = user.user_metadata || {};
  const candidates = [
    md.full_name,
    md.name,
    md.display_name,
    md.nickname,
    md.preferred_username,
  ];
  for (const c of candidates) {
    const t = String(c || "").trim();
    if (!t) continue;
    if (looksLikeFullEmail(t)) continue;
    if (t.includes("@")) continue;
    return t.slice(0, 100);
  }
  return legacyEmailLocalPart(user.email).slice(0, 100);
}

/** profiles.avatar_url 이 비어 있을 때 OAuth 메타(구글 picture 등)에서만 채움 */
export function seedAvatarUrlFromAuthUser(user) {
  if (!user) return "";
  const m = user.user_metadata || {};
  const raw = m.avatar_url || m.picture || m.image;
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t || !/^https?:\/\//i.test(t)) return "";
  return t.slice(0, 2000);
}

/** 최근 체크인 여부 조회: 예전에 이메일/메타만 쓴 기록도 잡기 */
export function checkinNicknameAliases(user, profileRow) {
  const primary = resolveCheckinDisplayName(user, profileRow);
  const md = user?.user_metadata || {};
  const raw = [
    primary,
    stripLeadingAt(profileRow?.username),
    (profileRow?.display_name || "").trim(),
    legacyEmailLocalPart(user?.email),
    String(md.nickname || "").trim(),
    stripLeadingAt(md.username),
  ];
  const out = [];
  const seen = new Set();
  for (const x of raw) {
    const t = String(x || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 홈 피드·팝업 토스트 제외 — 본인 check_ins 행인지 */
export function isOwnCheckinRow(row, user, profileRow) {
  if (!user?.id || !row) return false;
  if (row.user_id && String(row.user_id) === String(user.id)) return true;
  const nick = String(row.user_nickname || "").trim().toLowerCase();
  if (!nick) return false;
  return checkinNicknameAliases(user, profileRow).some(
    (alias) => String(alias).trim().toLowerCase() === nick
  );
}
