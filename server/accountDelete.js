import { createSupabaseServiceClient } from "./supabaseServiceRole.js";

export const ACCOUNT_DELETE_CONFIRM_TOKEN = "DELETE";

/**
 * 로그인 사용자 본인 계정 삭제 (App Store / 개인정보 보호법).
 * JWT는 requireSupabaseAuth 가 req.authUser 에 넣는다.
 */
export async function handleDeleteAccount(req, res) {
  const user = req.authUser;
  if (!user?.id) {
    return res.status(401).json({
      ok: false,
      error: "로그인이 필요합니다.",
    });
  }

  const confirm = String(req.body?.confirm || "").trim();
  if (confirm !== ACCOUNT_DELETE_CONFIRM_TOKEN) {
    return res.status(400).json({
      ok: false,
      error: "confirmation_required",
    });
  }

  const { client, error: envError } = createSupabaseServiceClient();
  if (!client) {
    console.error("account delete: missing service role", envError);
    return res.status(503).json({
      ok: false,
      error: "계정 삭제를 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  const uid = user.id;

  try {
    await client
      .from("profiles")
      .update({
        display_name: "탈퇴한 사용자",
        avatar_url: null,
      })
      .eq("id", uid);
  } catch (e) {
    console.warn("account delete profile wipe:", e?.message || e);
  }

  try {
    await client.from("curators").delete().eq("user_id", uid);
  } catch (e) {
    console.warn("account delete curator wipe:", e?.message || e);
  }

  const { error } = await client.auth.admin.deleteUser(uid);
  if (error) {
    console.error("account delete auth.admin.deleteUser:", error.message || error);
    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "계정을 삭제하지 못했습니다. 문의 메일로 요청해 주세요.",
    });
  }

  return res.json({ ok: true });
}
