import { getAiApiBaseUrl } from "../utils/apiBaseUrl";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders";

/** 화면에 입력하는 확인 문구 */
export const ACCOUNT_DELETE_TYPE_WORD = "탈퇴";

/** 서버에 보내는 확인 토큰 */
export const ACCOUNT_DELETE_CONFIRM_TOKEN = "DELETE";

/**
 * @param {string} typed
 * @returns {boolean}
 */
export function isAccountDeleteTyped(typed) {
  return String(typed || "").trim() === ACCOUNT_DELETE_TYPE_WORD;
}

/**
 * 로그인 세션으로 계정 삭제를 요청한다.
 * @returns {Promise<{ ok: true } | { ok: false, error: string, status?: number }>}
 */
export async function requestAccountDeletion() {
  const base = getAiApiBaseUrl();
  const url = base ? `${base}/api/account/delete` : "/api/account/delete";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: await getApiAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ confirm: ACCOUNT_DELETE_CONFIRM_TOKEN }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return {
        ok: false,
        status: res.status,
        error:
          (typeof data?.error === "string" && data.error) ||
          `계정 삭제에 실패했습니다. (${res.status})`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || "계정 삭제 요청에 실패했습니다.",
    };
  }
}
