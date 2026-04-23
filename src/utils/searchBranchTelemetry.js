/**
 * 검색 분기·결과 운영 로그 (콘솔).
 * 추천 이유·재정렬 로직은 여기 두지 않음.
 *
 * ## 운영 지표 우선순위 (로그 수집 후 집계)
 *
 * ### 1. 가장 먼저 — 핵심
 *
 * **`keyword_fallback` CTR vs `keyword_pure` CTR** (`place_click.searchClickPath`)
 *
 * - 동일 세션(`sessionId`)으로 `search_submit`과 `place_click`을 조인.
 * - **fallback CTR ≥ pure CTR (또는 비슷)** → 보조가 실제로 도움되는 편.
 * - **fallback CTR < pure** → 건수만 늘고 질·관련성은 떨어졌을 가능성 큼 → 보조 쿼리·교체 조건·랭킹 재검토.
 *
 * (참고: `ai_direct` CTR은 별 트랙으로 두고, 위 둘을 먼저 비교.)
 *
 * ### 2. 그다음 — 발동률
 *
 * **keyword 검색 중 `keywordAiFallback === true` 비율** (`search_submit`, `initialKind === keyword_search` 부분집합)
 *
 * - **20~35%**: 대체로 무난.
 * - **50% 이상**: keyword 분기가 과하게 빡세거나, `KEYWORD_SEARCH_FALLBACK_MIN_RESULTS`가 낮아서 자주 탄 경우 가능 → 규칙·threshold 재검토.
 *
 * ### 3. 같이 보면 좋은 것 — broad 의심
 *
 * **`resultDelta`는 큰데(또는 비율로 증가가 큰데) 해당 검색·세션의 CTR은 낮은 케이스**
 *
 * - 넓게 퍼와서 **개수는 늘었지만** 사용자가 잘 안 누르는 패턴 → **과도하게 broad한 보조 후보**가 섞였을 가능성.
 * - `search_submit`의 `resultDelta`, `preFallbackResultCount`와 같은 `sessionId`의 `place_click`을 함께 집계.
 *
 * ## 대시보드 패널 권장 이름 (우선순위와 동일 — “사용자 반응 → 구조 건강도 → 원인 추적 → 질”)
 *
 * 1. **searchClickPath별 상단 클릭** — 1~3위 비율 + pure vs fallback 해석 · 앱 `/admin/search-insights` · SQL `database/dashboard_click_rank_by_search_click_path.sql`
 * 2. **searchClickPath별 평균 clicked_rank** — 같은 페이지 · SQL `database/dashboard_avg_clicked_rank_by_search_click_path.sql`
 * 3. **submit 실보이 행 수 구간별 세션 CTR** — `search_logs.submit_user_visible_candidate_count`(1 / 2~3 / 4~6 / 7+) · SQL `database/dashboard_ctr_by_submit_visible_bucket.sql`
 * 4. **searchClickPath × 노출 구간 교차 세션 CTR** — 같은 페이지 다음 표 · SQL `database/dashboard_ctr_path_by_visible_bucket.sql` (`submit_initial_search_kind`, `submit_keyword_ai_fallback`) · UI 실험: `KEYWORD_FALLBACK_UI_MAX_ROWS` / `KEYWORD_FALLBACK_UI_MAX_ROWS_PRESETS`
 * 5. **Fallback Rate within keyword_search**
 * 6. **High resultDelta / low CTR sessions**
 * 7. **Quality diagnostics** — `qualityAvgTopScore` 등; 이후 태그 일치·broad 비율을 같은 패널로 확장.
 *
 * ### 다음 우선 집계 (로그만으로 가능)
 *
 * 1. **`clickedRank` 분포** — `searchClickPath`별 1~3위 클릭 비율 비교 (`keyword_pure` / `keyword_fallback` / `ai_direct`) **먼저**.
 * 2. **실보이 후보 수 대비 전환** — `place_click.userVisibleCandidateCount`를 분모/층화로 (파이프라인·엔진 풀과 **섞지 않음**).
 * 3. **fallback 교체 후 성과** — `search_submit.fallbackTriggered`·`qualityAvgTopScore`와 해당 세션 `place_click` CTR을 함께.
 *
 * ### 세 가지 “개수” — **CTR 해석 시 혼용 금지** (대시보드 이름도 최대한 다르게)
 *
 * | 로그 키 | 의미 | 대시보드 예시 라벨 |
 * |--------|------|-------------------|
 * | **`userVisibleCandidateCount`** (`place_click`) | 그 순간 사용자에게 **실제로 보이던** 후보 행 수(시트·리스트 실측) | “실보이 후보 수” / `Visible candidates at click` |
 * | **`pipelineScreenRowCount`** (`search_submit`) | 검색 직후 파이프라인이 **화면 슬롯에 올린** 행 수(예: 상위 N 슬라이스) | “파이프라인 화면 행 수” / `Pipeline UI row count` |
 * | **`engineScoredPoolSize`** (`search_submit`) | 점수 매긴 **엔진 후보 풀** 전체 건수 | “랭킹 풀 크기” / `Engine scored pool size` |
 *
 * - **같은 숫자여도 의미가 다를 수 있음.** 예: 풀 20 · 슬롯 5 · 시트 실측 4.
 * - **`resultCount`**(`search_submit`, 로그용 ID 배열 길이)는 위 셋과 별개 — **CTR 분모로 위 세 지표와 섞지 말 것.**
 * - `place_click`에서 실보이 수를 안 실었을 때만, 세션 스냅샷의 **`pipelineScreenRowCount`를 대리값**으로 쓸 수 있음(해석은 “실보이”가 아니라 “파이프라인 슬롯”에 가까움).
 *
 * ### `KEYWORD_FALLBACK_UI_MAX_ROWS` 운영 순서 (UI 상한 실험)
 *
 * 1. **기준선**: `KEYWORD_FALLBACK_UI_MAX_ROWS = 5`로 **2~3일** 로그 쌓기.
 * 2. **비교**: 이어서 **4 또는 6 중 하나만** 바꿔 **동일 지표**로 기간 맞춰 비교.
 * 3. **볼 지표** (`keyword_fallback` 중심):
 *    - **1~3위 클릭 비율** (`searchClickPath = keyword_fallback`)
 *    - **평균 `clicked_rank`**
 *    - **경로×노출 구간** 세션 CTR (`database/dashboard_ctr_path_by_visible_bucket.sql`)
 *    - **전체 fallback CTR** (fallback 세션·클릭 대비 pure·직행과 분리해 볼 것)
 *
 * **주의 (원인 분리)**: 실험 기간에는 **`KEYWORD_FALLBACK_UI_MAX_ROWS`만** 바꾸고 **`AI_PARSE_SEARCH_UI_MAX_ROWS`는 고정**한다. 둘을 동시에 바꾸면 효과 원인을 나눌 수 없다.
 */

import { HOME_SEARCH_KIND } from "./searchParser.js";

/**
 * keyword 직후 결과가 이보다 적으면 AI 파이프라인으로 1회 보조.
 * 운영 보면서 **2 / 3 / 4** 중 조정 (지역·DB 풍부도·니치 검색 비율에 따라).
 */
export const KEYWORD_SEARCH_FALLBACK_MIN_RESULTS = 3;

/**
 * keyword→AI **fallback** 직후 주변·지도·시트에 올리는 스코어 결과 **최대 행 수**.
 * 운영 순서·비교 지표는 파일 상단 JSDoc **`KEYWORD_FALLBACK_UI_MAX_ROWS` 운영 순서** 참고.
 */
export const KEYWORD_FALLBACK_UI_MAX_ROWS = 5;

/** 실험 후보 — 기준선 5 이후 **한 값만** 골라 `KEYWORD_FALLBACK_UI_MAX_ROWS`에 반영 (4 또는 6 등) */
export const KEYWORD_FALLBACK_UI_MAX_ROWS_PRESETS = Object.freeze([
  4, 5, 6, 7,
]);

/**
 * 처음부터 `ai_parse_search`로 들어온 검색의 UI 상한.
 * **fallback 상한 실험 기간에는 이 값을 바꾸지 말 것** — `KEYWORD_FALLBACK_UI_MAX_ROWS`만 조정해야 원인 분리 가능.
 */
export const AI_PARSE_SEARCH_UI_MAX_ROWS = 5;

/** 상위 N건 룰 점수(aiScore) 평균 — 건수만이 아닌 질 감시 1차 지표 */
export function summarizeSearchResultQualityForTelemetry(
  scoredPlaces,
  topN = 8
) {
  if (!Array.isArray(scoredPlaces) || scoredPlaces.length === 0) {
    return {
      qualitySampleSize: 0,
      qualityAvgTopScore: null,
      qualityTopMaxScore: null,
    };
  }
  const slice = scoredPlaces.slice(0, Math.min(topN, scoredPlaces.length));
  const scores = slice
    .map((p) => Number(p?.aiScore))
    .filter((n) => Number.isFinite(n));
  const qualityAvgTopScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : null;
  const qualityTopMaxScore =
    scores.length > 0 ? Math.round(Math.max(...scores) * 10) / 10 : null;
  return {
    qualitySampleSize: slice.length,
    qualityAvgTopScore,
    qualityTopMaxScore,
  };
}

/**
 * keyword 보조 검색 결과로 **교체**할지 — 건수 증가 + 상위 평균 점수가 악화되지 않을 때만.
 * (태그 일치·broad 비율은 이후 `shouldPreferFallbackSearchResults` 확장 지점.)
 */
export function shouldPreferFallbackSearchResults(preList, postList) {
  const pre = Array.isArray(preList) ? preList : [];
  const post = Array.isArray(postList) ? postList : [];
  if (post.length === 0) return false;
  if (post.length <= pre.length) return false;
  const preQ = summarizeSearchResultQualityForTelemetry(pre);
  const postQ = summarizeSearchResultQualityForTelemetry(post);
  if (
    preQ.qualityAvgTopScore != null &&
    postQ.qualityAvgTopScore != null &&
    postQ.qualityAvgTopScore < preQ.qualityAvgTopScore
  ) {
    return false;
  }
  return true;
}

/**
 * 검색 세션 직후 장소 클릭만 CTR 버킷에 넣기 (소스 화이트리스트).
 * @returns {"keyword_pure"|"keyword_fallback"|"ai_direct"|null}
 */
export function deriveSearchClickPath(clickSource, sessionId, submitSnapshot) {
  if (
    !sessionId ||
    !submitSnapshot?.sessionId ||
    String(submitSnapshot.sessionId) !== String(sessionId)
  ) {
    return null;
  }
  const src = String(clickSource || "");
  if (
    !/^(search_bar_submit|search_bar_submit_nearby|search_bar_submit_map|search_result)$/i.test(
      src
    )
  ) {
    return null;
  }
  if (submitSnapshot.initialKind === HOME_SEARCH_KIND.KEYWORD_SEARCH) {
    return submitSnapshot.fallbackTriggered ? "keyword_fallback" : "keyword_pure";
  }
  return "ai_direct";
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} [payload.event] — `search_submit` | `place_click` 등
 */
export function emitSearchTelemetry(payload) {
  console.log("[search-telemetry]", {
    ts: new Date().toISOString(),
    ...payload,
  });
}
