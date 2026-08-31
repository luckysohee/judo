import { supabase } from "./client";
import { LEGAL } from "../config/legal";

const LOCAL_KEY = "judo_legal_consent_v1";

/**
 * @param {string} userId
 * @returns {Promise<{ termsAccepted: boolean, termsVersion: string|null, termsAcceptedAt: string|null }>}
 */
export async function fetchLegalConsent(userId) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { termsAccepted: false, termsVersion: null, termsAcceptedAt: null };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("terms_accepted_at, terms_version, privacy_accepted_at")
      .eq("id", uid)
      .maybeSingle();

    if (!error && data) {
      return {
        termsAccepted: Boolean(data.terms_accepted_at),
        termsVersion: data.terms_version || null,
        termsAcceptedAt: data.terms_accepted_at || null,
      };
    }
  } catch {
    /* fall through to local */
  }

  try {
    const raw = localStorage.getItem(`${LOCAL_KEY}:${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        termsAccepted: Boolean(parsed?.termsAcceptedAt),
        termsVersion: parsed?.termsVersion || null,
        termsAcceptedAt: parsed?.termsAcceptedAt || null,
      };
    }
  } catch {
    /* ignore */
  }

  return { termsAccepted: false, termsVersion: null, termsAcceptedAt: null };
}

/**
 * @param {string} userId
 * @param {{ termsVersion?: string }} [opts]
 */
export async function recordLegalConsent(userId, opts = {}) {
  const uid = String(userId || "").trim();
  if (!uid) throw new Error("로그인이 필요해요.");

  const now = new Date().toISOString();
  const termsVersion = String(opts.termsVersion || LEGAL.termsVersion || "").trim();

  const payload = {
    terms_accepted_at: now,
    terms_version: termsVersion || LEGAL.termsVersion,
    privacy_accepted_at: now,
  };

  try {
    localStorage.setItem(
      `${LOCAL_KEY}:${uid}`,
      JSON.stringify({
        termsAcceptedAt: now,
        termsVersion: payload.terms_version,
      })
    );
  } catch {
    /* ignore */
  }

  const { error } = await supabase.from("profiles").update(payload).eq("id", uid);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[legalConsent] profile update:", error.message || error);
    }
    // 로컬 기록은 남김 — 컬럼 미적용 환경에서도 로그인 플로우 진행
  }

  return { termsAcceptedAt: now, termsVersion: payload.terms_version };
}
