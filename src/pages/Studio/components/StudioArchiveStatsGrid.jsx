import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * 잔 아카이브 — 큐레이터 통계 2×2 (잔 기록 · 겹친 장소 · 잔 반응 · picked/picks).
 */
export default function StudioArchiveStatsGrid({
  statStyles,
  myPlacesCount,
  curatorStats,
  showOverlapPlacesList,
  setShowOverlapPlacesList,
}) {
  const navigate = useNavigate();
  const s = statStyles;

  return (
    <div style={s.archiveStatsGrid} role="region" aria-label="큐레이터 통계">
      <div style={s.archiveStatCell} title="공개·비공개 포함 잔 기록 수">
        <div style={s.archiveStatValue}>{myPlacesCount}</div>
        <div style={s.archiveStatLabel}>잔 기록</div>
        <div style={s.archiveStatSub}>공개·비공개 포함</div>
      </div>
      <button
        type="button"
        title="내 잔 중 다른 큐레이터도 올린 장소 — 탭하여 목록"
        aria-expanded={showOverlapPlacesList}
        aria-label={`겹친 장소 ${curatorStats.overlapSharedPlaceCount ?? 0}곳, 목록 ${showOverlapPlacesList ? "접기" : "펼치기"}`}
        onClick={() => setShowOverlapPlacesList((v) => !v)}
        style={{
          ...s.archiveStatCell,
          cursor: "pointer",
          width: "100%",
          margin: 0,
          font: "inherit",
          color: "inherit",
          textAlign: "center",
          WebkitAppearance: "none",
          appearance: "none",
        }}
      >
        <div style={s.archiveStatValue}>
          {curatorStats.overlapSharedPlaceCount ?? 0}
        </div>
        <div style={s.archiveStatLabel}>겹친 장소</div>
        <div style={s.archiveStatSub}>
          다른 큐레이터와 같은 곳
          {(curatorStats.overlapSharedPlaceCount ?? 0) > 0 ? " · 탭하여 목록" : ""}
        </div>
      </button>
      <div style={s.archiveStatCell} title="유저들이 내 추천 장소에 저장한 횟수">
        <div style={s.archiveStatValue}>{curatorStats.saveCount || 0}</div>
        <div style={s.archiveStatLabel}>잔 반응</div>
        <div style={s.archiveStatSub}>유저의 저장 횟수</div>
      </div>
      <button
        type="button"
        title="picked · picks 목록"
        aria-label={`picked ${curatorStats.followerCount || 0}명, picks ${curatorStats.followingCount || 0}명, 목록 보기`}
        onClick={() => navigate("/studio/followers")}
        style={{
          ...s.archiveStatCell,
          cursor: "pointer",
          width: "100%",
          margin: 0,
          font: "inherit",
          color: "inherit",
          textAlign: "center",
          WebkitAppearance: "none",
          appearance: "none",
        }}
      >
        <div style={s.archiveStatValue}>
          {curatorStats.followerCount || 0}
          <span style={{ opacity: 0.45, fontWeight: 600, margin: "0 2px" }}>
            ·
          </span>
          {curatorStats.followingCount || 0}
        </div>
        <div style={s.archiveStatLabel}>picked · picks</div>
        <div style={s.archiveStatSub}>탭하여 목록</div>
      </button>
    </div>
  );
}
