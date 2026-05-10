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
  curatorProfile,
  isEditingProfile,
  editProfile,
  setEditProfile,
  usernameError,
  profileEditAvatarFileRef,
  onProfileAvatarFileChange,
  onUsernameChange,
  onUpdateUsername,
  onSaveProfile,
  onCancelEdit,
  onEditProfile,
  stats,
  onEndLive,
  onOpenLiveConfirm,
  myPlacesCount,
  curatorStats,
  showOverlapPlacesList,
  setShowOverlapPlacesList,
  overlapSharedPlacesList,
  archiveExtInsights,
  archiveInsightsError,
}) {
  return (
    <div style={sectionInnerStyle}>
      <StudioArchiveProfileCard
        curatorProfile={curatorProfile}
        isEditingProfile={isEditingProfile}
        editProfile={editProfile}
        setEditProfile={setEditProfile}
        usernameError={usernameError}
        profileEditAvatarFileRef={profileEditAvatarFileRef}
        onProfileAvatarFileChange={onProfileAvatarFileChange}
        onUsernameChange={onUsernameChange}
        onUpdateUsername={onUpdateUsername}
        onSaveProfile={onSaveProfile}
        onCancelEdit={onCancelEdit}
        onEditProfile={onEditProfile}
        stats={stats}
        onEndLive={onEndLive}
        onOpenLiveConfirm={onOpenLiveConfirm}
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
        archiveExtInsights={archiveExtInsights}
        archiveInsightsError={archiveInsightsError}
      />
      <StudioArchiveGrowthTrendCard curatorStats={curatorStats} />
    </div>
  );
}
