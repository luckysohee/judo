/**
 * Supabase Auth 사용자에서 로그인 제공자 문자열 추출 (내부 기록용).
 */
import {
  seedAvatarUrlFromAuthUser,
  seedDisplayNameFromAuthUser,
} from "../utils/checkinDisplayName";

/** 설정 화면 등: 로그인 수단을 이메일 @ 와 구분되는 짧은 라벨로 */
export function formatAuthProviderForUi(prov) {
  if (!prov) return "연결된 계정";
  const p = String(prov).toLowerCase();
  if (p === "kakao") return "카카오 로그인";
  if (p === "google") return "구글 로그인";
  if (p === "email") return "이메일 로그인";
  return `${p} 로그인`;
}

export function getAuthProviderLabel(user) {
  if (!user || typeof user !== "object") return null;
  const am = user.app_metadata || {};
  if (am.provider) return String(am.provider);
  const ids = Array.isArray(user.identities) ? user.identities : [];
  const first = ids.find((x) => x?.provider) || ids[0];
  return first?.provider ? String(first.provider) : null;
}

/**
 * profiles: auth_provider 갱신 + display_name 이 비어 있으면 OAuth/이메일로 시드.
 * 행 없으면 삽입(최소 id·role, 가능하면 provider·이름).
 */
export async function syncAuthProviderToProfile(supabaseClient, user) {
  if (!supabaseClient || !user?.id) return { ok: false, skipped: true };

  const prov = getAuthProviderLabel(user);
  const seed = seedDisplayNameFromAuthUser(user);
  const seedAvatar = seedAvatarUrlFromAuthUser(user);
  const now = new Date().toISOString();

  const { data: row, error: selErr } = await supabaseClient
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    console.warn("syncAuthProviderToProfile select:", selErr.message);
    return { ok: false, error: selErr };
  }

  const patch = {};
  if (prov) {
    patch.auth_provider = prov;
    patch.auth_provider_updated_at = now;
  }
  if (seed && row?.id && !(row.display_name || "").trim()) {
    patch.display_name = seed;
  }
  if (
    seedAvatar &&
    row?.id &&
    !(String(row.avatar_url || "").trim())
  ) {
    patch.avatar_url = seedAvatar;
  }

  if (row?.id) {
    if (Object.keys(patch).length === 0) {
      return { ok: true, skipped: true };
    }
    const { error } = await supabaseClient
      .from("profiles")
      .update(patch)
      .eq("id", user.id);
    if (error) {
      console.warn("syncAuthProviderToProfile update:", error.message);
      return { ok: false, error };
    }
    return { ok: true };
  }

  const ins = {
    id: user.id,
    role: "user",
    ...patch,
  };
  if (seed && !(ins.display_name || "").trim()) {
    ins.display_name = seed;
  }
  if (seedAvatar && !(String(ins.avatar_url || "").trim())) {
    ins.avatar_url = seedAvatar;
  }

  const { error: insErr } = await supabaseClient.from("profiles").insert(ins);
  if (insErr) {
    console.warn("syncAuthProviderToProfile insert:", insErr.message);
    return { ok: false, error: insErr };
  }
  return { ok: true };
}
