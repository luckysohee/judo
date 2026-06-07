import {
  homeDrinksSituationStripBottomCss,
  homeSearchBarStackBottomCss,
  HOME_UI_DOCK_RADIUS_PX,
} from "../../utils/homeHotStripLayout.js";

const glassWhiteStrong = "rgba(255, 255, 255, 0.9)";
const glassBorder = "1px solid rgba(255, 255, 255, 0.55)";
const floatingShadow = "0 10px 30px rgba(0, 0, 0, 0.16)";

export const styles = {
  page: {
    width: "100%",
    height: "100%",
    maxHeight: "100%",
    overflow: "hidden",
    backgroundColor: "#000",
  },

  mainContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
  },

  /** MapView — main 안에서 전체 화면 (모바일 Safari 100% 높이 붕괴 방지) */
  mapViewportLayer: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    width: "100%",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
  /** 첫 진입만 — 지도 블러 스크림 + 중앙 카피 (fixed로 지도 레이어 위 확실히 덮음) */
  homeDustIntroOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 95000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    cursor: "pointer",
    padding: "24px 20px",
    overflow: "hidden",
  },
  homeDustIntroBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(248, 250, 252, 0.58)",
    WebkitBackdropFilter: "blur(20px) saturate(1.08)",
    backdropFilter: "blur(20px) saturate(1.08)",
    willChange: "opacity",
  },
  homeDustIntroInner: {
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    maxWidth: 360,
    width: "100%",
    willChange: "opacity, transform",
  },
  homeDustIntroTextCard: {
    margin: "0 auto",
    padding: "22px 26px",
    borderRadius: 20,
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow:
      "0 4px 24px rgba(15, 23, 42, 0.08), 0 16px 48px rgba(15, 23, 42, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.9)",
  },
  homeDustIntroTitle: {
    margin: 0,
    fontSize: "clamp(19px, 4.8vw, 23px)",
    fontWeight: 800,
    letterSpacing: "-0.035em",
    color: "#0f172a",
    lineHeight: 1.35,
  },
  homeDustIntroSub: {
    margin: "12px 0 0",
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    letterSpacing: "-0.01em",
    lineHeight: 1.45,
  },
  courseAddHalfStepFloatingBtn: {
    position: "absolute",
    right: "14px",
    bottom: "calc(160px + env(safe-area-inset-bottom, 0px))",
    zIndex: 131,
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(124, 58, 237, 0.48)",
    background: "rgba(255,255,255,0.98)",
    color: "#5b21b6",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
    WebkitTapHighlightColor: "transparent",
  },
  drinksSituationStripWrapper: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: homeDrinksSituationStripBottomCss(),
    width: "min(720px, calc(100% - 32px))",
    zIndex: 170,
    pointerEvents: "auto",
    boxSizing: "border-box",
  },
  drinksSituationStrip: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    overflowX: "hidden",
    /** 아래 플로팅 박스 외곽선과 좌우 라인 정확히 일치 */
    padding: "2px 0 0",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  drinksSituationChip: {
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "6px 7px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.42)",
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    boxShadow:
      "0 4px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
    fontSize: "clamp(10.5px, 2.7vw, 11.5px)",
    fontWeight: 700,
    color: "#1e293b",
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    WebkitTapHighlightColor: "transparent",
  },
  drinksSituationEmoji: {
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
  },

  headerOverlay: {
    position: "absolute",
    top: "16px",
    left: "16px",
    right: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "5px",
    /** 지도 SDK·하단 UI(z~1e4)보다 위에 두고, 새 스택킹 문맥으로 히트 테스트 안정화 */
    zIndex: 25000,
    isolation: "isolate",
    pointerEvents: "auto",
    touchAction: "manipulation",
  },

  headerTopRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    minWidth: 0,
  },

  /**
   * 낮 모드: 헤더 아래 한 줄 풀폭 바 — 키워드 강조 + 우측 카운트다운 pill.
   */
  judoDayNoticeFixedBar: {
    position: "fixed",
    left: "6px",
    right: "6px",
    top: "calc(64px + env(safe-area-inset-top, 0px))",
    zIndex: 24980,
    boxSizing: "border-box",
    width: "calc(100% - 12px)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: 0,
    padding: "8px 10px",
    borderRadius: "12px",
    background:
      "linear-gradient(135deg, rgba(28, 28, 32, 0.82) 0%, rgba(12, 12, 16, 0.76) 100%)",
    backdropFilter: "blur(18px) saturate(165%)",
    WebkitBackdropFilter: "blur(18px) saturate(165%)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    borderLeft: "3px solid rgba(251, 191, 36, 0.92)",
    boxShadow:
      "0 8px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
    pointerEvents: "none",
    WebkitFontSmoothing: "antialiased",
  },
  judoDayNoticeCopy: {
    flex: "1 1 auto",
    minWidth: 0,
    margin: 0,
    padding: 0,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    letterSpacing: "-0.03em",
    fontSize: "11.5px",
  },
  judoDayNoticeMuted: {
    fontWeight: 550,
    color: "rgba(255, 255, 255, 0.68)",
  },
  judoDayNoticeEm: {
    fontWeight: 800,
    color: "#ffffff",
  },
  judoDayNoticeLiveTag: {
    fontWeight: 700,
    color: "#fde68a",
    letterSpacing: "0.01em",
  },
  judoDayNoticeTimer: {
    flex: "0 0 auto",
    flexShrink: 0,
    padding: "3px 7px",
    borderRadius: "999px",
    textAlign: "center",
    background:
      "linear-gradient(180deg, rgba(251, 191, 36, 0.22) 0%, rgba(245, 158, 11, 0.14) 100%)",
    border: "1px solid rgba(251, 191, 36, 0.42)",
    color: "#fde68a",
    fontSize: "clamp(10px, 2.6vw, 12px)",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },

  logoNightTagline: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    maxWidth: "min(440px, calc(100vw - 40px))",
  },
  logoNightHeadline: {
    margin: 0,
    fontSize: "clamp(11px, 2.6vw, 14px)",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    color: "#111",
    lineHeight: 1.2,
    textShadow: "0 1px 0 rgba(255,255,255,0.85)",
  },
  logoNightSub: {
    margin: 0,
    fontSize: "clamp(10px, 2.2vw, 11px)",
    fontWeight: 650,
    color: "rgba(17, 17, 17, 0.74)",
    lineHeight: 1.35,
    textShadow: "0 1px 0 rgba(255,255,255,0.8)",
  },

  /** 로고 = 홈 전체 새로고침(상태 초기화) */
  logoHomeButton: {
    margin: 0,
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "30px",
    fontWeight: 900,
    letterSpacing: "-1.5px",
    color: "#111",
    lineHeight: 1,
    flexShrink: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  filterWrapper: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    overflowX: "auto",
    msOverflowStyle: "none",
    scrollbarWidth: "none",
    pointerEvents: "auto",
    position: "relative",
    zIndex: 1,
  },

  legendOverlay: {
    position: "absolute",
    top: "calc(64px + env(safe-area-inset-top, 0px))",
    right: "max(16px, env(safe-area-inset-right, 0px))",
    left: "auto",
    width: "fit-content",
    maxWidth: "min(200px, 42vw)",
    zIndex: 55,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
    pointerEvents: "auto",
  },

  /** 낮 모드 안내 바(한 줄) 아래로 별·마커·내위치·코스 버튼 내림 */
  legendOverlayBelowDayNotice: {
    top: "calc(118px + env(safe-area-inset-top, 0px))",
  },

  legendSecondPickResetButton: {
    pointerEvents: "auto",
    padding: "0 10px",
    height: "28px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.28)",
    background: "rgba(124, 58, 237, 0.35)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.14)",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 800,
    color: "rgba(250, 245, 255, 0.96)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  legendMyLocationButton: {
    pointerEvents: "auto",
    width: "28px",
    height: "28px",
    borderRadius: "9px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(22, 24, 28, 0.22)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.14)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.92)",
    flexShrink: 0,
    transition: "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
  },

  legendMyLocationSpinner: {
    width: "11px",
    height: "11px",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "rgba(125, 180, 255, 0.95)",
    borderRadius: "50%",
    animation: "judoSpin 1s linear infinite",
    display: "inline-block",
  },

  /** 지도 우측 — 내 위치 아래 「코스」(주도 다크 글래스 · 검색바 톤) */
  legendCoursesEntryButton: {
    pointerEvents: "auto",
    width: "32px",
    minHeight: "38px",
    padding: "5px 4px 4px",
    gap: "3px",
    borderRadius: "9px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(17, 17, 17, 0.9)",
    backdropFilter: "blur(14px) saturate(160%)",
    WebkitBackdropFilter: "blur(14px) saturate(160%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.32)",
    cursor: "pointer",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.94)",
    flexShrink: 0,
    transition:
      "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
  },

  legendCoursesEntryButtonActive: {
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(10, 10, 10, 0.96)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.14), 0 6px 20px rgba(0,0,0,0.42)",
    transform: "scale(1.04)",
  },

  legendCoursesEntryLabel: {
    fontSize: "8px",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    whiteSpace: "nowrap",
    marginTop: "1px",
  },

  /** 코스 칩 + 도장 이어찍기 칩 세로 묶음 */
  legendCoursesChipStack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "6px",
    flexShrink: 0,
  },

  /** 코스 버튼 바로 아래 — 숨겨 둔 도장 시트 다시 열기 */
  legendCourseStampResumeButton: {
    pointerEvents: "auto",
    width: "32px",
    minHeight: "38px",
    padding: "5px 4px 4px",
    gap: "3px",
    borderRadius: "9px",
    border: "1px solid rgba(251,191,36,0.72)",
    background:
      "linear-gradient(135deg, rgba(180,83,9,0.62) 0%, rgba(146,64,14,0.55) 100%)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 16px rgba(180,83,9,0.35)",
    cursor: "pointer",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fffbeb",
    flexShrink: 0,
    transition:
      "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
  },

  legendCourseStampResumeLabel: {
    fontSize: "8px",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    whiteSpace: "nowrap",
    marginTop: "1px",
  },

  bottomBarContainer: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
    /* 헤더(16px 인셋)와 동일한 좌우 여백 — 90%는 뷰포트마다 측면이 어긋남 */
    width: "min(720px, calc(100% - 32px))",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    /** 코스 시트(backdrop-filter)보다 위에 항상 그려지도록 */
    zIndex: 160,
  },

  searchWrapper: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    minHeight: "54px",
    borderRadius: `${HOME_UI_DOCK_RADIUS_PX}px`,
    background: "transparent",
    overflow: "visible",
  },

  /** 맞춤 추천 시트 바로 위 — 상단 직각·하단만 둥글게(시트와 한 덩어리) */
  searchWrapperSheetDocked: {
    borderRadius: `0 0 ${HOME_UI_DOCK_RADIUS_PX}px ${HOME_UI_DOCK_RADIUS_PX}px`,
    overflow: "hidden",
  },

  authRowInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  authRowInlineNarrow: {
    gap: "4px",
  },

  /** @핸들 등 역할 버튼 — 좁은 화면에서 검색 입력 폭 확보 */
  inlineRoleButtonNarrow: {
    minWidth: 0,
    maxWidth: "78px",
    height: "32px",
    padding: "0 5px",
    fontSize: "11px",
    marginRight: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  authInlineButton: {
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(17, 17, 17, 0.74)",
    color: "#ffffff",
    borderRadius: "999px",
    height: "34px",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    pointerEvents: "auto",
  },

  authInlineButtonNarrow: {
    height: "32px",
    padding: "0 6px",
    fontSize: "10px",
    fontWeight: 800,
  },

  authIconButton: {
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "none",
    fontSize: "14px",
    fontWeight: 1000,
    padding: 0,
  },

  googleButton: {
    backgroundColor: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(0,0,0,0.12)",
  },

  kakaoButton: {
    backgroundColor: "#FEE500",
    border: "1px solid rgba(0,0,0,0.12)",
  },

  googleG: {
    color: "#4285F4",
    fontWeight: 1000,
    lineHeight: 1,
  },

  kakaoK: {
    color: "#111111",
    fontWeight: 1000,
    lineHeight: 1,
  },

  curatorFloatingWrap: {
    position: "absolute",
    right: "16px",
    bottom: "200px", // 내 위치 아이콘보다 아래
    zIndex: 10050,
  },

  curatorFloatingBtn: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "20px",
    border: glassBorder,
    background: "rgba(46, 204, 113, 0.9)", // 초록색
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "0 12px",
    transition: "all 0.2s ease",
  },

  curatorFloatingText: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "11px",
  },

  curatorApplyBtn: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "20px",
    border: glassBorder,
    background: "rgba(46, 204, 113, 0.9)", // 초록색
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "0 12px",
    transition: "all 0.2s ease",
  },

  locationBtn: {
    width: "54px",
    height: "54px",
    flexShrink: 0,
    borderRadius: "18px",
    border: glassBorder,
    background: glassWhiteStrong,
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  userInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(52, 152, 219, 0.3)",
    background: "rgba(52, 152, 219, 0.15)",
    color: "#3498DB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  curatorInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(46, 204, 113, 0.3)",
    background: "rgba(46, 204, 113, 0.15)",
    color: "#2ECC71",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  adminInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(255, 107, 107, 0.3)",
    background: "rgba(255, 107, 107, 0.15)",
    color: "#FF6B6B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  /** 검색바 우측 프로필 — 원형 사진(역할색 링은 위 버튼 스타일 유지) */
  searchBarProfileButton: {
    minWidth: "34px",
    maxWidth: "34px",
    width: "34px",
    height: "34px",
    padding: 0,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    fontSize: "13px",
    fontWeight: 800,
  },
  searchBarProfileButtonNarrow: {
    minWidth: "28px",
    maxWidth: "28px",
    width: "28px",
    height: "28px",
    fontSize: "11px",
  },
  searchBarProfileImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    pointerEvents: "none",
  },
  searchBarProfileInitial: {
    lineHeight: 1,
    userSelect: "none",
    pointerEvents: "none",
  },

  sideFabContainer: {
    position: "absolute",
    right: "16px",
    bottom: "88px",
    zIndex: 95,
  },

  fabAdd: {
    height: "46px",
    padding: "0 16px",
    borderRadius: "23px",
    border: "1px solid rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.88)",
    color: "#111",
    fontWeight: 700,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  fabPlus: {
    fontSize: "18px",
    lineHeight: 1,
    marginTop: "-1px",
  },

  aiStatusBox: {
    position: "absolute",
    left: "16px",
    right: "16px",
    bottom: "82px",
    zIndex: 72,
    padding: "12px 14px",
    borderRadius: "18px",
    background: "rgba(17,17,17,0.82)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  aiStatusInner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  aiSpinner: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    border: "2px solid rgba(255,255,255,0.24)",
    borderTop: "2px solid #34D17A",
    flexShrink: 0,
    animation: "judoSpin 0.9s linear infinite",
  },

  aiStatusTextWrap: {
    minWidth: 0,
    flex: 1,
  },

  aiStatusTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#fff",
  },

  aiStatusSubtext: {
    marginTop: "3px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 1.4,
  },

  aiStatusError: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#ffb4b4",
    lineHeight: 1.4,
  },

  mapCardOverlay: {
    position: "absolute",
    left: "50%",
    right: "auto",
    transform: "translateX(-50%)",
    width: "min(720px, calc(100% - 32px))",
    bottom: homeSearchBarStackBottomCss(),
    zIndex: 40,
    pointerEvents: "none",
    /** 코스·AI 카드: 내용을 오버레이 하단(검색바 쪽)에 붙여 지도가 위로 넓게 보이게 */
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 0,
  },

  expandSearchWrap: {
    pointerEvents: "auto",
    maxWidth: "100%",
  },

  expandSearchCard: {
    borderRadius: "18px",
    padding: "16px 16px 12px",
    background: "rgba(22, 22, 26, 0.92)",
    color: "#fff",
    boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  expandSearchTitle: {
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.35,
    marginBottom: "8px",
  },

  expandSearchNote: {
    margin: "0 0 6px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.88)",
  },

  expandSearchSub: {
    margin: "0 0 12px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.62)",
  },

  expandFallbackHints: {
    margin: "0 0 12px",
    paddingLeft: "18px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.55)",
  },

  expandChipCol: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
  },

  expandPrimaryBtn: {
    width: "100%",
    marginTop: "4px",
    border: "none",
    borderRadius: "14px",
    padding: "14px 14px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.35,
    color: "#0d1f14",
    background: "linear-gradient(135deg, #5ee9a8 0%, #34d17a 55%, #2bbd6e 100%)",
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(52, 209, 122, 0.35)",
  },

  expandChip: {
    textAlign: "left",
    width: "100%",
    border: "1px solid rgba(52, 209, 122, 0.45)",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
    color: "#e8fff1",
    background: "rgba(52, 209, 122, 0.12)",
    cursor: "pointer",
  },

  expandDismiss: {
    marginTop: "12px",
    width: "100%",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    cursor: "pointer",
    padding: "6px",
  },

  previewStack: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    pointerEvents: "none",
    alignItems: "center",
  },

  aiPeekBar: {
    width: "100%",
    border: "none",
    borderRadius: "18px",
    padding: "10px 16px 14px",
    background: "rgba(17,17,17,0.82)",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    pointerEvents: "auto",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },

  aiPeekBarRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minWidth: 0,
  },

  /** 맞춤 추천 — 통합 바텀시트(헤더+리스트) */
  aiRecommendSheetCluster: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    pointerEvents: "auto",
  },

  aiRecommendMergedShell: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  aiRecommendMergedShellCollapsed: {
    borderRadius: `${HOME_UI_DOCK_RADIUS_PX}px ${HOME_UI_DOCK_RADIUS_PX}px 0 0`,
    marginBottom: 0,
    /** 검색바와 붙일 때 아래 그림자가 빈 틈처럼 보이지 않게 */
    boxShadow: "0 -4px 20px rgba(0,0,0,0.14)",
  },

  aiRecommendMergedShellExpanded: {
    borderRadius: `${HOME_UI_DOCK_RADIUS_PX}px ${HOME_UI_DOCK_RADIUS_PX}px 0 0`,
    height: "min(66vh, 720px)",
    maxHeight: "min(66vh, 720px)",
    marginBottom: 0,
    boxShadow:
      "0 -4px 24px rgba(0,0,0,0.14), 0 12px 32px rgba(0,0,0,0.16)",
  },

  /** 손잡이 + 헤더 — 당겨 닫기 */
  aiRecommendSheetChrome: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: "rgba(17,17,17,0.9)",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },

  aiRecommendSheetChromeDragging: {
    cursor: "grabbing",
  },

  aiRecommendSheetPullStrip: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "12px",
    paddingTop: "8px",
    cursor: "grab",
  },

  aiRecommendSheetHandle: {
    width: "40px",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.32)",
    flexShrink: 0,
  },

  aiRecommendSheetHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px 14px 16px",
    flexShrink: 0,
  },

  aiRecommendSheetHeader: {
    flex: 1,
    minWidth: 0,
    border: "none",
    margin: 0,
    padding: "2px 0 0",
    background: "transparent",
    color: "#fff",
    display: "block",
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  /** 코스 모드 피크 바 — 얇게 */
  courseAiPeekBar: {
    padding: "7px 12px",
    borderRadius: "14px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  },

  /** 코스 모드 — 검색어 지우고 완전히 취소 (작은 원형) */
  courseSearchClearButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    minWidth: "26px",
    padding: 0,
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.28)",
    background: "rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.88)",
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: 400,
    cursor: "pointer",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  },

  /** 코스 모드 — 1차·2차 확정된 선택 코스만 비움 (검색어 유지). 검색 전체 취소 버튼과 구분 */
  courseResetPickButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    minWidth: "26px",
    padding: 0,
    borderRadius: "999px",
    border: "1px solid rgba(196, 181, 253, 0.7)",
    background: "rgba(124, 58, 237, 0.42)",
    color: "rgba(255,255,255,0.96)",
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  },

  /** 코스 피크(제목) + 스와이프·액션을 한 덩어리 바텀시트로 */
  courseMergedShell: {
    width: "100%",
    marginTop: "6px",
    borderRadius: "16px 16px 0 0",
    overflow: "hidden",
    boxShadow: "0 -6px 24px rgba(0,0,0,0.14)",
    background: "transparent",
    /** 셸 전체에 auto 두면 투명 여백이 지도 팬을 가릴 수 있음 — 자식만 클릭 받음 */
    pointerEvents: "none",
    maxHeight: "min(58vh, 520px)",
    display: "flex",
    flexDirection: "column",
  },

  courseMergedHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px 8px 10px",
    background: "rgba(17,17,17,0.9)",
    flexShrink: 0,
    borderRadius: "16px 16px 0 0",
    pointerEvents: "auto",
  },

  courseMergedBody: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTop: "1px solid rgba(17,17,17,0.08)",
    background: "rgba(255,255,255,0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    pointerEvents: "auto",
  },

  /** 아래로 드래그해 시트 접기 — 손가락 당김 영역 */
  courseSheetPullStrip: {
    flexShrink: 0,
    height: "14px",
    touchAction: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
  },

  courseSheetPullStripBar: {
    width: "40px",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(17,17,17,0.16)",
  },

  /** 헤더 안에서는 별도 떠 있는 카드처럼 보이지 않게 */
  courseMergedPeekToggle: {
    background: "transparent",
    boxShadow: "none",
    borderRadius: 0,
    border: "none",
  },

  courseAiPeekTitle: {
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1.15,
  },

  courseAiPeekSubtitle: {
    fontSize: "10px",
    lineHeight: 1.2,
    maxWidth: "min(78vw, 300px)",
    whiteSpace: "normal",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "1px",
  },

  aiPeekLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },

  aiPeekBadge: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#34D17A",
    color: "#111",
    fontWeight: 900,
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  aiPeekTextWrap: {
    minWidth: 0,
    textAlign: "left",
  },

  aiPeekTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#fff",
  },

  aiPeekSubtitle: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.78)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "220px",
  },
  aiPeekTrustLine: {
    marginTop: "2px",
    fontSize: "10px",
    color: "rgba(255,255,255,0.6)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "220px",
    fontWeight: 600,
  },

  aiPeekSubtitleError: {
    color: "#ffb4b4",
  },

  aiPeekArrow: {
    flexShrink: 0,
    fontSize: "12px",
    lineHeight: 1,
    color: "rgba(255,255,255,0.9)",
    marginLeft: "6px",
  },

  /** 맞춤 추천 — 펼침 리스트 영역 (헤더와 한 셸) */
  aiRecommendSheetBody: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "rgba(255,255,255,0.94)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    pointerEvents: "auto",
  },

  /** @deprecated 코스 등 — 맞춤 추천은 aiRecommendSheetBody */
  aiBottomSheet: {
    marginTop: 0,
    width: "100%",
    height: "min(66vh, 720px)",
    maxHeight: "min(66vh, 720px)",
    borderRadius: "24px 24px 0 0",
    background: "rgba(255,255,255,0.85)",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    overflow: "hidden",
    pointerEvents: "auto",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    zIndex: 2,
  },

  aiSheetHandleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "4px",
    paddingBottom: "2px",
    flexShrink: 0,
  },

  aiSheetHandle: {
    width: "42px",
    height: "5px",
    borderRadius: "999px",
    background: "rgba(17,17,17,0.18)",
  },

  aiSheetHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 16px 12px",
    borderBottom: "1px solid rgba(17,17,17,0.06)",
  },

  aiSheetTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#111",
  },

  aiSheetDesc: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#666",
    lineHeight: 1.4,
  },

  aiSheetCloseBtn: {
    border: "none",
    background: "rgba(17,17,17,0.06)",
    color: "#111",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  /** 맞춤 추천 리스트 시트 — 닫기(×), 펼침 영역 밝은 배경용 */
  aiRecommendSheetCloseButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    minWidth: "28px",
    padding: 0,
    borderRadius: "999px",
    border: "none",
    background: "rgba(17,17,17,0.08)",
    color: "#111",
    fontSize: "18px",
    lineHeight: 1,
    fontWeight: 400,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  aiSheetCloseBtadminChip: {
    border: "1px solid rgba(0,0,0,0.10)",
    backgroundColor: "rgba(255,255,255,0.86)",
    color: "#111",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  studioChip: {
    border: "1px solid rgba(255,107,107,0.30)",
    backgroundColor: "rgba(255,107,107,0.15)",
    color: "#FF6B6B",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  aiSheetList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
    padding:
      "4px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    pointerEvents: "auto",
  },

  /** 코스 바텀시트: 가로 스와이프 카드 + 아래 액션 영역 */
  courseSheetBody: {
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    pointerEvents: "auto",
  },

  courseOptionsSwipeRow: {
    display: "flex",
    flexDirection: "row",
    gap: "10px",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
    padding: "6px 12px 4px",
    flexShrink: 0,
    scrollbarWidth: "thin",
    touchAction: "pan-x",
    overscrollBehaviorX: "contain",
    maxHeight: "min(30vh, 248px)",
  },

  courseOptionCardSwipe: {
    flex: "0 0 min(calc(100% - 56px), 288px)",
    width: "min(calc(100% - 56px), 288px)",
    maxWidth: "min(calc(100% - 56px), 288px)",
    scrollSnapAlign: "center",
    boxSizing: "border-box",
    maxHeight: "min(28vh, 228px)",
    overflowY: "auto",
  },

  aiSheetSectionLabel: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "rgba(17,17,17,0.45)",
    marginBottom: "2px",
  },

  aiSheetPager: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },

  aiSheetPagerBtn: {
    height: 24,
    padding: "0 8px",
    borderRadius: 999,
    border: "1px solid rgba(17,17,17,0.14)",
    background: "rgba(255,255,255,0.95)",
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    cursor: "pointer",
  },

  aiSheetPagerLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(17,17,17,0.58)",
    minWidth: 44,
    textAlign: "center",
  },

  aiSheetRepTagRow: {
    marginTop: "8px",
  },

  aiSheetRepTag: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#1b4332",
    background: "rgba(27, 67, 50, 0.08)",
    borderRadius: "999px",
    padding: "4px 10px",
  },

  aiSheetMatchRow: {
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  aiSheetMatchLabel: {
    fontSize: "10px",
    fontWeight: 800,
    color: "rgba(17,17,17,0.38)",
    letterSpacing: "0.02em",
  },

  aiSheetFacetPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },

  aiSheetFacetPill: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#111",
    border: "1px solid rgba(17,17,17,0.12)",
    borderRadius: "999px",
    padding: "5px 10px",
    background: "rgba(255,255,255,0.95)",
  },

  aiSheetCuratorSave: {
    marginTop: "8px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6c5ce7",
  },

  aiCuratorHighlight: {
    width: "100%",
    textAlign: "left",
    border: "1px solid rgba(108, 92, 231, 0.25)",
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(108, 92, 231, 0.06)",
    cursor: "pointer",
  },

  aiCuratorHighlightHead: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#111",
    lineHeight: 1.4,
  },

  aiCuratorHighlightSub: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(17,17,17,0.55)",
  },

  aiSheetItem: {
    width: "100%",
    border: "1px solid rgba(17,17,17,0.06)",
    borderRadius: "24px", 
    background: "rgba(255,255,255,0.9)",
    padding: "8px 12px", 
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)", 
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },

  aiSheetItemTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },

  aiSheetRank: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#111",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  aiSheetMain: {
    minWidth: 0,
    flex: 1,
  },

  aiSheetPreviewWrap: {
    width: 82,
    height: 82,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(17,17,17,0.08)",
    background: "rgba(17,17,17,0.04)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
    flexShrink: 0,
    cursor: "zoom-in",
  },

  aiSheetPreviewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  aiSheetPreviewFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(17,17,17,0.45)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(245,245,245,0.9) 100%)",
  },
  aiSheetPhotoViewerBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.84)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1400,
    padding: 16,
  },
  aiSheetPhotoViewerImage: {
    maxWidth: "min(100%, 980px)",
    maxHeight: "86vh",
    borderRadius: 12,
    objectFit: "contain",
    boxShadow: "0 18px 36px rgba(0,0,0,0.45)",
  },
  aiSheetPhotoViewerClose: {
    position: "absolute",
    right: 16,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: "999px",
    border: "none",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
  },
  aiSheetPhotoViewerPrev: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    width: 38,
    height: 38,
    borderRadius: "999px",
    border: "none",
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: 28,
    lineHeight: 1,
    cursor: "pointer",
  },
  aiSheetPhotoViewerNext: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    width: 38,
    height: 38,
    borderRadius: "999px",
    border: "none",
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: 28,
    lineHeight: 1,
    cursor: "pointer",
  },

  aiSheetNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  aiSheetName: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#111",
  },

  aiSavedDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    flexShrink: 0,
  },

  aiSheetMeta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#777",
  },

  aiSheetDistance: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#1b4332",
  },

  aiSheetReason: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#222",
    lineHeight: 1.45,
  },

  aiSheetWhyRecommended: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#1a1a2e",
    lineHeight: 1.4,
    maxWidth: "100%",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "break-word",
  },
  aiSheetReasonLabel: {
    marginTop: "8px",
    fontSize: "10px",
    fontWeight: 800,
    color: "rgba(17,17,17,0.45)",
    letterSpacing: "0.02em",
  },

  aiSheetWhyRecommendedExpanded: {
    WebkitLineClamp: "unset",
    display: "block",
    overflow: "visible",
  },

  aiSheetWhyExpandButton: {
    marginTop: 4,
    padding: 0,
    border: 0,
    background: "transparent",
    color: "#7c3aed",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.3,
  },

  aiSheetTags: {
    marginTop: "10px",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },

  aiSheetTag: {
    fontSize: "11px",
    color: "#555",
    background: "rgba(17,17,17,0.05)",
    borderRadius: "999px",
    padding: "6px 9px",
  },
};
