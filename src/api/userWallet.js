import { supabase } from "../lib/supabase";
import { DROPS_PER_AI_CREDIT } from "../constants/dropEconomy.js";

/**
 * @typedef {{
 *   ok: boolean,
 *   drops: number,
 *   aiCredits: number,
 *   dropsPerAiCredit: number,
 *   progressDrops: number,
 *   canExchange: boolean,
 * }} UserWallet
 */

/**
 * @param {unknown} raw
 * @returns {UserWallet|null}
 */
export function normalizeUserWallet(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (o.ok !== true) return null;
  const drops = Math.max(0, Math.floor(Number(o.drops) || 0));
  const per = Math.max(
    1,
    Math.floor(Number(o.drops_per_ai_credit) || DROPS_PER_AI_CREDIT)
  );
  const progressDrops = Math.max(
    0,
    Math.floor(Number(o.progress_drops ?? o.progressDrops) || 0)
  );
  return {
    ok: true,
    drops,
    aiCredits: Math.max(0, Math.floor(Number(o.ai_credits) || 0)),
    dropsPerAiCredit: per,
    progressDrops: progressDrops || drops % per,
    canExchange: Boolean(o.can_exchange) || drops >= per,
  };
}

/** @returns {UserWallet} */
export function emptyUserWallet() {
  return {
    ok: true,
    drops: 0,
    aiCredits: 0,
    dropsPerAiCredit: DROPS_PER_AI_CREDIT,
    progressDrops: 0,
    canExchange: false,
  };
}

/**
 * @param {string} [userId]
 * @returns {Promise<UserWallet>}
 */
export async function fetchUserWallet(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return emptyUserWallet();

  const { data, error } = await supabase.rpc("get_user_wallet", {
    p_user_id: uid,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[userWallet] get_user_wallet:", error.message || error);
    }
    return emptyUserWallet();
  }

  return normalizeUserWallet(data) || emptyUserWallet();
}

/**
 * Drop → AI Credit 1회 교환
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, wallet?: UserWallet, message?: string }>}
 */
export async function exchangeDropsForAiCredit(userId) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { ok: false, message: "로그인이 필요해요." };
  }

  const { data, error } = await supabase.rpc("try_exchange_drops_for_ai_credit", {
    p_user_id: uid,
  });

  if (error) {
    return { ok: false, message: error.message || "교환에 실패했어요." };
  }

  const wallet = normalizeUserWallet(data?.wallet ?? data);
  if (data?.ok !== true) {
    return {
      ok: false,
      message:
        data?.message ||
        "Drop이 부족해요. 체크인·저장으로 Drop을 모아 주세요.",
      wallet: wallet || undefined,
    };
  }

  return { ok: true, wallet: wallet || emptyUserWallet() };
}
