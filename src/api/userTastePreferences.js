import { supabase } from "./client";

const EMPTY_ROW = {
  liquor_types: [],
  vibes: [],
  situations: [],
  regions: [],
  party_size: null,
  prefer_walkable: false,
  onboarding_status: "pending",
};

/**
 * @typedef {object} UserTastePreferencesRow
 * @property {string} user_id
 * @property {string[]} liquor_types
 * @property {string[]} vibes
 * @property {string[]} situations
 * @property {string[]} regions
 * @property {number|null} party_size
 * @property {boolean} prefer_walkable
 * @property {'pending'|'completed'|'skipped'} onboarding_status
 */

/**
 * @param {string} userId
 * @returns {Promise<UserTastePreferencesRow|null>}
 */
export async function fetchUserTastePreferences(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("user_taste_preferences")
    .select(
      "user_id, liquor_types, vibes, situations, regions, party_size, prefer_walkable, onboarding_status"
    )
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[user_taste_preferences] fetch:", error.message || error);
    }
    return null;
  }

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
    onboarding_status: data.onboarding_status || "pending",
  };
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
    onboarding_status: patch.onboarding_status || "completed",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_taste_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select(
      "user_id, liquor_types, vibes, situations, regions, party_size, prefer_walkable, onboarding_status"
    )
    .single();

  return { data, error };
}
