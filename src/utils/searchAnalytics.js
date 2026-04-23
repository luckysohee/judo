import { supabase } from "../lib/supabase";
import {
  normalizeTagsForSearchLog,
  primaryParsedFood,
} from "./searchTagNormalize.js";
import { emitSearchTelemetry } from "./searchBranchTelemetry.js";

// ML·랭킹 학습 타이밍·ML 전 룰 전략: `searchPhase7Guidance.js`

export function getAnalyticsUserId(user) {
  return user?.id ? String(user.id) : "anonymous";
}

function analyticsFlags(user) {
  const uid = getAnalyticsUserId(user);
  return {
    user_id: uid,
    is_logged_in: Boolean(user?.id),
    user_type: user?.id ? "registered" : "anonymous",
  };
}

/**
 * 검색 직후 1행 적재. 실패해도 UX에 영향 없음.
 */
export async function insertSearchLog({
  sessionId,
  userQuery,
  parsed,
  searchResultsIds,
  hasResults,
  user,
  searchMode = null,
  hadClientError = false,
  /** 검색 직후 첫 화면 후보 행 수 — 구간 CTR용 (`submit_user_visible_candidate_count`) */
  submitUserVisibleCandidateCount = null,
  /** `keyword_search` | `ai_parse_search` — 교차 CTR용 */
  submitInitialSearchKind = null,
  submitKeywordAiFallback = false,
}) {
  if (!sessionId || !userQuery) return;

  const purpose =
    parsed?.situation ??
    parsed?.purposes?.[0] ??
    parsed?.food ??
    null;

  const row = {
    session_id: sessionId,
    user_query: userQuery,
    parsed_region: parsed?.region ?? null,
    parsed_alcohol: parsed?.alcohol ?? null,
    parsed_vibe: parsed?.vibe ?? null,
    parsed_purpose: purpose,
    parsed_food: primaryParsedFood(parsed),
    parsed_tags_normalized: normalizeTagsForSearchLog(parsed),
    search_mode: searchMode,
    had_client_error: Boolean(hadClientError),
    search_results_ids: Array.isArray(searchResultsIds) ? searchResultsIds.map(String) : [],
    has_results: Boolean(hasResults),
    results_count: Array.isArray(searchResultsIds) ? searchResultsIds.length : 0,
    bookmarked: false,
    submit_user_visible_candidate_count:
      Number.isFinite(submitUserVisibleCandidateCount) &&
      submitUserVisibleCandidateCount >= 0
        ? Math.round(submitUserVisibleCandidateCount)
        : null,
    submit_initial_search_kind:
      typeof submitInitialSearchKind === "string" &&
      String(submitInitialSearchKind).trim()
        ? String(submitInitialSearchKind).trim()
        : null,
    submit_keyword_ai_fallback: Boolean(submitKeywordAiFallback),
    ...analyticsFlags(user),
  };

  try {
    let { error } = await supabase.from("search_logs").insert(row);
    if (
      error &&
      /column|schema|does not exist|42703/i.test(String(error.message || error))
    ) {
      const {
        parsed_food,
        parsed_tags_normalized,
        search_mode,
        had_client_error,
        submit_user_visible_candidate_count,
        submit_initial_search_kind,
        submit_keyword_ai_fallback,
        ...legacyRow
      } = row;
      void parsed_food;
      void parsed_tags_normalized;
      void search_mode;
      void had_client_error;
      void submit_user_visible_candidate_count;
      void submit_initial_search_kind;
      void submit_keyword_ai_fallback;
      const retry = await supabase.from("search_logs").insert(legacyRow);
      error = retry.error;
    }
    if (error) {
      console.warn("[searchAnalytics] search_logs insert:", error.message || error);
    }
  } catch (e) {
    console.warn("[searchAnalytics] search_logs insert failed:", e);
  }
}

export async function insertPlaceClickLog({
  sessionId,
  clickedPlaceId,
  clickedCuratorId,
  placeName,
  source = "map_click",
  user,
  /** `keyword_pure` | `keyword_fallback` | `ai_direct` — 검색 CTR 버킷 (선택) */
  searchClickPath = null,
  /** 1-based 리스트·시트에서의 클릭 순번 (선택; DB `clicked_rank` + 콘솔 텔레메트리) */
  clickedRank = null,
  /** 실보이 후보 행 수 (선택; DB `user_visible_candidate_count`) */
  userVisibleCandidateCount = null,
}) {
  const pid = clickedPlaceId != null ? String(clickedPlaceId) : "";
  if (!pid) return;

  const row = {
    clicked_place_id: pid,
    clicked_curator_id: clickedCuratorId != null ? String(clickedCuratorId) : null,
    place_name: placeName || "(unknown)",
    search_session_id: sessionId || null,
    source,
    search_click_path: searchClickPath || null,
    clicked_rank:
      Number.isFinite(clickedRank) && clickedRank > 0
        ? Math.round(clickedRank)
        : null,
    user_visible_candidate_count:
      Number.isFinite(userVisibleCandidateCount) &&
      userVisibleCandidateCount >= 0
        ? Math.round(userVisibleCandidateCount)
        : null,
    ...analyticsFlags(user),
  };

  try {
    let { error } = await supabase.from("place_click_logs").insert(row);
    if (
      error &&
      /column|schema|does not exist|42703/i.test(String(error.message || error))
    ) {
      const {
        search_click_path,
        clicked_rank,
        user_visible_candidate_count,
        ...legacyRow
      } = row;
      void search_click_path;
      void clicked_rank;
      void user_visible_candidate_count;
      const retry = await supabase.from("place_click_logs").insert(legacyRow);
      error = retry.error;
    }
    if (error) {
      console.warn("[searchAnalytics] place_click_logs insert:", error.message || error);
    } else {
      emitSearchTelemetry({
        event: "place_click",
        sessionId: sessionId || null,
        clickedPlaceId: pid,
        source,
        placeName: placeName || "(unknown)",
        searchClickPath: searchClickPath || null,
        clickedRank:
          Number.isFinite(clickedRank) && clickedRank > 0
            ? Math.round(clickedRank)
            : null,
        userVisibleCandidateCount:
          Number.isFinite(userVisibleCandidateCount) &&
          userVisibleCandidateCount >= 0
            ? Math.round(userVisibleCandidateCount)
            : null,
      });
    }
  } catch (e) {
    console.warn("[searchAnalytics] place_click_logs insert failed:", e);
  }
}

/**
 * 저장 완료 시 해당 검색 세션의 전환 표시 (user_saved_places.search_session_id 는 SaveModal upsert에서 설정).
 */
export async function markSearchSessionBookmarked({ sessionId, placeId, user }) {
  if (!sessionId || !user?.id) return;

  try {
    const { error: updErr } = await supabase
      .from("search_logs")
      .update({
        bookmarked: true,
        bookmarked_place_id: placeId != null ? String(placeId) : null,
      })
      .eq("session_id", sessionId)
      .eq("user_id", String(user.id));

    if (updErr) {
      console.warn("[searchAnalytics] search_logs bookmark update:", updErr.message || updErr);
    }
  } catch (e) {
    console.warn("[searchAnalytics] search_logs bookmark update failed:", e);
  }
}
