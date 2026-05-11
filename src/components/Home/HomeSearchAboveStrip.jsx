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
import HomeTasteOnboarding from "./HomeTasteOnboarding";
import HomeVibeChipsSection from "./HomeVibeChipsSection";
import IntersectionMount from "../IntersectionMount";
import HomeFirstSessionActivationBlock from "./HomeFirstSessionActivationBlock";
import { ACTIVATION_EVENT, logActivationFunnelEvent } from "../../api/activationFunnelLogs";
import { isActivationCompleted, markActivationEvent, readActivationState } from "../../utils/activationState";
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
const COLLECTION_SHEET_TAB_PLACE = "place";
const COLLECTION_SHEET_TAB_HOT = "hot";
const COLLECTION_SHEET_TAB_SITUATION = "situation";
const SOCIAL_SHEET_TAB_SIMILAR = "similar";
const SOCIAL_SHEET_TAB_ACTIVITY = "activity";
const SITUATION_SEARCH_PRESETS = [
  { key: "firstMeal", label: "야장", emoji: "🥢" },
  { key: "secondRound", label: "노포", emoji: "🍺" },
  { key: "vibe", label: "분위기", emoji: "🍷" },
];

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
  onPickSituationSearchPreset,
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
  const [collectionSheetTab, setCollectionSheetTab] = useState(() =>
    situationFirst ? COLLECTION_SHEET_TAB_SITUATION : COLLECTION_SHEET_TAB_HOT,
  );
  const [socialSheetTab, setSocialSheetTab] = useState(SOCIAL_SHEET_TAB_SIMILAR);

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

  // activation funnel: first_home_view (best-effort, 1회)
  useEffect(() => {
    const s = readActivationState();
    if (isActivationCompleted(s)) return;
    // 로컬 state도 같이 찍어두면 UX/로그가 분리되지 않는다.
    markActivationEvent("first_home_view");
    logActivationFunnelEvent({
      eventName: ACTIVATION_EVENT.FIRST_HOME_VIEW,
      experimentBucket: layoutBucket,
      activationCtaBucket: null,
      appEnv: import.meta.env.MODE,
      source: "home",
    });
  }, [layoutBucket]);

  // outcome quality: D1 / D7 revisit (first_seen_at 기준)
  useEffect(() => {
    const s = readActivationState();
    const firstSeen = typeof s?.first_seen_at === "string" ? s.first_seen_at : "";
    if (!firstSeen) return;
    const ts = Date.parse(firstSeen);
    if (!Number.isFinite(ts)) return;
    const ageMs = Date.now() - ts;
    if (ageMs >= 24 * 60 * 60 * 1000) {
      logActivationFunnelEvent({
        eventName: ACTIVATION_EVENT.RETENTION_D1_REVISIT,
        experimentBucket: layoutBucket,
        activationCtaBucket: null,
        appEnv: import.meta.env.MODE,
        source: "home_revisit",
      });
    }
    if (ageMs >= 7 * 24 * 60 * 60 * 1000) {
      logActivationFunnelEvent({
        eventName: ACTIVATION_EVENT.RETENTION_D7_REVISIT,
        experimentBucket: layoutBucket,
        activationCtaBucket: null,
        appEnv: import.meta.env.MODE,
        source: "home_revisit",
      });
    }
  }, [layoutBucket]);

  const forcedScopeForFeed =
    effectiveHomeScope === HOME_SCOPE_FOLLOWED ? "followed" : "all";
  const followedOnlyForRail = effectiveHomeScope === HOME_SCOPE_FOLLOWED;

  const spotlightVisible =
    Boolean(showSpotlight) &&
    Array.isArray(spotlightPlaces) &&
    spotlightPlaces.length > 0;

  const moreSummaryLoggedIn = "더보기 · 컬렉션 코스";
  const moreSummaryGuest = "더보기 · 활동 피드";

  return (
    <>
      {idleHintVisible && idleHintText ? (
        <div role="status" style={idleHintStyle}>
          {idleHintText}
        </div>
      ) : null}

      <HomeFirstSessionActivationBlock
        experimentBucket={layoutBucket}
        appEnv={import.meta.env.MODE}
      />

      {spotlightVisible ? (
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
          {/* ⓪b 소셜 시트: 비슷한 취향 사람 / 큐레이터 활동 탭 통합 */}
          <IntersectionMount minHeight={150}>
            <section style={styles.socialTabbedSheet} aria-label="소셜 탐색 시트">
              <div
                style={styles.socialTabbedHeader}
                role="tablist"
                aria-label="소셜 탐색 탭"
              >
                <button
                  type="button"
                  onClick={() => setSocialSheetTab(SOCIAL_SHEET_TAB_SIMILAR)}
                  style={{
                    ...styles.socialTabBtn,
                    ...(socialSheetTab === SOCIAL_SHEET_TAB_SIMILAR
                      ? styles.socialTabBtnActive
                      : null),
                  }}
                  aria-selected={socialSheetTab === SOCIAL_SHEET_TAB_SIMILAR}
                  role="tab"
                >
                  취향이 비슷한 사람
                </button>
                <button
                  type="button"
                  onClick={() => setSocialSheetTab(SOCIAL_SHEET_TAB_ACTIVITY)}
                  style={{
                    ...styles.socialTabBtn,
                    ...(socialSheetTab === SOCIAL_SHEET_TAB_ACTIVITY
                      ? styles.socialTabBtnActive
                      : null),
                  }}
                  aria-selected={socialSheetTab === SOCIAL_SHEET_TAB_ACTIVITY}
                  role="tab"
                >
                  지금 큐레이터 활동
                </button>
              </div>
              <div style={styles.socialTabbedBody}>
                {socialSheetTab === SOCIAL_SHEET_TAB_SIMILAR ? (
                  <HomeSimilarUsersSection
                    experimentBucket={layoutBucket}
                    hideHeader
                  />
                ) : (
                  <HomeCuratorActivityFeed
                    forcedScope={forcedScopeForFeed}
                    experimentBucket={layoutBucket}
                    hideHeader
                  />
                )}
              </div>
            </section>
          </IntersectionMount>
          {/* ① 핵심 시트: 지금 뜨는 코스 / 오늘 어울리는 코스 탭 통합 */}
          <IntersectionMount minHeight={210}>
            <section style={styles.collectionTabbedSheet} aria-label="코스 탐색 시트">
              <div
                style={styles.collectionTabbedHeader}
                role="tablist"
                aria-label="코스 시트 탭"
              >
                <button
                  type="button"
                  onClick={() => setCollectionSheetTab(COLLECTION_SHEET_TAB_PLACE)}
                  style={{
                    ...styles.collectionTabBtn,
                    ...(collectionSheetTab === COLLECTION_SHEET_TAB_PLACE
                      ? styles.collectionTabBtnActive
                      : null),
                  }}
                  aria-selected={collectionSheetTab === COLLECTION_SHEET_TAB_PLACE}
                  role="tab"
                >
                  지금 뜨는 장소
                </button>
                <button
                  type="button"
                  onClick={() => setCollectionSheetTab(COLLECTION_SHEET_TAB_HOT)}
                  style={{
                    ...styles.collectionTabBtn,
                    ...(collectionSheetTab === COLLECTION_SHEET_TAB_HOT
                      ? styles.collectionTabBtnActive
                      : null),
                  }}
                  aria-selected={collectionSheetTab === COLLECTION_SHEET_TAB_HOT}
                  role="tab"
                >
                  지금 뜨는 코스
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCollectionSheetTab(COLLECTION_SHEET_TAB_SITUATION)
                  }
                  style={{
                    ...styles.collectionTabBtn,
                    ...(collectionSheetTab === COLLECTION_SHEET_TAB_SITUATION
                      ? styles.collectionTabBtnActive
                      : null),
                  }}
                  aria-selected={collectionSheetTab === COLLECTION_SHEET_TAB_SITUATION}
                  role="tab"
                >
                  오늘 어울리는 코스
                </button>
              </div>
              <div style={styles.collectionTabbedBody}>
                {collectionSheetTab === COLLECTION_SHEET_TAB_PLACE ? (
                  spotlightVisible ? (
                    <CuratorPicksStrip
                      places={spotlightPlaces}
                      visible
                      onPick={onPickSpotlightPlace}
                    />
                  ) : (
                    <div style={styles.situationCompactCard}>
                      <div style={styles.situationCompactTitle}>지금 뜨는 장소</div>
                      <div style={styles.situationCompactSub}>
                        곧 인기 장소가 채워질 예정이에요.
                      </div>
                    </div>
                  )
                ) : collectionSheetTab === COLLECTION_SHEET_TAB_HOT ? (
                  <HomeHotCollectionsSection experimentBucket={layoutBucket} />
                ) : (
                  <section
                    style={styles.situationCompactCard}
                    aria-label="오늘 어울리는 코스 검색 프리셋"
                  >
                    <div style={styles.situationCompactTitle}>오늘 어울리는 코스</div>
                    <div style={styles.situationCompactSub}>
                      칩을 누르면 검색바에 반영되고 결과 시트가 열려요.
                    </div>
                    <div style={styles.situationCompactChipRow}>
                      {SITUATION_SEARCH_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          style={styles.situationCompactChip}
                          onClick={() =>
                            onPickSituationSearchPreset?.(preset.key)
                          }
                          aria-label={`${preset.label} 코스 검색`}
                        >
                          <span style={styles.situationCompactChipEmoji} aria-hidden>
                            {preset.emoji}
                          </span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </section>
          </IntersectionMount>

          {!loggedIn ? (
            <IntersectionMount minHeight={170}>
              <HomePublicCollectionsRail experimentBucket={layoutBucket} />
            </IntersectionMount>
          ) : null}

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
            </div>
          ) : null}
        </div>
      ) : null}

      {/* collections rail off 상태에서는 별도 탭 시트를 렌더하지 않음 */}
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
  collectionTabbedSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "calc(100% + 12px)",
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(20,20,20,0.88)",
    overflow: "hidden",
    zIndex: 220,
    boxShadow: "0 14px 30px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  collectionTabbedHeader: {
    display: "flex",
    gap: 6,
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  collectionTabBtn: {
    flex: 1,
    minWidth: 0,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.68)",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  collectionTabBtnActive: {
    border: "1px solid rgba(46,204,113,0.55)",
    background: "rgba(46,204,113,0.16)",
    color: "#d4f4dd",
  },
  socialTabbedSheet: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(20,20,20,0.78)",
    overflow: "hidden",
  },
  socialTabbedHeader: {
    display: "flex",
    gap: 6,
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  socialTabBtn: {
    flex: 1,
    minWidth: 0,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.68)",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  socialTabBtnActive: {
    border: "1px solid rgba(52,152,219,0.55)",
    background: "rgba(52,152,219,0.16)",
    color: "#cfe6f7",
  },
  socialTabbedBody: {
    padding: "8px",
  },
  collectionTabbedBody: {
    padding: "8px",
  },
  situationCompactCard: {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    padding: "10px 10px 11px",
  },
  situationCompactTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(255,255,255,0.94)",
    marginBottom: 3,
    letterSpacing: "-0.01em",
  },
  situationCompactSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.62)",
    marginBottom: 8,
    lineHeight: 1.35,
  },
  situationCompactChipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  situationCompactChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 10px",
    cursor: "pointer",
    minHeight: 32,
    WebkitTapHighlightColor: "transparent",
  },
  situationCompactChipEmoji: {
    fontSize: 13,
    lineHeight: 1,
  },
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
