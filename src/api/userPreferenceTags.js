import { supabase } from "./client";
import {
  dedupeAndNormalizeCollectionTags,
  normalizeCollectionTag,
} from "../utils/collectionTags";
import { TASTE_ONBOARDING_OPTION_SET } from "../constants/tasteOnboarding";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 온보딩에서만 허용된 태그만 남기고 정규화·중복 제거.
 *
 * @param {unknown[]} raw
 * @returns {string[]}
 */
export function sanitizePreferenceTagsForSave(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const x of raw) {
    const n = normalizeCollectionTag(typeof x === "string" ? x : String(x ?? ""));
    if (!n || !TASTE_ONBOARDING_OPTION_SET.has(n)) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

/**
 * @param {string} userId
 * @returns {Promise<{ preference_tags: string[], taste_onboarding_dismissed_at: string | null } | null>}
 */
export async function fetchProfileTastePreferences(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid || !UUID_RE.test(uid)) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("preference_tags, taste_onboarding_dismissed_at")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    const tags = dedupeAndNormalizeCollectionTags(data?.preference_tags);
    return {
      preference_tags: tags,
      taste_onboarding_dismissed_at:
        data?.taste_onboarding_dismissed_at != null
          ? String(data.taste_onboarding_dismissed_at)
          : null,
    };
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchProfileTastePreferences:", e?.message || e);
    }
    return null;
  }
}

/**
 * 온보딩 저장: 태그 저장 + dismissed 시각 기록.
 *
 * @param {string} userId
 * @param {string[]} preferenceTags — `sanitizePreferenceTagsForSave` 통과 권장
 */
export async function saveTasteOnboardingSelection(userId, preferenceTags) {
  const uid = String(userId ?? "").trim();
  if (!uid || !UUID_RE.test(uid)) {
    throw new Error("saveTasteOnboardingSelection: invalid user id");
  }
  const tags = sanitizePreferenceTagsForSave(preferenceTags);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      preference_tags: tags,
      taste_onboarding_dismissed_at: now,
    })
    .eq("id", uid);
  if (error) throw error;
}

/**
 * 온보딩 건너뛰기 — 태그는 건드리지 않고 dismissed 만 기록.
 *
 * @param {string} userId
 */
export async function dismissTasteOnboarding(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid || !UUID_RE.test(uid)) {
    throw new Error("dismissTasteOnboarding: invalid user id");
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ taste_onboarding_dismissed_at: now })
    .eq("id", uid);
  if (error) throw error;
}
