/**
 * `StudioHome.jsx`에서 실제로 사용되는 5개 스타일만 분리한다.
 *  - studioShell: 페이지 최상단 컨테이너
 *  - studioSectionInner: 섹션 내부 공통 콘텐츠 폭/패딩
 *  - topBarWrap / topBarButton / topBarButtonActive: 상단 탭바 (StudioTopChrome으로 전달)
 *
 * 기존 styles 객체에 있던 page, topBar, header, card 계열, quickStats 계열,
 * stat 계열, step 계열, welcome 계열 등 약 30개 키는 JSX에서 더 이상 참조되지
 * 않아 제거했다.
 */
export const studioHomeStyles = {
  studioShell: {
    padding: "12px 12px 20px",
    textAlign: "center",
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    backgroundColor: "#111111",
    color: "#ffffff",
    boxSizing: "border-box",
    position: "relative",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  studioSectionInner: {
    textAlign: "left",
    margin: "0 auto",
    width: "min(920px, 100%)",
    maxWidth: "100%",
    minWidth: 0,
    padding: "0 4px",
    boxSizing: "border-box",
  },
  topBarWrap: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: "6px",
    padding: "8px 10px",
    margin: "0 auto 14px",
    width: "min(920px, 100%)",
    boxSizing: "border-box",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "10px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "thin",
    justifyContent: "stretch",
    alignItems: "stretch",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
  },
  topBarButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.88)",
    borderRadius: "8px",
    padding: "8px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flex: "1 1 0",
    minWidth: "min-content",
    transition: "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "none",
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
  },
  topBarButtonActive: {
    border: "1px solid rgba(46, 204, 113, 0.45)",
    backgroundColor: "rgba(46, 204, 113, 0.18)",
    color: "#ffffff",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
};
