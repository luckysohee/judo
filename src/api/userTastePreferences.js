import { supabase } from "./client";

const EMPTY_ROW = {
  liquor_types: [],
  vibes: [],
  situations: [],
  regions: [],
  party_size: null,
  prefer_walkable: false,
  drink_frequency: null,
  drink_capacity: null,
  budget_per_person: null,
  out_time: null,
  anju_styles: [],
  onboarding_status: "pending",
};

const SELECT_FIELDS =
  "user_id, liquor_types, vibes, situations, regions, party_size, prefer_walkable, drink_frequency, drink_capacity, budget_per_person, out_time, anju_styles, onboarding_status";

/**
 * @typedef {object} UserTastePreferencesRow
 * @property {string} user_id
 * @property {string[]} liquor_types
 * @property {string[]} vibes
 * @property {string[]} situations
 * @property {string[]} regions
 * @property {number|null} party_size
 * @property {boolean} prefer_walkable
 * @property {string|null} drink_frequency
 * @property {string|null} drink_capacity
 * @property {string|null} budget_per_person
 * @property {string|null} out_time
 * @property {string[]} anju_styles
 * @property {'pending'|'completed'|'skipped'} onboarding_status
 */

function normalizeTasteRow(data, uid) {
  if (!data) {
    return { user_id: uid, ...EMPTY_ROW };
  }
  return {
    user_id: data.user_id,
    liquor_types: Array.isArray(data.liquor_types) ? data.liquor_types : [],
    vibes: Array.isArray(data.vibes) ? data.vibes : [],
    situations: Array.isArray(data.situations) ? data.situations : [],
    regions: Array.isArray(data.regions) ? data.regions : [],
    party_size:
      data.party_size != null && Number.isFinite(Number(data.party_size))
        ? Number(data.party_size)
        : null,
    prefer_walkable: Boolean(data.prefer_walkable),
    drink_frequency: data.drink_frequency ? String(data.drink_frequency) : null,
    drink_capacity: data.drink_capacity ? String(data.drink_capacity) : null,
    budget_per_person: data.budget_per_person
      ? String(data.budget_per_person)
      : null,
    out_time: data.out_time ? String(data.out_time) : null,
    anju_styles: Array.isArray(data.anju_styles) ? data.anju_styles : [],
    onboarding_status: data.onboarding_status || "pending",
  };
}

/**
 * @param {string} userId
 * @returns {Promise<UserTastePreferencesRow|null>}
 */
export async function fetchUserTastePreferences(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("user_taste_preferences")
    .select(SELECT_FIELDS)
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[user_taste_preferences] fetch:", error.message || error);
    }
    // 조회 실패 시 null → 설문 게이트가 영원히 안 뜨는 버그 방지
    return normalizeTasteRow(null, uid);
  }

  return normalizeTasteRow(data, uid);
}

/**
 * @param {string} userId
 * @param {Partial<UserTastePreferencesRow>} patch
 */
export async function upsertUserTastePreferences(userId, patch) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { data: null, error: new Error("user id required") };
  }

  const row = {
    user_id: uid,
    liquor_types: Array.isArray(patch.liquor_types) ? patch.liquor_types : [],
    vibes: Array.isArray(patch.vibes) ? patch.vibes : [],
    situations: Array.isArray(patch.situations) ? patch.situations : [],
    regions: Array.isArray(patch.regions) ? patch.regions : [],
    party_size:
      patch.party_size != null && Number.isFinite(Number(patch.party_size))
        ? Math.round(Number(patch.party_size))
        : null,
    prefer_walkable: Boolean(patch.prefer_walkable),
    drink_frequency: patch.drink_frequency
      ? String(patch.drink_frequency)
      : null,
    drink_capacity: patch.drink_capacity ? String(patch.drink_capacity) : null,
    budget_per_person: patch.budget_per_person
      ? String(patch.budget_per_person)
      : null,
    out_time: patch.out_time ? String(patch.out_time) : null,
    anju_styles: Array.isArray(patch.anju_styles) ? patch.anju_styles : [],
    onboarding_status: patch.onboarding_status || "completed",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_taste_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select(SELECT_FIELDS)
    .single();

  return { data: data ? normalizeTasteRow(data, uid) : null, error };
}
