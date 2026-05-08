import CheckinRanking from "../CheckinRanking/CheckinRanking";
import MutualCheckinsHomeSection from "./MutualCheckinsHomeSection";

/**
 * 데스크톱(>= 1180px) 우측 고정 사이드 스택.
 * 체크인 랭킹 + 상호 체크인 섹션을 보여준다. 모바일에서는 헤더·지도와 겹치므로 숨김.
 */
export default function HomeDesktopSocialStack({
  visible,
  user,
  judoMode,
  onOpenPlaceDetail,
}) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        right: "20px",
        top: "76px",
        width: "280px",
        zIndex: 88,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: "calc(100vh - 88px)",
        alignItems: "stretch",
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <CheckinRanking position="sidebarStack" judoMode={judoMode} />
      </div>
      <div style={{ pointerEvents: "auto" }}>
        <MutualCheckinsHomeSection
          user={user}
          judoMode={judoMode}
          onOpenPlaceDetail={onOpenPlaceDetail}
        />
      </div>
    </div>
  );
}
