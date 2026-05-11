import { supabase } from "./client";

/**
 * 공개 컬렉션 성과 카드용 경량 집계.
 *
 * - `like_count` / `save_count`: `collections` 한 번의 SELECT 에 임베디드 count 로 묶어
 *   1 round-trip (`fetchCollectionSocialState` 와 같은 트릭).
 * - `recent_save_count`: 최근 7일 신규 저장 수 (`collection_saves` head=count=exact).
 * - `click_count` / `recent_click_count`: `collection_interaction_logs` 의
 *   `event_type='collection_open'` count. 권한·테이블 없음 등 실패 시 `null` 로 떨어지고
 *   호출자가 패널 전체를 살아남게 처리한다.
 *
 * 검색·지도·체크인 파이프라인과 무관한 read-only 헬퍼.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RECENT_WINDOW_DAYS = 7;
const CLICK_WINDOW_DAYS = 30;

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoNDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * @param {string} collectionId
 * @returns {Promise<{
 *   like_count: number,
 *   save_count: number,
 *   recent_save_count: number,
 *   click_count: number | null,
 *   recent_click_count: number | null,
 * }>}
 */
export async function fetchCollectionPerformance(collectionId) {
  const cid = String(collectionId ?? "").trim();
  if (!cid || !UUID_RE.test(cid)) {
    return {
      like_count: 0,
      save_count: 0,
      recent_save_count: 0,
      click_count: null,
      recent_click_count: null,
    };
  }

  const recentSinceIso = isoNDaysAgo(RECENT_WINDOW_DAYS);
  const clickSinceIso = isoNDaysAgo(CLICK_WINDOW_DAYS);

  const countsPromise = supabase
    .from("collections")
    .select(
      `
      id,
      likes_agg:collection_likes(count),
      saves_agg:collection_saves(count)
    `,
    )
    .eq("id", cid)
    .maybeSingle();

  const recentSavesPromise = supabase
    .from("collection_saves")
    .select("id", { head: true, count: "exact" })
    .eq("collection_id", cid)
    .gte("created_at", recentSinceIso);

  const clickCountPromise = supabase
    .from("collection_interaction_logs")
    .select("id", { head: true, count: "exact" })
    .eq("collection_id", cid)
    .eq("event_type", "collection_open")
    .gte("created_at", clickSinceIso);

  const recentClickPromise = supabase
    .from("collection_interaction_logs")
    .select("id", { head: true, count: "exact" })
    .eq("collection_id", cid)
    .eq("event_type", "collection_open")
    .gte("created_at", recentSinceIso);

  const [countsRes, recentSavesRes, clickRes, recentClickRes] =
    await Promise.all([
      countsPromise,
      recentSavesPromise,
      clickCountPromise,
      recentClickPromise,
    ]);

  let like_count = 0;
  let save_count = 0;
  if (!countsRes.error && countsRes.data) {
    const likesEmbed = Array.isArray(countsRes.data.likes_agg)
      ? countsRes.data.likes_agg
      : [];
    const savesEmbed = Array.isArray(countsRes.data.saves_agg)
      ? countsRes.data.saves_agg
      : [];
    like_count = likesEmbed.length > 0 ? safeNumber(likesEmbed[0]?.count) : 0;
    save_count = savesEmbed.length > 0 ? safeNumber(savesEmbed[0]?.count) : 0;
  } else if (import.meta?.env?.DEV && countsRes.error) {
    console.warn(
      "fetchCollectionPerformance counts:",
      countsRes.error.message || countsRes.error,
    );
  }

  const recent_save_count =
    !recentSavesRes.error && typeof recentSavesRes.count === "number"
      ? recentSavesRes.count
      : 0;

  const click_count =
    !clickRes.error && typeof clickRes.count === "number"
      ? clickRes.count
      : null;

  const recent_click_count =
    !recentClickRes.error && typeof recentClickRes.count === "number"
      ? recentClickRes.count
      : null;

  if (import.meta?.env?.DEV) {
    if (clickRes.error) {
      console.warn(
        "fetchCollectionPerformance click_count:",
        clickRes.error.message || clickRes.error,
      );
    }
    if (recentClickRes.error) {
      console.warn(
        "fetchCollectionPerformance recent_click_count:",
        recentClickRes.error.message || recentClickRes.error,
      );
    }
  }

  return {
    like_count,
    save_count,
    recent_save_count,
    click_count,
    recent_click_count,
  };
}
