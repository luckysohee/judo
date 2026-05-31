/** 스튜디오 코스 페이지 — StudioHome 다크 톤과 맞춤 */
export const studioCoursesShell = {
  padding: "12px 12px 28px",
  minHeight: "100vh",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  backgroundColor: "#111111",
  color: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  position: "relative",
};

export const studioCoursesInner = {
  textAlign: "left",
  margin: "0 auto",
  width: "min(920px, 100%)",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0 4px",
  boxSizing: "border-box",
};

export const studioCoursesTopRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "16px",
};

export const studioCoursesH1 = {
  fontSize: "clamp(18px, 3.4vw, 22px)",
  fontWeight: 800,
  margin: 0,
  letterSpacing: "-0.03em",
};

export const studioCoursesCard = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  padding: "14px 14px 12px",
  marginBottom: "12px",
  boxSizing: "border-box",
};

export const studioCoursesCardTitle = {
  fontSize: "13px",
  fontWeight: 700,
  margin: "0 0 10px",
  color: "rgba(255,255,255,0.92)",
};

export const studioCoursesLabel = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  color: "rgba(255,255,255,0.65)",
  marginBottom: "4px",
};

export const studioCoursesInput = {
  width: "100%",
  padding: "10px 10px",
  border: "1px solid #333",
  borderRadius: "8px",
  backgroundColor: "#222",
  color: "#fff",
  fontSize: "14px",
  boxSizing: "border-box",
};

export const studioCoursesBtnPrimary = {
  padding: "10px 16px",
  backgroundColor: "#2ECC71",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

export const studioCoursesBtnGhost = {
  padding: "10px 14px",
  backgroundColor: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

export const studioCoursesBtnDanger = {
  padding: "10px 14px",
  backgroundColor: "rgba(231,76,60,0.2)",
  color: "#ff8a80",
  border: "1px solid rgba(231,76,60,0.45)",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

export const studioCoursesEmpty = {
  textAlign: "center",
  padding: "28px 16px",
  color: "rgba(255,255,255,0.55)",
  fontSize: "14px",
  lineHeight: 1.55,
};

export const studioCoursesMeta = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.5)",
  marginTop: "6px",
};

export const studioCoursesRowActions = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "10px",
};

/** 모바일 코스 에디터 — 터치·safe area */
export const studioCoursesMobileShell = {
  paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
};

export const studioCoursesStickyFooter = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 40,
  display: "flex",
  gap: "8px",
  padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
  background:
    "linear-gradient(180deg, rgba(17,17,17,0) 0%, rgba(17,17,17,0.92) 18%, #111 100%)",
  boxSizing: "border-box",
};

export const studioCoursesStickyBtn = {
  flex: 1,
  minHeight: "48px",
  padding: "12px 10px",
  border: "none",
  borderRadius: "12px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

export const studioCoursesVisibilityRow = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

export const studioCoursesVisibilityPill = (active) => ({
  flex: "1 1 0",
  minWidth: "72px",
  minHeight: "40px",
  padding: "8px 10px",
  borderRadius: "10px",
  border: active
    ? "1px solid rgba(46,204,113,0.55)"
    : "1px solid rgba(255,255,255,0.12)",
  backgroundColor: active ? "rgba(46,204,113,0.16)" : "rgba(255,255,255,0.05)",
  color: active ? "#d6ffe6" : "rgba(255,255,255,0.72)",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
});

export const studioCoursesCoverBox = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

export const studioCoursesCoverThumb = {
  width: "72px",
  height: "72px",
  borderRadius: "12px",
  objectFit: "cover",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(0,0,0,0.3)",
};

export const studioCoursesCoverPickBtn = {
  ...studioCoursesBtnGhost,
  minHeight: "44px",
  fontSize: "13px",
};

export const studioCoursesPlaceRowCompact = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  padding: "10px 12px",
  marginBottom: "8px",
  backgroundColor: "rgba(0,0,0,0.22)",
};

export const studioCoursesPlaceOrderBadge = {
  flexShrink: 0,
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  backgroundColor: "rgba(46,204,113,0.18)",
  border: "1px solid rgba(46,204,113,0.35)",
  color: "#9ef0b8",
  fontSize: "12px",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** @param {boolean} [dragging] */
export const studioCoursesPlaceDragHandle = (dragging) => ({
  flexShrink: 0,
  width: "32px",
  height: "44px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "16px",
  lineHeight: 1,
  cursor: dragging ? "grabbing" : "grab",
  userSelect: "none",
  touchAction: "none",
});

export const studioCoursesIconBtn = (disabled) => ({
  minWidth: "44px",
  minHeight: "44px",
  padding: "0 10px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.14)",
  backgroundColor: "rgba(255,255,255,0.07)",
  color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.9)",
  fontSize: "16px",
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
  lineHeight: 1,
});

export const studioCoursesHint = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.45)",
  marginTop: 0,
  marginBottom: "12px",
  lineHeight: 1.5,
};

export const studioCoursesTitleInput = {
  ...studioCoursesInput,
  fontSize: "17px",
  fontWeight: 700,
  padding: "14px 12px",
  marginBottom: "12px",
};

/** 잔 올리기 · 잔 코스 공통 — 지도 위 검색 패널 */
export const studioMapSearchBlock = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  padding: "10px",
  marginBottom: "10px",
  backgroundColor: "rgba(0,0,0,0.18)",
  boxSizing: "border-box",
};

export const studioMapSearchRow = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "6px",
  marginBottom: "10px",
};

export const studioMapSearchField = {
  position: "relative",
  flex: "1 1 auto",
  minWidth: 0,
};

export const studioMapSearchInput = {
  width: "100%",
  minHeight: "44px",
  padding: "10px 38px 10px 14px",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  backgroundColor: "rgba(0,0,0,0.28)",
  color: "#fff",
  fontSize: "15px",
  boxSizing: "border-box",
  outline: "none",
};

export const studioMapSearchClearBtn = {
  position: "absolute",
  right: "8px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "26px",
  height: "26px",
  border: "none",
  borderRadius: "8px",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.5)",
  cursor: "pointer",
  fontSize: "12px",
  lineHeight: 1,
  padding: 0,
};

export const studioMapSearchSubmitBtn = {
  flexShrink: 0,
  minHeight: "44px",
  minWidth: "64px",
  padding: "0 16px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(180deg, #3ad47f 0%, #27ae60 100%)",
  boxShadow: "0 2px 10px rgba(46,204,113,0.28)",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/** @deprecated */
export const studioMapSearchCombo = studioMapSearchRow;

/** @deprecated */
export const studioMapSearchInputInline = studioMapSearchInput;

/** @deprecated */
export const studioMapSearchClearBtnInline = studioMapSearchClearBtn;

/** @deprecated */
export const studioMapSearchSubmitInline = studioMapSearchSubmitBtn;

export const studioMapSearchSuggestList = {
  width: "100%",
  marginTop: "0",
  marginBottom: "10px",
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  maxHeight: "min(40vh, 240px)",
  overflowY: "auto",
  boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
  WebkitOverflowScrolling: "touch",
  boxSizing: "border-box",
};

export const studioMapSearchSuggestStatus = {
  padding: "12px 14px",
  fontSize: "13px",
  color: "rgba(255,255,255,0.5)",
};

/** @param {boolean} [active] */
export const studioMapSearchSuggestItem = (active) => ({
  padding: "11px 14px",
  cursor: "pointer",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  backgroundColor: active ? "rgba(46,204,113,0.12)" : "transparent",
});

export const studioMapSearchSuggestName = {
  fontWeight: 700,
  fontSize: "14px",
  marginBottom: "2px",
  color: "rgba(255,255,255,0.92)",
};

export const studioMapSearchSuggestMeta = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.5)",
  lineHeight: 1.4,
};

/** @param {boolean} [isMobile] */
export const studioMapSearchMapShell = (isMobile) => ({
  width: "100%",
  height: isMobile ? "min(240px, 36vh)" : "min(320px, 52vh)",
  minHeight: isMobile ? "200px" : "260px",
  borderRadius: "10px",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(0,0,0,0.35)",
  position: "relative",
});

export const studioMapSearchMapFill = {
  width: "100%",
  height: "100%",
  display: "block",
};


/** 믹스테이프 선반 / 아카이브 상단 */
export const studioCoursesArchiveBand = {
  borderRadius: "14px",
  padding: "14px 16px 16px",
  marginBottom: "18px",
  background:
    "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(30,30,40,0.95) 42%, rgba(20,20,24,0.98) 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
};

export const studioCoursesArchiveHeadline = {
  margin: "0 0 4px",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.4,
  letterSpacing: "-0.02em",
  color: "rgba(250,250,255,0.9)",
};

export const studioCoursesArchiveWhisper = {
  margin: 0,
  fontSize: "10px",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "rgba(255,255,255,0.45)",
  letterSpacing: "-0.01em",
};

export const studioCoursesFeaturedCard = {
  background:
    "linear-gradient(145deg, rgba(46,204,113,0.14) 0%, rgba(26,26,26,0.98) 38%, rgba(26,26,26,1) 100%)",
  border: "1px solid rgba(46,204,113,0.35)",
  borderRadius: "14px",
  padding: "16px 16px 14px",
  marginBottom: "14px",
  boxSizing: "border-box",
  boxShadow: "0 10px 36px rgba(46,204,113,0.08)",
};

export const studioCoursesFeaturedBadge = {
  display: "inline-block",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(214,255,230,0.95)",
  backgroundColor: "rgba(46,204,113,0.22)",
  border: "1px solid rgba(46,204,113,0.45)",
  borderRadius: "999px",
  padding: "4px 10px",
  marginBottom: "8px",
};

export const studioCoursesSocialLine = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "rgba(255,214,180,0.95)",
  marginTop: "4px",
  lineHeight: 1.35,
};
