import { supabase } from "../lib/supabase";

/** 무료 큐레이터 — AI 코스 초안 월간 한도 (DB RPC와 동일) */
export const STUDIO_AI_COURSE_SUGGESTION_FREE_MONTHLY = 5;

export function isStudioAiQuotaDisabled() {
  if (import.meta.env.DEV && import.meta.env.VITE_STUDIO_AI_QUOTA_DISABLED === "true") {
    return true;
  }
  return false;
}

/**
 * @typedef {{
 *   ok: boolean,
 *   isPro: boolean,
 *   used: number,
 *   limit: number|null,
 *   remaining: number|null,
 *   periodLabel: string,
 *   canUse: boolean,
 *   reason?: string,
 * }} StudioAiCourseSuggestionQuota
 */

/**
 * @param {unknown} raw
 * @returns {StudioAiCourseSuggestionQuota|null}
 */
export function normalizeStudioAiCourseSuggestionQuota(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (o.ok !== true) return null;
  const isPro = Boolean(o.is_pro);
  const used = Number(o.used) || 0;
  const limit =
    o.limit == null ? null : Math.max(0, Math.floor(Number(o.limit) || 0));
  const remaining =
    o.remaining == null
      ? null
      : Math.max(0, Math.floor(Number(o.remaining) || 0));
  const canUse = isPro || (remaining != null && remaining > 0);
  return {
    ok: true,
    isPro,
    used,
    limit,
    remaining,
    periodLabel: String(o.period_label || "").trim(),
    canUse,
    reason: o.reason != null ? String(o.reason) : undefined,
  };
}

/** @returns {StudioAiCourseSuggestionQuota} */
export function unlimitedStudioAiQuotaFallback() {
  return {
    ok: true,
    isPro: true,
    used: 0,
    limit: null,
    remaining: null,
    periodLabel: "",
    canUse: true,
  };
}

/**
 * @param {string} [userId]
 * @returns {Promise<StudioAiCourseSuggestionQuota|null>}
 */
export async function fetchStudioAiCourseSuggestionQuota(userId) {
  if (isStudioAiQuotaDisabled()) {
    return unlimitedStudioAiQuotaFallback();
  }
  const uid = String(userId || "").trim();
  const { data, error } = await supabase.rpc(
    "get_studio_ai_course_suggestion_quota",
    uid ? { p_user_id: uid } : {}
  );
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[studioAiQuota]", error.message || error);
    }
    return null;
  }
  return normalizeStudioAiCourseSuggestionQuota(data);
}

/**
 * @param {StudioAiCourseSuggestionQuota|null|undefined} quota
 */
export function formatStudioAiQuotaLine(quota) {
  if (!quota?.ok) return "";
  if (quota.isPro) return "Studio Pro · AI 코스 초안 무제한";
  const lim = quota.limit ?? STUDIO_AI_COURSE_SUGGESTION_FREE_MONTHLY;
  const rem = quota.remaining ?? Math.max(0, lim - quota.used);
  return `이번 달 AI 초안 ${quota.used}/${lim}회 · 남은 ${rem}회`;
}

/**
 * @param {StudioAiCourseSuggestionQuota|null|undefined} quota
 */
export function studioAiQuotaExceededMessage(quota) {
  const lim = quota?.limit ?? STUDIO_AI_COURSE_SUGGESTION_FREE_MONTHLY;
  return `이번 달 무료 AI 코스 초안 ${lim}회를 모두 썼어요. Studio Pro에서 무제한으로 쓸 수 있어요.`;
}
