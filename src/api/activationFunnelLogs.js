import { supabase } from "./client";

/** @enum {string} */
export const ACTIVATION_EVENT = {
  FIRST_HOME_VIEW: "first_home_view",
  FIRST_COLLECTION_SAVE: "first_collection_save",
  FIRST_FOLLOW_CURATOR: "first_follow_curator",
  FIRST_COLLECTION_CREATE: "first_collection_create",
  ACTIVATION_COMPLETED: "activation_completed",
  RETENTION_D1_REVISIT: "retention_d1_revisit",
  RETENTION_D7_REVISIT: "retention_d7_revisit",
  SECOND_SAVE: "second_collection_save",
  SECOND_FOLLOW: "second_follow_curator",
  SECOND_COLLECTION_CREATE: "second_collection_create",
  REENGAGEMENT_BANNER_IMPRESSION: "reengagement_banner_impression",
  REENGAGEMENT_BANNER_CLICK: "reengagement_banner_click",
  REENGAGEMENT_BANNER_DISMISS: "reengagement_banner_dismiss",
  ONBOARDING_IMPRESSION: "activation_onboarding_impression",
  ONBOARDING_CLICK: "activation_onboarding_click",
};

const SESSION_ID_KEY = "judo_session_id_v1";
const DEDUP_PREFIX = "judo_funnel_dedup_v1:";
const EXP_PREFIX = "judo_exp:";
const HOME_LAYOUT_EXPERIMENT_KEY = "home_layout_v1";
const ACTIVATION_CTA_EXPERIMENT_KEY = "activation_cta_v1";
const SESSION_DEDUP_MAX = 512;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

const _sessionDedup = new Set();

function safeGetLocalStorage(key) {
  try {
    return window?.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemoveLocalStorage(key) {
  try {
    window?.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

function markSessionDedup(key) {
  _sessionDedup.add(key);
  // 세션이 매우 길어져도 Set 무한 증가를 막는다.
  if (_sessionDedup.size > SESSION_DEDUP_MAX) _sessionDedup.clear();
}

function shouldSkipByLocalStorageDedup(lsKey) {
  const raw = safeGetLocalStorage(lsKey);
  if (!raw) return false;
  const ts = Number(raw);
  if (Number.isFinite(ts) && ts > 0) {
    if (Date.now() - ts < DEDUP_TTL_MS) return true;
  }
  safeRemoveLocalStorage(lsKey);
  return false;
}

function isSchemaColumnError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return /column|42703|does not exist/.test(msg);
}

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  const existing = safeGetLocalStorage(SESSION_ID_KEY);
  if (existing) return existing;
  let next = "";
  try {
    next = window.crypto?.randomUUID?.() || "";
  } catch {
    next = "";
  }
  if (!next) {
    // fallback: best-effort uuid-ish
    next = `${Date.now()}-${Math.random()}`.replaceAll(".", "");
  }
  safeSetLocalStorage(SESSION_ID_KEY, next);
  return next;
}

function buildDedupKey({
  eventName,
  experimentBucket,
  activationCtaBucket,
  completedBy,
  appEnv,
}) {
  const e = String(eventName || "").trim();
  const b = typeof experimentBucket === "string" ? experimentBucket.trim() : "";
  const c =
    typeof activationCtaBucket === "string" ? activationCtaBucket.trim() : "";
  const d = typeof completedBy === "string" ? completedBy.trim() : "";
  const a = typeof appEnv === "string" ? appEnv.trim() : "";
  return `${e}::${b || "-"}::${c || "-"}::${d || "-"}::${a || "-"}`;
}

function inferExperimentBucket(explicitBucket) {
  const exp = typeof explicitBucket === "string" ? explicitBucket.trim() : "";
  if (exp) return exp;
  // Home layout experiment bucket은 localStorage에 저장돼 있으므로 전역에서 재사용 가능
  const inferred = safeGetLocalStorage(`${EXP_PREFIX}${HOME_LAYOUT_EXPERIMENT_KEY}`);
  const v = typeof inferred === "string" ? inferred.trim() : "";
  if (!v) return "";
  if (!v.startsWith("home_layout_")) return "";
  return v;
}

function inferActivationCtaBucket(explicitBucket) {
  const exp = typeof explicitBucket === "string" ? explicitBucket.trim() : "";
  if (exp) return exp;
  const inferred = safeGetLocalStorage(`${EXP_PREFIX}${ACTIVATION_CTA_EXPERIMENT_KEY}`);
  const v = typeof inferred === "string" ? inferred.trim() : "";
  if (!v) return "";
  if (!v.startsWith("activation_cta_")) return "";
  return v;
}

/**
 * activation funnel log (best-effort)
 *
 * 중복 방지:
 * - session memory(Set) 1회
 * - localStorage key 1회
 * - DB unique index: user_id|session_id 기준 1회
 *
 * @param {{
 *   eventName: string,
 *   userId?: string | null,
 *   experimentBucket?: string | null,
 *   activationCtaBucket?: string | null,
 *   completedBy?: string | null,
 *   appEnv?: string | null,
 *   source?: string | null,
 * }} args
 */
export function logActivationFunnelEvent({
  eventName,
  userId,
  experimentBucket = null,
  activationCtaBucket = null,
  completedBy = null,
  appEnv = null,
  source = null,
}) {
  const ev = String(eventName || "").trim();
  if (!ev) return;

  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;

  const dedupKey = buildDedupKey({
    eventName: ev,
    experimentBucket,
    activationCtaBucket,
    completedBy,
    appEnv,
  });
  if (_sessionDedup.has(dedupKey)) return;
  markSessionDedup(dedupKey);

  const lsKey = `${DEDUP_PREFIX}${dedupKey}`;
  if (shouldSkipByLocalStorageDedup(lsKey)) return;
  safeSetLocalStorage(lsKey, String(Date.now()));

  void (async () => {
    try {
      let resolvedUserId = userId;
      if (resolvedUserId === undefined) {
        const { data } = await supabase.auth.getUser();
        resolvedUserId = data?.user?.id ?? null;
      }

      const exp = inferExperimentBucket(experimentBucket);
      const cta = inferActivationCtaBucket(activationCtaBucket);
      const doneBy = typeof completedBy === "string" ? completedBy.trim() : "";
      const env = typeof appEnv === "string" ? appEnv.trim() : "";
      const src = typeof source === "string" ? source.trim() : "";

      const base = {
        event_name: ev,
        user_id: resolvedUserId,
        session_id: sessionId,
        source: src || null,
      };

      const withOptional = {
        ...base,
        ...(exp ? { experiment_bucket: exp } : {}),
        ...(cta ? { activation_cta_bucket: cta } : {}),
        ...(doneBy ? { completed_by: doneBy } : {}),
        ...(env ? { app_env: env } : {}),
      };

      let { error } = await supabase
        .from("activation_funnel_logs")
        .insert(withOptional);

      // 운영 롤아웃 중 컬럼이 없을 수 있어 best-effort로 재시도
      if (error && (exp || cta || doneBy || env) && isSchemaColumnError(error)) {
        ({ error } = await supabase.from("activation_funnel_logs").insert(base));
      }

      if (error && import.meta.env.DEV) {
        console.warn("activation_funnel_logs:", error.message);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("activation_funnel_logs:", e?.message || e);
      }
    }
  })();
}

