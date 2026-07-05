import { createSupabaseServiceClient } from "./supabaseServiceRole.js";

export const STUDIO_AI_COURSE_SUGGESTION_FREE_MONTHLY = 5;

function isQuotaDisabled() {
  return process.env.STUDIO_AI_QUOTA_DISABLED === "true";
}

async function getServiceClient() {
  const { client: sb, error: envErr } = createSupabaseServiceClient();
  if (envErr || !sb) return null;
  return sb;
}

/**
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, isPro?: boolean, remaining?: number|null, reason?: string }>}
 */
export async function peekStudioAiCourseSuggestionQuota(userId) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { allowed: false, reason: "no_user" };
  }
  if (isQuotaDisabled()) {
    return { allowed: true, isPro: true, remaining: null };
  }

  const sb = await getServiceClient();
  if (!sb) {
    return { allowed: true, isPro: false, remaining: null };
  }

  const { data, error } = await sb.rpc(
    "peek_studio_ai_course_suggestion_for_user",
    { p_user_id: uid }
  );

  if (error) {
    const msg = String(error.message || error);
    if (/peek_studio_ai_course|42883|does not exist/i.test(msg)) {
      return { allowed: true, isPro: false, remaining: null };
    }
    return { allowed: false, reason: "quota_check_failed" };
  }

  const payload = data && typeof data === "object" ? data : {};
  return {
    allowed: payload.allowed !== false,
    isPro: Boolean(payload.is_pro),
    remaining:
      payload.remaining == null ? null : Number(payload.remaining) || 0,
    reason: payload.reason != null ? String(payload.reason) : undefined,
  };
}

/**
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, isPro?: boolean, remaining?: number|null, reason?: string }>}
 */
export async function consumeStudioAiCourseSuggestionQuota(userId) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { allowed: false, reason: "no_user" };
  }
  if (isQuotaDisabled()) {
    return { allowed: true, isPro: true, remaining: null };
  }

  const sb = await getServiceClient();
  if (!sb) {
    return { allowed: true, isPro: false, remaining: null };
  }

  const { data, error } = await sb.rpc(
    "try_consume_studio_ai_course_suggestion_for_user",
    { p_user_id: uid }
  );

  if (error) {
    const msg = String(error.message || error);
    if (/try_consume_studio_ai_course|42883|does not exist/i.test(msg)) {
      return { allowed: true, isPro: false, remaining: null };
    }
    return { allowed: false, reason: "quota_check_failed" };
  }

  const payload = data && typeof data === "object" ? data : {};
  if (payload.allowed === false) {
    return {
      allowed: false,
      isPro: Boolean(payload.is_pro),
      remaining: 0,
      reason: String(payload.reason || "quota_exceeded"),
    };
  }

  return {
    allowed: true,
    isPro: Boolean(payload.is_pro),
    remaining:
      payload.remaining == null ? null : Number(payload.remaining) || 0,
  };
}
