import { useCallback, useEffect, useRef, useState } from "react";
import HomeCourseBrowseCollapsedPeek from "./HomeCourseBrowseCollapsedPeek";
import HomeCoursesDiscoveryRail from "./HomeCoursesDiscoveryRail";
import HomeCourseDiscoveryDetail from "./HomeCourseDiscoveryDetail";
import {
  nearestVerticalSnapSheetSnap,
  useVerticalSnapSheet,
} from "../../hooks/useVerticalSnapSheet";
import { useVisualViewportBottomInset } from "../../hooks/useVisualViewportBottomInset";
import {
  HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_BROWSE_PX,
  HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX,
  HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX,
  HOME_COURSES_DISCOVERY_SHEET_STUDIO_TOP_INSET_PX,
  homeCoursesDiscoverySheetExpandedPx,
  homeCoursesDiscoverySheetMaxHeightCss,
  homeCoursesDiscoverySheetStudioFullscreenPx,
  homeHotStripCoursesWrapBottomCss,
} from "../../utils/homeHotStripLayout";
import { HOME_COURSE_STAMP_RESUME_CHIP } from "../../utils/homeCourseStampCopy";

const SHEET_HEIGHT_TRANSITION = "height 0.28s cubic-bezier(0.32, 0.72, 0, 1)";

const dragHandleStyles = {
  zone: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 2,
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  zoneDragging: {
    cursor: "grabbing",
  },
  pill: {
    width: 40,
    height: 4,
    borderRadius: 999,
    background: "rgba(255,255,255,0.28)",
    flexShrink: 0,
  },
  expandBtn: {
    flexShrink: 0,
    margin: 0,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(167,139,250,0.45)",
    background: "rgba(124,58,237,0.22)",
    color: "rgba(237,233,254,0.96)",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  studioFullscreenBar: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    margin: "0 2px 6px",
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(129,140,248,0.35)",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(15,23,42,0.55) 100%)",
  },
  studioFullscreenLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "rgba(224,231,255,0.95)",
  },
  studioFullscreenExitBtn: {
    flexShrink: 0,
    margin: 0,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.88)",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
};

/**
 * 홈 지도 우측 — 「지금 뜨는 코스」(아이콘 + 「코스」 라벨, 주도 다크 글래스).
 */
export function HomeCoursesEntryChip({
  visible = false,
  open = false,
  onToggle,
  buttonStyle = {},
  activeButtonStyle = {},
  labelStyle = {},
}) {
  if (!visible || typeof onToggle !== "function") return null;

  const label = open ? "코스 목록 닫기" : "지금 뜨는 코스";

  return (
    <button
      type="button"
      className={open ? undefined : "judo-courses-entry-hero"}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="home-courses-discovery-panel"
      aria-label={label}
      title={label}
      style={{
        ...buttonStyle,
        ...(open ? activeButtonStyle : null),
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.45))",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" />
          <path d="M9 4v13M15 7v13" />
        </svg>
      </span>
      <span style={labelStyle}>코스</span>
    </button>
  );
}

/**
 * 홈 지도 우측 — 코스 칩 아래 「이어찍기」(숨겨 둔 도장 시트 다시 열기).
 */
export function HomeCourseStampResumeChip({
  visible = false,
  onOpen,
  title = "도장 이어 찍기",
  buttonStyle = {},
  labelStyle = {},
}) {
  if (!visible || typeof onOpen !== "function") return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={title}
      title={title}
      style={buttonStyle}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
        </svg>
      </span>
      <span style={labelStyle}>{HOME_COURSE_STAMP_RESUME_CHIP}</span>
    </button>
  );
}

/**
 * 홈 지도 — 공개 코스 바텀시트(목록 → 상세 → 따라가기/도장).
 */
export default function HomeCoursesDiscoveryPanel({
  open = false,
  onClose,
  railVisible = false,
  user = null,
  isCurator = false,
  browseCourse = null,
  browseLoading = false,
  onBrowseBack,
  onSelectCourse,
  onBrowseStartFollow,
  followCourseId = "",
  followBusy = false,
  stampedPlaceIds = null,
  guideStepIndex = 0,
  courseCompleted = false,
  stampStateVersion = 0,
  replayBusy = false,
  onReplayStamps,
  onStampStateRefresh,
  /** @param {'expanded'|'collapsed'|'minimized'|'closed'|'fullscreen'} snap */
  onSnapChange,
  /** 내 코스 Studio ver. 전체화면 — Home 지도 크롬(체크인 토스트 등) 동기화 */
  onStudioFullscreenChange,
  /** 코스 칩으로 목록 열 때 스냅·높이 초기화 */
  sheetResetKey = 0,
  myCoursesRefreshKey = 0,
  onCourseSearchModeChange,
  onOpenCurator,
  resolveCuratorHandle,
  onEditCourse,
  onDeleteCourse,
}) {
  const [studioFullscreen, setStudioFullscreen] = useState(false);
  /** @type {'trending'|'mine'|'imported'} */
  const [discoveryActiveTab, setDiscoveryActiveTab] = useState("trending");
  const studioFullscreenRef = useRef(false);
  studioFullscreenRef.current = studioFullscreen;

  const {
    bottomPx: keyboardInsetPx,
    visibleHeightPx,
    layoutHeightPx,
    open: keyboardOpen,
  } = useVisualViewportBottomInset();

  const browseModeEarly = browseLoading || Boolean(browseCourse);

  const expandedPx = homeCoursesDiscoverySheetExpandedPx(layoutHeightPx, {
    visibleH: visibleHeightPx,
    keyboardOpen,
  });
  const collapsedPx = browseModeEarly
    ? HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_BROWSE_PX
    : HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX;
  const minimizedPx = HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX;

  const studioFullscreenPx = homeCoursesDiscoverySheetStudioFullscreenPx(
    layoutHeightPx,
    { visibleH: visibleHeightPx, keyboardOpen }
  );

  useEffect(() => {
    if (!isCurator && discoveryActiveTab === "mine") {
      setDiscoveryActiveTab("trending");
    }
  }, [isCurator, discoveryActiveTab]);

  const mineStudioDragEnabled =
    discoveryActiveTab === "mine" && !browseModeEarly;

  const sheetDragReleaseRef = useRef(null);

  const {
    snap,
    heightPx,
    isDragging,
    sheetHeightStyle,
    onDragHandlePointerDown,
    toggleSnap,
    setSnapExpanded,
    setSnapCollapsed,
    setSnapMinimized,
    setSheetHeight,
  } = useVerticalSnapSheet({
    enabled: open,
    expandedPx,
    collapsedPx,
    minimizedPx,
    initialSnap: "expanded",
    resetKey: open ? sheetResetKey : 0,
    maxPx: mineStudioDragEnabled ? studioFullscreenPx : undefined,
    onDragRelease: (h) => sheetDragReleaseRef.current?.(h) === true,
  });

  sheetDragReleaseRef.current = (h) => {
    if (!mineStudioDragEnabled) return false;
    const threshold = (expandedPx + studioFullscreenPx) / 2;
    if (studioFullscreenRef.current) {
      if (h < threshold) {
        setStudioFullscreen(false);
        return false;
      }
      setSheetHeight(studioFullscreenPx);
      return true;
    }
    if (h >= threshold) {
      setSnapExpanded();
      setStudioFullscreen(true);
      setSheetHeight(studioFullscreenPx);
      return true;
    }
    return false;
  };

  const browseMode = browseModeEarly;

  const sheetListExpanded = snap === "expanded";
  const sheetListPeek = snap === "collapsed";

  useEffect(() => {
    if (!open) setStudioFullscreen(false);
  }, [open]);

  useEffect(() => {
    onStudioFullscreenChange?.(studioFullscreen);
  }, [studioFullscreen, onStudioFullscreenChange]);

  useEffect(() => {
    if (discoveryActiveTab !== "mine" && studioFullscreen) {
      setStudioFullscreen(false);
      setSheetHeight(expandedPx);
    }
  }, [discoveryActiveTab, studioFullscreen, expandedPx, setSheetHeight]);

  useEffect(() => {
    if (!studioFullscreen) return;
    if (snap !== "expanded" || browseMode) {
      setStudioFullscreen(false);
    }
  }, [studioFullscreen, snap, browseMode]);

  const enterStudioFullscreen = useCallback(() => {
    setSnapExpanded();
    setStudioFullscreen(true);
    setSheetHeight(studioFullscreenPx);
  }, [setSnapExpanded, setSheetHeight, studioFullscreenPx]);

  const exitStudioFullscreen = useCallback(() => {
    setStudioFullscreen(false);
    setSheetHeight(expandedPx);
  }, [setSheetHeight, expandedPx]);

  const followingThisPreview = Boolean(
    followCourseId &&
      browseCourse?.courseId &&
      String(followCourseId) === String(browseCourse.courseId).trim()
  );
  const wasBrowseModeRef = useRef(false);

  /** 미리보기·도장 진입 시 1회만 펼침 — 매 렌더마다 펼치면 드래그 접기가 안 됨 */
  useEffect(() => {
    if (!open) {
      wasBrowseModeRef.current = false;
      return;
    }
    if (browseMode && !wasBrowseModeRef.current) {
      setSnapExpanded();
    }
    wasBrowseModeRef.current = browseMode;
  }, [open, browseMode, setSnapExpanded, sheetResetKey]);

  /** 목록 모드에서만 최소 스냅 = 패널 닫기 (미리보기+지도는 핸들만 남김) */
  useEffect(() => {
    if (!open || isDragging || snap !== "minimized") return;
    if (browseMode) return;
    onClose?.();
  }, [open, snap, isDragging, onClose, browseMode]);

  const studioFullscreenDragThreshold = (expandedPx + studioFullscreenPx) / 2;

  useEffect(() => {
    if (!onSnapChange) return;
    if (!open) {
      onSnapChange("closed");
      return;
    }
    if (snap === "minimized" && !isDragging && !browseMode) return;
    const dragEnteringFullscreen =
      isDragging &&
      mineStudioDragEnabled &&
      heightPx >= studioFullscreenDragThreshold;
    if (
      (studioFullscreen && snap === "expanded") ||
      dragEnteringFullscreen
    ) {
      onSnapChange("fullscreen");
      return;
    }
    const heights = { expandedPx, collapsedPx, minimizedPx };
    const reported = isDragging
      ? nearestVerticalSnapSheetSnap(heightPx, heights)
      : snap;
    onSnapChange(reported);
  }, [
    open,
    snap,
    isDragging,
    heightPx,
    expandedPx,
    collapsedPx,
    minimizedPx,
    onSnapChange,
    browseMode,
    studioFullscreen,
    mineStudioDragEnabled,
    studioFullscreenDragThreshold,
    studioFullscreenPx,
  ]);

  if (!open) return null;

  const browseTitle = String(browseCourse?.title || "").trim() || "코스";
  const panelTitle = browseMode ? "코스 미리보기" : "코스";
  const sheetBottomCss = homeHotStripCoursesWrapBottomCss(keyboardInsetPx);
  const sheetMaxHeightCss = homeCoursesDiscoverySheetMaxHeightCss(
    visibleHeightPx,
    keyboardInsetPx
  );
  const sheetTransition =
    isDragging || keyboardOpen ? "none" : SHEET_HEIGHT_TRANSITION;
  const effectiveHeightStyle =
    studioFullscreen && !isDragging
      ? `${studioFullscreenPx}px`
      : sheetHeightStyle;
  const effectiveMaxHeight =
    studioFullscreen && !isDragging
      ? `${studioFullscreenPx}px`
      : mineStudioDragEnabled
        ? `${studioFullscreenPx}px`
        : sheetMaxHeightCss;
  const effectiveBottom = studioFullscreen
    ? "calc(6px + env(safe-area-inset-bottom, 0px))"
    : sheetBottomCss;

  return (
    <div
      id="home-courses-discovery-panel"
      role="dialog"
      aria-label={studioFullscreen ? "내 코스 Studio" : panelTitle}
      style={{
        position: "absolute",
        left: studioFullscreen ? 0 : "50%",
        transform: studioFullscreen ? "none" : "translateX(-50%)",
        width: studioFullscreen ? "100%" : "min(720px, calc(100% - 32px))",
        bottom: effectiveBottom,
        height: effectiveHeightStyle,
        maxHeight: effectiveMaxHeight,
        zIndex: studioFullscreen ? 130 : 120,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxSizing: "border-box",
        transition: `${sheetTransition}, bottom 0.22s ease-out, width 0.22s ease-out`,
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: snap === "minimized" ? "0 8px 4px" : "0 8px 8px",
          paddingTop: studioFullscreen
            ? `calc(${HOME_COURSES_DISCOVERY_SHEET_STUDIO_TOP_INSET_PX}px + env(safe-area-inset-top, 0px))`
            : undefined,
          borderRadius: studioFullscreen ? "16px 16px 0 0" : 14,
          background: studioFullscreen
            ? "rgba(10, 10, 12, 0.98)"
            : "rgba(14, 14, 14, 0.94)",
          boxShadow: studioFullscreen
            ? "0 -8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "0 -4px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(22px) saturate(180%)",
          WebkitBackdropFilter: "blur(22px) saturate(180%)",
          color: "rgba(255,255,255,0.92)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={
            snap === "expanded"
              ? browseMode
                ? "코스 시트 한 단계 접기. 아래로 드래그하거나 탭하세요."
                : "코스 시트 한 단계 접기. 아래로 드래그하거나 탭하세요."
              : snap === "collapsed"
                ? browseMode
                  ? "코스 시트 더 접기. 아래로 드래그하거나 탭하세요."
                  : "코스 시트 접기·펼치기. 아래로 더 내리면 닫힙니다."
                : browseMode
                  ? "코스 시트 펼치기. 위로 드래그하거나 탭하세요."
                  : "코스 시트 펼치기. 위로 드래그하거나 탭하세요."
          }
          style={{
            ...dragHandleStyles.zone,
            ...(isDragging ? dragHandleStyles.zoneDragging : null),
            ...(snap === "minimized"
              ? {
                  flexDirection: "row",
                  justifyContent: browseMode ? "flex-start" : "center",
                  alignItems: "center",
                  gap: 8,
                  paddingBottom: 6,
                  paddingLeft: browseMode ? 4 : undefined,
                  paddingRight: browseMode ? 4 : undefined,
                }
              : null),
          }}
          onPointerDown={onDragHandlePointerDown}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (browseMode && snap !== "expanded") {
                setSnapExpanded();
              } else {
                toggleSnap();
              }
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            toggleSnap();
          }}
        >
          <span style={dragHandleStyles.pill} aria-hidden />
          {browseMode && snap === "minimized" ? (
            <>
              <span
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  fontSize: 11,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.92)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {browseTitle}
              </span>
              <button
                type="button"
                data-sheet-no-drag
                style={dragHandleStyles.expandBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setSnapExpanded();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="코스 상세 펼치기"
                title="처음 펼친 화면으로"
              >
                ↑ 펼치기
              </button>
            </>
          ) : null}
        </div>
        {studioFullscreen && !browseMode ? (
          <div style={dragHandleStyles.studioFullscreenBar}>
            <p style={dragHandleStyles.studioFullscreenLabel}>✦ Studio ver.</p>
            <button
              type="button"
              data-sheet-no-drag
              style={dragHandleStyles.studioFullscreenExitBtn}
              onClick={exitStudioFullscreen}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="일반 코스 보기로 접기"
              title="접기"
            >
              ↓ 접기
            </button>
          </div>
        ) : null}
        {browseMode ? (
          sheetListExpanded ? (
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <HomeCourseDiscoveryDetail
                course={browseCourse}
                loading={browseLoading}
                user={user}
                isCurator={isCurator}
                followCourseId={followCourseId}
                followBusy={followBusy}
                stampedPlaceIds={stampedPlaceIds}
                guideStepIndex={guideStepIndex}
                courseCompleted={courseCompleted}
                stampStateVersion={stampStateVersion}
                replayBusy={replayBusy}
                onBack={onBrowseBack}
                onStartFollow={onBrowseStartFollow}
                onStampStateRefresh={onStampStateRefresh}
                onReplayStamps={onReplayStamps}
                onSheetCollapse={setSnapCollapsed}
                onOpenCurator={onOpenCurator}
                resolveCuratorHandle={resolveCuratorHandle}
                onEditCourse={onEditCourse}
                onDeleteCourse={onDeleteCourse}
              />
            </div>
          ) : sheetListPeek && browseCourse && !browseLoading ? (
            <HomeCourseBrowseCollapsedPeek
              course={browseCourse}
              followCourseId={followCourseId}
              stampedPlaceIds={stampedPlaceIds}
              guideStepIndex={guideStepIndex}
              following={followingThisPreview}
              onExpand={setSnapExpanded}
              onSheetMinimize={setSnapMinimized}
              user={user}
              stampStateVersion={stampStateVersion}
            />
          ) : browseLoading ? (
            <p
              style={{
                flexShrink: 0,
                margin: "0 2px 6px",
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              코스 불러오는 중…
            </p>
          ) : null
        ) : (
          <div
            style={{
              flex: sheetListExpanded ? "1 1 auto" : "0 0 auto",
              minHeight: 0,
              display: snap === "minimized" ? "none" : "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <HomeCoursesDiscoveryRail
              visible={railVisible}
              layout={sheetListExpanded || studioFullscreen ? "full" : "peek"}
              user={user}
              isCurator={isCurator}
              refreshKey={myCoursesRefreshKey}
              studioFullscreen={studioFullscreen}
              onEnterStudioFullscreen={enterStudioFullscreen}
              onActiveTabChange={setDiscoveryActiveTab}
              onSearchFocus={setSnapExpanded}
              onSearchModeChange={onCourseSearchModeChange}
              onSelectCourse={(id) => {
                setSnapExpanded();
                onSelectCourse?.(id);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
