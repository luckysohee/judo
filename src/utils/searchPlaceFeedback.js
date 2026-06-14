import { supabase } from "../lib/supabase";
import { normalizeKakaoPlaceId } from "./mergePickedPlaceWithCuratorCatalog.js";

/** 검색어 집계 키 — 소문자·공백 정리 (DB `normalized_query` 와 동일) */
export function normalizeQueryForFeedback(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isUuidLikeId(s) {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    )
  );
}

/**
 * 집계·스코어·클릭에 공통으로 쓰는 장소 키 (카카오 숫자 id 우선, 없으면 UUID 등).
 */
export function placeKeyForFeedback(place) {
  if (!place || typeof place !== "object") return "";
  const kid = normalizeKakaoPlaceId(place);
  if (kid) return String(kid);
  const raw = place.id ?? place.place_id ?? place.kakao_place_id;
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (isUuidLikeId(s)) return s.toLowerCase();
  return s;
}

/** `search_logs.search_results_ids` / merged id 목록 → feedback.place_key */
export function placeKeyFromSearchLogResultId(idStr) {
  const s = String(idStr || "").trim();
  if (!s) return "";
  if (isUuidLikeId(s)) return s.toLowerCase();
  if (s.startsWith("local_")) {
    const rest = s.slice(7).trim();
    return rest || s;
  }
  return s;
}

/** `parseSearchQuery` / facets → RPC `p_intent_tags` */
export function intentTagsFromFacets(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const parts = [];
  const push = (x) => {
    if (x == null) return;
    const t = String(x).trim();
    if (t) parts.push(t.slice(0, 64));
  };
  if (Array.isArray(parsed.keywords) && parsed.keywords.length) {
    for (const k of parsed.keywords) push(k);
  } else {
    push(parsed.region);
    push(parsed.alcohol);
    push(parsed.situation);
    push(parsed.vibe);
    push(parsed.food);
    if (Array.isArray(parsed.tags)) {
      for (const t of parsed.tags) push(t);
    }
  }
  const uniq = [...new Set(parts)];
  return uniq.length ? uniq.slice(0, 14) : null;
}

/**
 * 이전 검색들에서 쌓인 반응을 **작은 가산**(상한)으로만 반영.
 * CTR 단독 신뢰는 낮추고, behavior(클릭·저장·체크인 가중)는 log 로 눌러 과적합 방지.
 */
export function computeSearchFeedbackBoost(row) {
  if (!row || typeof row !== "object") return 0;
  const impr = Math.max(0, Number(row.impression_count) || 0);
  const clk = Math.max(0, Number(row.click_count) || 0);
  const sav = Math.max(0, Number(row.save_count) || 0);
  const chk = Math.max(0, Number(row.checkin_count) || 0);
  const behavior = clk * 1 + sav * 3 + chk * 5;
  const ctr = Math.max(0, Math.min(1, Number(row.ctr) || 0));
  const behPart = Math.min(4.2, Math.log1p(behavior) * 1.45);
  const ctrPart =
    impr >= 10
      ? Math.min(1.6, ctr * Math.log1p(impr) * 0.38)
      : impr >= 4
        ? ctr * 0.85
        : 0;
  const raw = behPart + ctrPart;
  return Math.round(Math.min(5.5, raw) * 10) / 10;
}

export async function fetchSearchFeedbackBoostMap(normalizedQuery) {
  const nq = String(normalizedQuery || "").trim();
  if (!nq) return {};
  const { data, error } = await supabase
    .from("search_place_feedback")
    .select(
      "place_key, impression_count, click_count, save_count, checkin_count, ctr, behavior_score"
    )
    .eq("normalized_query", nq)
    .limit(500);
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[search-feedback] fetch map:", error.message || error);
    }
    return {};
  }
  const out = {};
  for (const row of data || []) {
    const k = row?.place_key != null && String(row.place_key).trim();
    if (k) out[k] = row;
  }
  return out;
}

/**
 * 검색어별 `search_place_feedback`를 place_key로 합산 — 홈 큐레이터 칩 선발용.
 * @param {{ maxAgeDays?: number }} [opts]
 */
export async function fetchGlobalPlaceSearchEngagementMap(opts = {}) {
  const maxAgeDays = Math.max(7, Math.min(120, Number(opts.maxAgeDays) || 14));
  const since = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("search_place_feedback")
    .select("place_key, impression_count, click_count")
    .gte("updated_at", since)
    .limit(4000);
  if (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "[search-feedback] global engagement:",
        error.message || error
      );
    }
    return {};
  }
  const out = {};
  for (const row of data || []) {
    const k = row?.place_key != null ? String(row.place_key).trim() : "";
    if (!k) continue;
    const bucket = out[k] || { impressions: 0, clicks: 0 };
    bucket.impressions += Math.max(0, Number(row.impression_count) || 0);
    bucket.clicks += Math.max(0, Number(row.click_count) || 0);
    out[k] = bucket;
  }
  return out;
}

/** 노출·클릭 가중 — 클릭을 더 크게 */
export function computeSpotlightEngagementScore(impressions, clicks) {
  const impr = Math.max(0, Number(impressions) || 0);
  const clk = Math.max(0, Number(clicks) || 0);
  return clk * 2.5 + impr * 0.4;
}

export async function rpcIncrementSearchPlaceFeedbackImpressions({
  normalizedQuery,
  area,
  intentTags,
  placeKeys,
}) {
  const q = String(normalizedQuery || "").trim();
  const keys = (placeKeys || []).map((k) => String(k).trim()).filter(Boolean);
  if (!q || !keys.length) return;
  const { error } = await supabase.rpc(
    "increment_search_place_feedback_impressions",
    {
      p_normalized_query: q,
      p_area: area != null && String(area).trim() ? String(area).trim() : null,
      p_intent_tags: intentTags ?? null,
      p_place_keys: keys,
    }
  );
  if (error && import.meta.env.DEV) {
    console.warn("[search-feedback] impressions rpc:", error.message || error);
  }
}

export async function rpcIncrementSearchPlaceFeedbackClick({
  normalizedQuery,
  area,
  intentTags,
  placeKey,
}) {
  const q = String(normalizedQuery || "").trim();
  const pk = String(placeKey || "").trim();
  if (!q || !pk) return;
  const { error } = await supabase.rpc("increment_search_place_feedback_click", {
    p_normalized_query: q,
    p_area: area != null && String(area).trim() ? String(area).trim() : null,
    p_intent_tags: intentTags ?? null,
    p_place_key: pk,
  });
  if (error && import.meta.env.DEV) {
    console.warn("[search-feedback] click rpc:", error.message || error);
  }
}

export async function rpcIncrementSearchPlaceFeedbackSave({
  normalizedQuery,
  area,
  intentTags,
  placeKey,
  delta = 1,
}) {
  const q = String(normalizedQuery || "").trim();
  const pk = String(placeKey || "").trim();
  if (!q || !pk) return;
  const { error } = await supabase.rpc("increment_search_place_feedback_save", {
    p_normalized_query: q,
    p_area: area != null && String(area).trim() ? String(area).trim() : null,
    p_intent_tags: intentTags ?? null,
    p_place_key: pk,
    p_delta: delta,
  });
  if (error && import.meta.env.DEV) {
    console.warn("[search-feedback] save rpc:", error.message || error);
  }
}
