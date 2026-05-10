import React from "react";
import { useNavigate } from "react-router-dom";

const cornerBtnStyle = {
  minHeight: "34px",
  height: "34px",
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
  lineHeight: 1.2,
  boxSizing: "border-box",
  border: "none",
  color: "white",
  whiteSpace: "nowrap",
};

/**
 * 좌측 상단 네비 · @username 헤더 · 스튜디오 섹션 탭.
 */
export default function StudioTopChrome({
  username,
  activeSection,
  chromeStyles,
  onSelectAdd,
  onSelectList,
  onSelectDrafts,
  onSelectArchive,
  onSelectPicks,
}) {
  const navigate = useNavigate();
  const { topBarWrap, topBarButton, topBarButtonActive } = chromeStyles;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          maxWidth: "calc(100% - 24px)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            ...cornerBtnStyle,
            backgroundColor: "#2ECC71",
          }}
        >
          홈
        </button>
      </div>

      <header style={{ marginTop: "8px", marginBottom: "10px", padding: "0 8px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.02em" }}>
          @{username}님의
        </div>
        <h1 style={{ fontSize: "clamp(18px, 3.4vw, 22px)", fontWeight: 800, margin: "3px 0 0", lineHeight: 1.15, letterSpacing: "-0.03em" }}>
          스튜디오
        </h1>
      </header>

      <div style={topBarWrap}>
        <button
          type="button"
          title="잔 올리기"
          onClick={onSelectAdd}
          style={{
            ...topBarButton,
            ...(activeSection === "add" ? topBarButtonActive : {}),
          }}
        >
          잔 올리기
        </button>
        <button
          type="button"
          title="잔 리스트"
          onClick={onSelectList}
          style={{
            ...topBarButton,
            ...(activeSection === "list" ? topBarButtonActive : {}),
          }}
        >
          잔 리스트
        </button>
        <button
          type="button"
          title="잔 채우기"
          onClick={onSelectDrafts}
          style={{
            ...topBarButton,
            ...(activeSection === "drafts" ? topBarButtonActive : {}),
          }}
        >
          잔 채우기
        </button>
        <button
          type="button"
          title="잔 아카이브"
          onClick={onSelectArchive}
          style={{
            ...topBarButton,
            ...(activeSection === "archive" ? topBarButtonActive : {}),
          }}
        >
          잔 아카이브
        </button>
        <button
          type="button"
          title="잔 픽 (place_picks)"
          onClick={onSelectPicks}
          style={{
            ...topBarButton,
            ...(activeSection === "picks" ? topBarButtonActive : {}),
          }}
        >
          잔 픽
        </button>
      </div>
    </>
  );
}
