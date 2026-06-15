import { supabase } from "../lib/supabase";
import { getAnalyticsSupabase } from "../lib/analyticsSupabase";
import {
  normalizeTagsForSearchLog,
  primaryParsedFood,
} from "./searchTagNormalize.js";
import { emitSearchTelemetry } from "./searchBranchTelemetry.js";
import {
  normalizeQueryForFeedback,
  placeKeyForFeedback,
  rpcIncrementSearchPlaceFeedbackClick,
  rpcIncrementSearchPlaceFeedbackSave,
} from "./searchPlaceFeedback.js";

// ML·랭킹 학습 타이밍·ML 전 룰 전략: `searchPhase7Guidance.js`

export function getAnalyticsUserId(user) {
  return user?.id ? String(user.id) : "anonymous";
}

/** React `user`는 만료 JWT로 stale일 수 있음 — 서버 검증 세션만 신뢰 */
async function resolveAnalyticsUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) {
      return data.user;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 로그인·만료 JWT에 따라 analytics 요청 클라이언트 분리 */
function pickAnalyticsClient(analyticsUser) {
  if (analyticsUser?.id) return supabase;
  const bare = getAnalyticsSupabase();
  return bare || supabase;
}

function isMissingRpcError(error) {
  return /function.*does not exist|42883|PGRST202|Could not find the function/i.test(
    String(error?.message || error || "")
  );
}

async function insertSearchLogViaRpc(client, row) {
  const { data, error } = await client.rpc("insert_search_log_analytics", {
    p_row: row,
  });
  if (!error && data != null) {
    return String(data);
  }
  if (error && !isMissingRpcError(error) && import.meta.env.DEV) {
    console.warn(
      "[searchAnalytics] insert_search_log_analytics RPC:",
      error.message || error
    );
  }
  return isMissingRpcError(error) ? null : null;
}

async function insertPlaceClickViaRpc(client, row) {
  const { error } = await client.rpc("insert_place_click_log_analytics", {
    p_row: row,
  });
  if (!error) return true;
  if (error && !isMissingRpcError(error) && import.meta.env.DEV) {
    console.warn(
      "[searchAnalytics] insert_place_click_log_analytics RPC:",
      error.message || error
    );
  }
  return isMissingRpcError(error) ? false : false;
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
 * @returns {Promise<string|null>} `search_logs.id` (bigint면 문자열로) — 없으면 null
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
  if (!sessionId || !userQuery) return null;

  const analyticsUser = await resolveAnalyticsUser();
  const analyticsClient = pickAnalyticsClient(analyticsUser);

  const purpose =
    parsed?.situation ??
    parsed?.purposes?.[0] ??
    parsed?.food ??
    null;

  const row = {
    session_id: sessionId,
    user_query: userQuery,
    normalized_query: normalizeQueryForFeedback(userQuery),
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
    ...analyticsFlags(analyticsUser),
  };

  try {
    const rpcId = await insertSearchLogViaRpc(analyticsClient, row);
    if (rpcId) return rpcId;

    let { data, error } = await analyticsClient
      .from("search_logs")
      .insert(row)
      .select("id")
      .maybeSingle();
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
        normalized_query,
        ...legacyRow
      } = row;
      void parsed_food;
      void parsed_tags_normalized;
      void search_mode;
      void had_client_error;
      void submit_user_visible_candidate_count;
      void submit_initial_search_kind;
      void submit_keyword_ai_fallback;
      void normalized_query;
      const retry = await analyticsClient
        .from("search_logs")
        .insert(legacyRow)
        .select("id")
        .maybeSingle();
      error = retry.error;
      data = retry.data;
    }
    if (error) {
      if (import.meta.env.DEV) {
        console.warn(
          "[searchAnalytics] search_logs insert:",
          error.message || error
        );
      }
      return null;
    }
    return data?.id != null ? String(data.id) : null;
  } catch (e) {
    console.warn("[searchAnalytics] search_logs insert failed:", e);
    return null;
  }
}

export async function insertPlaceClickLog({
  sessionId,
  clickedPlaceId,
  clickedCuratorId,
  placeName,
  source = "map_click",
  user,
  /** `search_logs.id` — 검색-클릭 조인 */
  searchLogId = null,
  /** 원문 검색어(선택) */
  userQueryForLog = null,
  /** `normalizeQueryForFeedback` 결과(선택) */
  normalizedQueryForLog = null,
  /** 검색 세션 직후 클릭일 때만 RPC — `deriveSearchClickPath` 가 null 이 아닐 때 */
  searchFeedbackRpcArea = null,
  searchFeedbackRpcIntentTags = null,
  /** `keyword_pure` | `keyword_fallback` | `ai_direct` — 검색 CTR 버킷 (선택) */
  searchClickPath = null,
  /** 1-based 리스트·시트에서의 클릭 순번 (선택; DB `clicked_rank` + 콘솔 텔레메트리) */
  clickedRank = null,
  /** 실보이 후보 행 수 (선택; DB `user_visible_candidate_count`) */
  userVisibleCandidateCount = null,
}) {
  const pid = clickedPlaceId != null ? String(clickedPlaceId) : "";
  if (!pid) return;

  const analyticsUser = await resolveAnalyticsUser();
  const analyticsClient = pickAnalyticsClient(analyticsUser);

  const row = {
    clicked_place_id: pid,
    clicked_curator_id: clickedCuratorId != null ? String(clickedCuratorId) : null,
    place_name: placeName || "(unknown)",
    search_session_id: sessionId || null,
    search_log_id: searchLogId != null ? String(searchLogId) : null,
    user_query:
      userQueryForLog != null && String(userQueryForLog).trim()
        ? String(userQueryForLog).trim()
        : null,
    normalized_query:
      normalizedQueryForLog != null && String(normalizedQueryForLog).trim()
        ? String(normalizedQueryForLog).trim()
        : null,
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
    ...analyticsFlags(analyticsUser),
  };

  try {
    const rpcOk = await insertPlaceClickViaRpc(analyticsClient, row);
    let error = null;
    if (!rpcOk) {
      const res = await analyticsClient.from("place_click_logs").insert(row);
      error = res.error;
    }
    if (
      error &&
      /column|schema|does not exist|42703/i.test(String(error.message || error))
    ) {
      const {
        search_click_path,
        clicked_rank,
        user_visible_candidate_count,
        search_log_id,
        user_query,
        normalized_query,
        ...legacyRow
      } = row;
      void search_click_path;
      void clicked_rank;
      void user_visible_candidate_count;
      void search_log_id;
      void user_query;
      void normalized_query;
      const retry = await analyticsClient.from("place_click_logs").insert(legacyRow);
      error = retry.error;
    }
    if (error) {
      if (import.meta.env.DEV) {
        console.warn(
          "[searchAnalytics] place_click_logs insert:",
          error.message || error
        );
      }
    } else {
      if (
        searchClickPath &&
        normalizedQueryForLog &&
        String(normalizedQueryForLog).trim()
      ) {
        const pk = placeKeyForFeedback({ id: pid });
        if (pk) {
          void rpcIncrementSearchPlaceFeedbackClick({
            normalizedQuery: String(normalizedQueryForLog).trim(),
            area: searchFeedbackRpcArea,
            intentTags: searchFeedbackRpcIntentTags,
            placeKey: pk,
          });
        }
      }
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
export async function markSearchSessionBookmarked({
  sessionId,
  placeId,
  user,
  /** 검색어별 저장 집계 — `normalizedQuery` + `placeKey` 있을 때만 RPC */
  searchPlaceFeedback = null,
}) {
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

  const fq =
    searchPlaceFeedback?.normalizedQuery != null
      ? String(searchPlaceFeedback.normalizedQuery).trim()
      : "";
  const pk =
    searchPlaceFeedback?.placeKey != null
      ? String(searchPlaceFeedback.placeKey).trim()
      : "";
  if (fq && pk) {
    void rpcIncrementSearchPlaceFeedbackSave({
      normalizedQuery: fq,
      area: searchPlaceFeedback.area ?? null,
      intentTags: searchPlaceFeedback.intentTags ?? null,
      placeKey: pk,
      delta: 1,
    });
  }
}
