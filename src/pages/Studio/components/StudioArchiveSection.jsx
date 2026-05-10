import React from "react";
import StudioArchiveProfileCard from "./StudioArchiveProfileCard";
import StudioArchiveStatsGrid from "./StudioArchiveStatsGrid";
import StudioArchiveOverlapPlacesPanel from "./StudioArchiveOverlapPlacesPanel";
import StudioArchiveInsightsSection from "./StudioArchiveInsightsSection";
import StudioArchiveGrowthTrendCard from "./StudioArchiveGrowthTrendCard";
import { studioArchiveStatStyles } from "./studioArchiveStyles";

/**
 * 잔 아카이브 탭 전체 — 프로필 · 통계 · 겹침 목록 · 인사이트 · 성장 추이.
 *
 * `statStyles`는 기본값으로 `studioArchiveStatStyles`를 쓰며, 테스트나 테마 오버라이드 시에만 넘기면 된다.
 */
export default function StudioArchiveSection({
  sectionInnerStyle,
  statStyles = studioArchiveStatStyles,
  profile,
  live,
  metrics,
  insights,
}) {
  const {
    myPlacesCount,
    curatorStats,
    showOverlapPlacesList,
    setShowOverlapPlacesList,
    overlapSharedPlacesList,
  } = metrics;

  return (
    <div style={sectionInnerStyle}>
      <StudioArchiveProfileCard
        {...profile}
        stats={live.stats}
        onEndLive={live.onEndLive}
        onOpenLiveConfirm={live.onOpenLiveConfirm}
      />
      <StudioArchiveStatsGrid
        statStyles={statStyles}
        myPlacesCount={myPlacesCount}
        curatorStats={curatorStats}
        showOverlapPlacesList={showOverlapPlacesList}
        setShowOverlapPlacesList={setShowOverlapPlacesList}
      />
      <StudioArchiveOverlapPlacesPanel
        show={showOverlapPlacesList}
        overlapSharedPlacesList={overlapSharedPlacesList}
        overlapSharedPlaceCount={curatorStats.overlapSharedPlaceCount ?? 0}
      />
      <StudioArchiveInsightsSection
        archiveExtInsights={insights.archiveExtInsights}
        archiveInsightsError={insights.archiveInsightsError}
      />
      <StudioArchiveGrowthTrendCard curatorStats={curatorStats} />
    </div>
  );
}
