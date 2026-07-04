import { supabase } from "./client";
import {
  ALPHA_SURVEY_VERSION,
  alphaSurveyHasAnyAnswer,
  normalizeAlphaSurveyAnswers,
} from "../config/alphaSurvey";

/**
 * @typedef {Object} AlphaSurveyResponseRow
 * @property {string} id
 * @property {string} user_id
 * @property {string} survey_version
 * @property {Record<string, unknown>} answers
 * @property {string|null} submitted_at
 * @property {string} created_at
 * @property {string} updated_at
 */

const SELECT_FIELDS =
  "id, user_id, survey_version, answers, submitted_at, created_at, updated_at";

/**
 * @param {string} userId
 * @param {string} [version]
 * @returns {Promise<AlphaSurveyResponseRow|null>}
 */
export async function fetchAlphaSurveyResponse(userId, version = ALPHA_SURVEY_VERSION) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const { data, error } = await supabase
    .from("alpha_survey_responses")
    .select(SELECT_FIELDS)
    .eq("user_id", uid)
    .eq("survey_version", version)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[alpha_survey] fetch:", error.message || error);
    }
    return null;
  }

  return data || null;
}

/**
 * 작성 중 자동 임시저장 — submitted_at 은 건드리지 않음(기존 제출 시각 유지).
 * @param {string} userId
 * @param {Record<string, unknown>} answers
 * @param {string} [version]
 */
export async function saveAlphaSurveyDraft(
  userId,
  answers,
  version = ALPHA_SURVEY_VERSION
) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { data: null, error: new Error("user id required") };
  }

  const normalized = normalizeAlphaSurveyAnswers(answers);
  if (!alphaSurveyHasAnyAnswer(normalized)) {
    return { data: null, error: null };
  }

  const existing = await fetchAlphaSurveyResponse(uid, version);
  const row = {
    user_id: uid,
    survey_version: version,
    answers: normalized,
    updated_at: new Date().toISOString(),
    submitted_at: existing?.submitted_at ?? null,
  };

  const { data, error } = await supabase
    .from("alpha_survey_responses")
    .upsert(row, { onConflict: "user_id,survey_version" })
    .select(SELECT_FIELDS)
    .single();

  return { data, error };
}

/**
 * 필수 항목 통과 후 제출 — submitted_at 갱신.
 * @param {string} userId
 * @param {Record<string, unknown>} answers
 * @param {string} [version]
 */
export async function submitAlphaSurveyResponse(
  userId,
  answers,
  version = ALPHA_SURVEY_VERSION
) {
  const uid = String(userId || "").trim();
  if (!uid) {
    return { data: null, error: new Error("user id required") };
  }

  const now = new Date().toISOString();
  const row = {
    user_id: uid,
    survey_version: version,
    answers: normalizeAlphaSurveyAnswers(answers),
    updated_at: now,
    submitted_at: now,
  };

  const { data, error } = await supabase
    .from("alpha_survey_responses")
    .upsert(row, { onConflict: "user_id,survey_version" })
    .select(SELECT_FIELDS)
    .single();

  return { data, error };
}

/** @deprecated submitAlphaSurveyResponse / saveAlphaSurveyDraft 사용 */
export async function upsertAlphaSurveyResponse(userId, answers, version) {
  return submitAlphaSurveyResponse(userId, answers, version);
}

/**
 * @param {AlphaSurveyResponseRow|null|undefined} row
 */
export function isAlphaSurveySubmitted(row) {
  return Boolean(row?.submitted_at);
}

/**
 * @param {string} [version]
 * @returns {Promise<AlphaSurveyResponseRow[]>}
 */
export async function fetchAllAlphaSurveyResponsesForAdmin(
  version = ALPHA_SURVEY_VERSION
) {
  const { data, error } = await supabase
    .from("alpha_survey_responses")
    .select(SELECT_FIELDS)
    .eq("survey_version", version)
    .order("updated_at", { ascending: false });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[alpha_survey] admin fetch:", error.message || error);
    }
    return [];
  }

  return Array.isArray(data) ? data : [];
}

/**
 * @param {string[]} userIds
 * @returns {Promise<Map<string, { display_name?: string|null, username?: string|null }>>}
 */
export async function fetchAlphaSurveyUserLabels(userIds) {
  const ids = [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;

  const [{ data: profiles }, { data: curators }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", ids),
    supabase
      .from("curators")
      .select("user_id, display_name, username, name")
      .in("user_id", ids),
  ]);

  for (const id of ids) {
    const cur = (curators || []).find((c) => c.user_id === id);
    const prof = (profiles || []).find((p) => p.id === id);
    map.set(id, {
      display_name:
        cur?.display_name || cur?.name || prof?.display_name || null,
      username: cur?.username || prof?.username || null,
    });
  }

  return map;
}

/**
 * @param {string} [version]
 */
export async function countAlphaSurveyResponses(version = ALPHA_SURVEY_VERSION) {
  const { count, error } = await supabase
    .from("alpha_survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("survey_version", version);

  if (error) return 0;
  return count || 0;
}

/**
 * @param {string} [version]
 */
export async function countSubmittedAlphaSurveyResponses(
  version = ALPHA_SURVEY_VERSION
) {
  const { count, error } = await supabase
    .from("alpha_survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("survey_version", version)
    .not("submitted_at", "is", null);

  if (error) return 0;
  return count || 0;
}
