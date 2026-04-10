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
 * check_ins.user_nickname 에 넣을 표시 이름 (일반 유저: profiles 닉네임·핸들 우선)
 * @param {object|null} user — Supabase auth user
 * @param {{ display_name?: string, username?: string }|null|undefined} profileRow — profiles 한 행
 */
export function resolveCheckinDisplayName(user, profileRow) {
  if (!user) return "게스트";

  const fromProfile = (profileRow?.display_name || "").trim();
  if (fromProfile) return fromProfile.slice(0, 100);

  const handle = stripLeadingAt(profileRow?.username);
  if (handle) return handle.slice(0, 100);

  const md = user.user_metadata || {};
  const mdName = (md.display_name || md.full_name || md.name || "").trim();
  if (mdName) return mdName.slice(0, 100);

  let uName = stripLeadingAt(md.username);
  if (uName && !looksLikeFullEmail(uName)) return uName.slice(0, 100);

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
    legacyEmailLocalPart(user?.email),
    String(md.nickname || "").trim(),
    stripLeadingAt(md.username),
    stripLeadingAt(profileRow?.username),
    (profileRow?.display_name || "").trim(),
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
