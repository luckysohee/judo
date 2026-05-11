import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import CuratorPicksStrip from "./CuratorPicksStrip";
import HomeCreateCollectionPrompt from "./HomeCreateCollectionPrompt";
import HomeCuratorActivityFeed from "./HomeCuratorActivityFeed";
import HomeHotCollectionsSection from "./HomeHotCollectionsSection";
import HomePersonalCollectionsSection from "./HomePersonalCollectionsSection";
import HomePublicCollectionsRail from "./HomePublicCollectionsRail";
import HomeRevisitCard from "./HomeRevisitCard";
import HomeSimilarUsersSection from "./HomeSimilarUsersSection";
import HomeSituationCollectionsSection from "./HomeSituationCollectionsSection";
import HomeTasteOnboarding from "./HomeTasteOnboarding";
import HomeVibeChipsSection from "./HomeVibeChipsSection";
import IntersectionMount from "../IntersectionMount";
import HomeFirstSessionActivationBlock from "./HomeFirstSessionActivationBlock";
import {
  getOrAssignExperimentBucket,
  HOME_LAYOUT_BUCKET,
  HOME_LAYOUT_BUCKETS,
  HOME_LAYOUT_EXPERIMENT_KEY,
} from "../../utils/experiments";

const MORE_REGION_ID = "home-search-above-more";

const HOME_SCOPE_STORAGE_KEY = "judo_home_scope_v1";
const HOME_SCOPE_ALL = "all";
const HOME_SCOPE_FOLLOWED = "followed";

function readPersistedHomeScope() {
  try {
    if (typeof window === "undefined") return HOME_SCOPE_ALL;
    const v = window.localStorage?.getItem(HOME_SCOPE_STORAGE_KEY);
    if (v === HOME_SCOPE_FOLLOWED || v === HOME_SCOPE_ALL) return v;
  } catch {
    /* storage 불가 환경 무시 */
  }
  return HOME_SCOPE_ALL;
}

/**
 * 검색바 바로 위쪽의 가벼운 헤더 묶음:
 * 1. `searchIdleHintText` 있을 때 떠오르는 힌트(role=status)
 * 2. `showCollectionsRail` 일 때 기본은 최대 2개만 노출 (모바일 상단 밀도 완화):
 *    - ① 지금 뜨는 코스
 *    - ② 로그인: 큐레이터 활동 피드 / 비로그인: 컬렉션 코스 레일
 *    그 다음 `HomeSituationCollectionsSection`으로 데이트·야장·소개팅·노포 등
 *    상황 탭 + 단일 태그 레일을 노출한다(결과 없는 탭은 숨김, 전부 없으면 섹션 미노출).
 *    featured 우선 정렬은 `fetchHomeCollectionsByTag` 가 처리한다.
 *    나머지(교차 섹션 · 큐레이터 픽)는 「더보기」로 접었다 펼친다.
 * 3. `showCollectionsRail` 이 꺼져 있고 스포트라이트만 있을 때는 기존처럼 픽 스트립 단독 노출.
 *
 * 표시/감추기 조건은 그대로 부모에서 계산해 props로 내려준다.
 * fetch·지도·검색 로직은 건드리지 않고 이 파일의 composition 만 조정한다.
 */
export default function HomeSearchAboveStrip({
  idleHintVisible,
  idleHintText,
  idleHintStyle,
  showCollectionsRail,
  showSpotlight,
  spotlightPlaces,
  onPickSpotlightPlace,
}) {
  const { user } = useAuth();
  const loggedIn = Boolean(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);
  const [homeScope, setHomeScope] = useState(readPersistedHomeScope);
  const [layoutBucket] = useState(() =>
    getOrAssignExperimentBucket(
      HOME_LAYOUT_EXPERIMENT_KEY,
      HOME_LAYOUT_BUCKETS,
      HOME_LAYOUT_BUCKET.V1,
    ),
  );
  const situationFirst = layoutBucket === HOME_LAYOUT_BUCKET.V2;

  // 비로그인이면 토글 의미 없음 → 자동으로 ALL 로 정렬(저장은 건드리지 않음).
  const effectiveHomeScope = loggedIn ? homeScope : HOME_SCOPE_ALL;
  const showHomeScopeToggle = loggedIn;

  useEffect(() => {
    if (!loggedIn) return;
    try {
      window?.localStorage?.setItem(HOME_SCOPE_STORAGE_KEY, homeScope);
    } catch {
      /* storage 불가 환경 무시 */
    }
  }, [homeScope, loggedIn]);

  const forcedScopeForFeed =
    effectiveHomeScope === HOME_SCOPE_FOLLOWED ? "followed" : "all";
  const followedOnlyForRail = effectiveHomeScope === HOME_SCOPE_FOLLOWED;

  const spotlightVisible =
    Boolean(showSpotlight) &&
    Array.isArray(spotlightPlaces) &&
    spotlightPlaces.length > 0;

  const moreSummaryLoggedIn = spotlightVisible
    ? "더보기 · 컬렉션 코스 · 큐레이터 픽"
    : "더보기 · 컬렉션 코스";
  const moreSummaryGuest = spotlightVisible
    ? "더보기 · 활동 피드 · 큐레이터 픽"
    : "더보기 · 활동 피드";

  return (
    <>
      {idleHintVisible && idleHintText ? (
        <div role="status" style={idleHintStyle}>
          {idleHintText}
        </div>
      ) : null}

      <HomeFirstSessionActivationBlock />

      {showCollectionsRail ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            width: "100%",
            marginBottom: 2,
          }}
        >
          {/* 0(top). 마지막 방문 이후 새 시그널이 있으면 lightweight 리텐션 카드 */}
          <HomeRevisitCard />
          {/* 0. 로그인 + 저장 ≥ N 일 때만 self-mount 되는 가벼운 CTA */}
          <HomeCreateCollectionPrompt />
          {/* 0b. 신규 유저 취향 온보딩 — dismissed 전까지만 노출 */}
          <HomeTasteOnboarding />
          {/* 0a. 로그인 사용자만: 「전체 / 내가 픽한 사람」 home scope 토글 */}
          {showHomeScopeToggle ? (
            <HomeScopeToggle
              value={effectiveHomeScope}
              onChange={setHomeScope}
            />
          ) : null}
          {/* ⓪ 로그인 + 저장 시그널 있을 때만 self-mount: 내 취향 기반 추천 */}
          <IntersectionMount minHeight={110}>
            <HomePersonalCollectionsSection />
          </IntersectionMount>
          {/* ⓪b 로그인 + overlap 시그널 있을 때만 self-mount: 비슷한 취향 사용자 픽 추천 */}
          <IntersectionMount minHeight={110}>
            <HomeSimilarUsersSection experimentBucket={layoutBucket} />
          </IntersectionMount>
          {/* ① 핵심: 지금 뜨는 코스 */}
          <IntersectionMount minHeight={180}>
            <HomeHotCollectionsSection experimentBucket={layoutBucket} />
          </IntersectionMount>
          {situationFirst ? (
            <>
              {/* v2: 상황 rail 우선 */}
              <IntersectionMount minHeight={170}>
                <HomeSituationCollectionsSection
                  railLimit={6}
                  experimentBucket={layoutBucket}
                />
              </IntersectionMount>
              {/* 그 다음: 활동 피드/공개 레일 */}
              {loggedIn ? (
                <IntersectionMount minHeight={170}>
                  <HomeCuratorActivityFeed
                    forcedScope={forcedScopeForFeed}
                    experimentBucket={layoutBucket}
                  />
                </IntersectionMount>
              ) : (
                <IntersectionMount minHeight={170}>
                  <HomePublicCollectionsRail experimentBucket={layoutBucket} />
                </IntersectionMount>
              )}
            </>
          ) : (
            <>
              {/* v1: 활동 피드 우선(기존) */}
              {loggedIn ? (
                <IntersectionMount minHeight={170}>
                  <HomeCuratorActivityFeed
                    forcedScope={forcedScopeForFeed}
                    experimentBucket={layoutBucket}
                  />
                </IntersectionMount>
              ) : (
                <IntersectionMount minHeight={170}>
                  <HomePublicCollectionsRail experimentBucket={layoutBucket} />
                </IntersectionMount>
              )}
              {/* 그 다음: 상황 rail */}
              <IntersectionMount minHeight={170}>
                <HomeSituationCollectionsSection
                  railLimit={6}
                  experimentBucket={layoutBucket}
                />
              </IntersectionMount>
            </>
          )}

          {/* ③b 분위기(vibe_caption) 진입 칩 — 매칭 0건이면 섹션 자동 히드 */}
          <IntersectionMount minHeight={110}>
            <HomeVibeChipsSection />
          </IntersectionMount>

          <button
            type="button"
            id="home-search-above-more-toggle"
            aria-expanded={moreOpen}
            aria-controls={MORE_REGION_ID}
            onClick={() => setMoreOpen((v) => !v)}
            style={styles.moreToggle}
          >
            <span style={styles.moreToggleLabel}>
              {moreOpen
                ? "접기"
                : loggedIn
                  ? moreSummaryLoggedIn
                  : moreSummaryGuest}
            </span>
            <span style={styles.moreToggleChevron} aria-hidden="true">
              {moreOpen ? "▲" : "▼"}
            </span>
          </button>

          {moreOpen ? (
            <div
              id={MORE_REGION_ID}
              role="region"
              aria-labelledby="home-search-above-more-toggle"
              style={styles.moreRegion}
            >
              <IntersectionMount minHeight={170} rootMargin="360px 0px">
                {loggedIn ? (
                  <HomePublicCollectionsRail
                    followedOnly={followedOnlyForRail}
                    experimentBucket={layoutBucket}
                  />
                ) : (
                  <HomeCuratorActivityFeed experimentBucket={layoutBucket} />
                )}
              </IntersectionMount>
              {spotlightVisible ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    width: "100%",
                    marginTop: 2,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <IntersectionMount minHeight={90} rootMargin="420px 0px">
                      <CuratorPicksStrip
                        places={spotlightPlaces}
                        visible
                        onPick={onPickSpotlightPlace}
                      />
                    </IntersectionMount>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 컬렉션 레일 묶음이 꺼져 있을 때만: 스포트라이트 단독 (기존 동작) */}
      {!showCollectionsRail && spotlightVisible ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            width: "100%",
            marginBottom: 4,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <CuratorPicksStrip
              places={spotlightPlaces}
              visible
              onPick={onPickSpotlightPlace}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * 「전체 / 내가 픽한 사람」 — 홈 상단 home scope 토글.
 *
 * 활동 피드(`HomeCuratorActivityFeed.forcedScope`) 와 공개 컬렉션 레일
 * (`HomePublicCollectionsRail.followedOnly`) 의 followed-bias 모드를 같은 source 로 제어.
 * 비로그인에서는 부모가 아예 렌더링하지 않는다.
 *
 * @param {{ value: 'all'|'followed', onChange: (next: 'all'|'followed') => void }} props
 */
function HomeScopeToggle({ value, onChange }) {
  const onAll = () => {
    if (value !== HOME_SCOPE_ALL) onChange?.(HOME_SCOPE_ALL);
  };
  const onFollowed = () => {
    if (value !== HOME_SCOPE_FOLLOWED) onChange?.(HOME_SCOPE_FOLLOWED);
  };
  return (
    <div
      role="tablist"
      aria-label="홈 피드 범위"
      style={styles.scopeToggleRow}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === HOME_SCOPE_ALL}
        onClick={onAll}
        style={{
          ...styles.scopeBtn,
          ...(value === HOME_SCOPE_ALL ? styles.scopeBtnActive : null),
        }}
      >
        전체
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === HOME_SCOPE_FOLLOWED}
        onClick={onFollowed}
        style={{
          ...styles.scopeBtn,
          ...(value === HOME_SCOPE_FOLLOWED ? styles.scopeBtnActive : null),
        }}
      >
        내가 픽한 사람
      </button>
    </div>
  );
}

const styles = {
  scopeToggleRow: {
    alignSelf: "stretch",
    display: "flex",
    gap: 4,
    padding: 3,
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  scopeBtn: {
    flex: 1,
    minWidth: 0,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid transparent",
    background: "transparent",
    color: "rgba(255,255,255,0.6)",
    borderRadius: 999,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    WebkitTapHighlightColor: "transparent",
    minHeight: 34,
  },
  scopeBtnActive: {
    background: "rgba(52,152,219,0.18)",
    borderColor: "rgba(52,152,219,0.55)",
    color: "#cfe6f7",
    boxShadow: "inset 0 0 0 1px rgba(52,152,219,0.2)",
  },
  moreToggle: {
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "6px 10px",
    marginTop: 2,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    minHeight: 36,
    boxSizing: "border-box",
  },
  moreToggleLabel: {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    lineHeight: 1.25,
  },
  moreToggleChevron: {
    flexShrink: 0,
    fontSize: 10,
    opacity: 0.75,
  },
  moreRegion: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    paddingTop: 2,
  },
};
