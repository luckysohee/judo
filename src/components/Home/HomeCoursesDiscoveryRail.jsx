import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteCuratorCourse,
  fetchMyCuratorCourses,
  fetchPublicCuratorCourses,
  publishCuratorCourse,
  updateCuratorCourse,
} from "../../api/curatorCourses";
import { useToast } from "../Toast/ToastProvider";
import { searchPublicCuratorCourses } from "../../api/searchPublicCourses";
import { buildCourseDiscoverySearchPlan } from "../../utils/courseSearchAreaExpansion";
import { splitMyCuratorCourses } from "../../utils/courseImportUi";
import { removeImportedCuratorCourse } from "../../api/courseImports";
import { COURSE_SCRAP_SECTION_TITLE } from "../../utils/coursePickCopy";
import {
  getCourseEngagementStatsBatch,
  pickHomeCourseCompletionMetricLine,
} from "../../api/courseCompletionStats";
import { supabase } from "../../lib/supabase";
import {
  HOME_COURSE_DISCOVERY_FETCH_LIMIT,
  HOME_COURSE_DISCOVERY_SECTION_SIZE,
  buildHomeCourseDiscoveryPeekList,
  buildHomeCourseDiscoveryUnifiedList,
  filterCoursesForDiscoverySearch,
  partitionHomeCourseDiscovery,
} from "../../utils/homeCourseDiscoveryLists";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";
import {
  commitHomeCourseDiscoveryMyCache,
  commitHomeCourseDiscoveryTrendingCache,
  prefetchHomeCourseDiscoveryMy,
  prefetchHomeCourseDiscoveryTrending,
  readHomeCourseDiscoveryMyCache,
  readHomeCourseDiscoveryTrendingCache,
} from "../../utils/homeCourseDiscoveryPrefetch";
import { enrichCoursesWithAutoCover, pickCourseDisplayCoverUrl } from "../../utils/courseStepThumb";
import { useHomeSearchMode } from "../../hooks/useHomeSearchMode";
import HomeCourseSearchOverlay from "./HomeCourseSearchOverlay";
import StudioCourseSuggestionPanel from "../Studio/StudioCourseSuggestionPanel";
import { getAiApiBaseUrl } from "../../utils/apiBaseUrl.js";

const COURSE_SEARCH_DEBOUNCE_MS = 320;
const COURSE_SEARCH_PAGE_SIZE = 24;
const COURSE_NEARBY_PAGE_SIZE = 6;

function isCoursePublicListed(course) {
  if (!course || typeof course !== "object") return false;
  return (
    String(course.status || "").trim() === "published" &&
    course.is_public === true
  );
}

function courseMatchesSearch(course, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  const title = String(course?.title || "").toLowerCase();
  const area = String(course?.area || "").toLowerCase();
  const tags = Array.isArray(course?.theme_tags)
    ? course.theme_tags.join(" ").toLowerCase()
    : "";
  return (
    title.includes(needle) || area.includes(needle) || tags.includes(needle)
  );
}
const AI_API_BASE = getAiApiBaseUrl();

import { fetchCuratorMapsForUserIds } from "../../utils/curatorCourseDiscoveryLabels";

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
    gap: 8,
  },
  searchWrap: {
    position: "relative",
    flexShrink: 0,
  },
  sheetChrome: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  contentArea: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 36px 9px 12px",
    borderRadius: 10,
    border: T.inputBorder,
    background: T.inputBg,
    fontSize: 13,
    fontWeight: 600,
    color: T.text,
    outline: "none",
  },
  searchInputWithIcon: {
    paddingLeft: 34,
  },
  searchIconLead: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    lineHeight: 1,
    pointerEvents: "none",
    opacity: 0.55,
    userSelect: "none",
  },
  searchClear: {
    position: "absolute",
    right: 6,
    top: "50%",
    transform: "translateY(-50%)",
    width: 26,
    height: 26,
    borderRadius: 999,
    border: "none",
    background: T.chipBg,
    color: T.textSub,
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  columns: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    flex: "1 1 auto",
    minHeight: 0,
  },
  column: {
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    gap: 6,
  },
  columnTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: T.textSub,
    flexShrink: 0,
    paddingLeft: 2,
  },
  columnScroll: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    WebkitOverflowScrolling: "touch",
  },
  searchResults: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    WebkitOverflowScrolling: "touch",
  },
  overlaySearchResults: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "8px 10px 16px",
    boxSizing: "border-box",
  },
  compactCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    width: "100%",
    padding: 6,
    borderRadius: 10,
    border: T.cardBorder,
    background: T.cardBg,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
    boxSizing: "border-box",
    WebkitTapHighlightColor: "transparent",
  },
  compactCardActive: {
    border: T.cardActiveBorder,
    background: T.cardActiveBg,
    padding: 5,
  },
  thumb: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderRadius: 8,
    objectFit: "cover",
    display: "block",
    background: T.thumbBg,
  },
  cardBody: {
    flex: "1 1 auto",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
  },
  cardTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.3,
    letterSpacing: "-0.03em",
    color: T.text,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  cardMeta: {
    fontSize: 10,
    fontWeight: 600,
    color: T.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardMetric: {
    fontSize: 10,
    fontWeight: 700,
    color: T.textSub,
  },
  cardBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: T.textSub,
    lineHeight: 1.3,
  },
  emptyCol: {
    fontSize: 10,
    fontWeight: 600,
    color: T.textMuted,
    padding: "8px 4px",
    lineHeight: 1.4,
  },
  nearbySectionTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: T.textMuted,
    padding: "10px 4px 4px",
    marginTop: 6,
    borderTop: `1px solid ${T.divider || "rgba(255,255,255,0.08)"}`,
    lineHeight: 1.4,
  },
  stateBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: T.textMuted,
    textAlign: "center",
    padding: 12,
  },
  retryBtn: {
    display: "block",
    margin: "8px auto 0",
    padding: "6px 12px",
    borderRadius: 999,
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  peekScroll: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "row",
    gap: 8,
    overflowX: "auto",
    overflowY: "hidden",
    padding: "0 2px 2px",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  peekCard: {
    flex: "0 0 auto",
    width: 118,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 5,
    borderRadius: 10,
    border: T.cardBorder,
    background: T.cardBg,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
    boxSizing: "border-box",
    WebkitTapHighlightColor: "transparent",
  },
  peekThumb: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 7,
    objectFit: "cover",
    display: "block",
    background: T.thumbBg,
  },
  peekTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: "-0.03em",
    color: T.text,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  peekMeta: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 600,
    color: T.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  peekBadge: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: 700,
    color: T.textSub,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  peekHint: {
    flexShrink: 0,
    margin: 0,
    padding: "0 2px 4px",
    fontSize: 10,
    fontWeight: 650,
    color: T.textFaint,
    letterSpacing: "-0.02em",
  },
  peekState: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 600,
    color: T.textMuted,
    padding: "4px 2px 6px",
  },
  tabRow: {
    display: "flex",
    gap: 5,
    flexShrink: 0,
    padding: "0 2px 6px",
  },
  tabBtn: (active) => ({
    flex: "1 1 0",
    minWidth: 0,
    padding: "6px 4px",
    borderRadius: 999,
    border: active ? "none" : T.chipBorder,
    background: active ? T.chipActiveBg : T.chipBg,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: active ? T.text : T.textMuted,
    cursor: "pointer",
    lineHeight: 1.25,
  }),
  singleList: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    WebkitOverflowScrolling: "touch",
  },
  sectionTitleOwn: {
    margin: "4px 2px 2px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: T.textSub,
  },
  sectionTitleScrap: {
    margin: "12px 2px 2px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "rgba(165,180,252,0.85)",
  },
  sectionEmpty: {
    margin: "0 0 8px",
    padding: "12px 10px",
    borderRadius: 10,
    border: T.chipBorder,
    background: T.chipBg,
    fontSize: 12,
    lineHeight: 1.45,
    color: T.textSub,
  },
  mineActionRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 8,
  },
  newCourseBtn: {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: 44,
    padding: 0,
    borderRadius: 12,
    border: "1px solid rgba(46, 204, 113, 0.55)",
    background: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)",
    color: "#fff",
    fontSize: 26,
    fontWeight: 400,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    boxShadow: "0 2px 10px rgba(39, 174, 96, 0.28)",
    WebkitTapHighlightColor: "transparent",
  },
  studioVerBtn: {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: 44,
    padding: "0 10px",
    borderRadius: 12,
    border: "1px solid rgba(129,140,248,0.38)",
    background:
      "linear-gradient(145deg, rgba(99,102,241,0.16) 0%, rgba(15,23,42,0.45) 100%)",
    color: "rgba(224,231,255,0.95)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    boxSizing: "border-box",
    WebkitTapHighlightColor: "transparent",
  },
  studioVerBtnHint: {
    fontSize: 9,
    fontWeight: 700,
    color: "rgba(165,180,252,0.72)",
  },
  cardActionRow: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardMiniBtn: {
    flexShrink: 0,
    minWidth: 0,
    padding: "5px 7px",
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
};

const DISCOVERY_TABS = [
  { id: "trending", label: "지금 뜨는" },
  { id: "mine", label: "내 코스" },
  { id: "imported", label: "가져온" },
];

function CompactCourseCard({
  course,
  statsByCourseId,
  nameByCurator,
  nicknameByCurator,
  active,
  onActivate,
  metaExtra = "",
  showEngagement = true,
  badge = null,
  rightSlot = null,
}) {
  const id = String(course?.id || "").trim();
  const title = String(course?.title || "").trim() || "제목 없음";
  const cover = pickCourseDisplayCoverUrl(course);
  const area = String(course?.area || "").trim();
  const cid = String(course?.curator_id || "").trim();
  const curatorLabel = nameByCurator.get(cid) || "큐레이터";
  const curatorNickname = nicknameByCurator?.get(cid) || "";
  const n = Number(course?.place_count);
  const placeTxt = Number.isFinite(n) && n > 0 ? `${Math.floor(n)}곳` : "";
  const metaBits = badge
    ? [metaExtra, curatorLabel, area, placeTxt].filter(Boolean)
    : [metaExtra, area, placeTxt].filter(Boolean);
  const statRow = id ? statsByCourseId.get(id.toLowerCase()) : null;
  const metricLine = pickHomeCourseCompletionMetricLine(statRow);
  const activate = () => {
    if (!id) return;
    onActivate(id);
  };

  // 우측 액션(공개 토글 등)이 있으면 button 중첩 방지를 위해 div role=button 사용
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      style={{
        ...styles.compactCard,
        ...(active ? styles.compactCardActive : null),
      }}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      {cover ? (
        <img src={cover} alt="" style={styles.thumb} loading="lazy" />
      ) : (
        <div style={styles.thumb} aria-hidden />
      )}
      <div style={styles.cardBody}>
        <h4 style={styles.cardTitle}>{title}</h4>
        {badge ? (
          <div style={styles.cardBadge}>
            {badge.emoji} {badge.text}
          </div>
        ) : curatorNickname ? (
          <div style={styles.cardBadge}>{curatorNickname}</div>
        ) : null}
        <div style={styles.cardMeta}>{metaBits.join(" · ")}</div>
        {showEngagement && !badge && metricLine ? (
          <div style={styles.cardMetric}>
            {metricLine.emoji} {metricLine.text}
          </div>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}

function PeekCourseCard({
  course,
  badge = null,
  nameByCurator,
  nicknameByCurator,
  onActivate,
}) {
  const id = String(course?.id || "").trim();
  const title = String(course?.title || "").trim() || "제목 없음";
  const cover = pickCourseDisplayCoverUrl(course);
  const area = String(course?.area || "").trim();
  const cid = String(course?.curator_id || "").trim();
  const curatorNickname = nicknameByCurator?.get(cid) || "";
  const n = Number(course?.place_count);
  const placeTxt = Number.isFinite(n) && n > 0 ? `${Math.floor(n)}곳` : "";
  const metaBits = [placeTxt, area].filter(Boolean);

  return (
    <button
      type="button"
      style={styles.peekCard}
      onClick={() => {
        if (!id) return;
        onActivate(id);
      }}
    >
      {cover ? (
        <img src={cover} alt="" style={styles.peekThumb} loading="lazy" />
      ) : (
        <div style={styles.peekThumb} aria-hidden />
      )}
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <h4 style={styles.peekTitle}>{title}</h4>
        {badge ? (
          <div style={styles.peekBadge}>
            {badge.emoji} {badge.text}
          </div>
        ) : curatorNickname ? (
          <div style={styles.peekBadge}>{curatorNickname}</div>
        ) : null}
        {metaBits.length > 0 ? (
          <div style={styles.peekMeta}>{metaBits.join(" · ")}</div>
        ) : null}
      </div>
    </button>
  );
}

function DiscoveryPeekStrip({
  phase,
  peekCourses,
  nameByCurator,
  nicknameByCurator,
  onActivate,
  onRetry,
  emptyHint = "공개 코스가 없어요.",
}) {
  if (phase === "loading") {
    return <p style={styles.peekState}>코스 불러오는 중…</p>;
  }
  if (phase === "error") {
    return (
      <p style={styles.peekState}>
        불러오지 못했어요.{" "}
        <button type="button" style={styles.retryBtn} onClick={onRetry}>
          다시
        </button>
      </p>
    );
  }
  if (!peekCourses.length) {
    return (
      <p style={styles.peekState}>
        {emptyHint}{" "}
        <button type="button" style={styles.retryBtn} onClick={onRetry}>
          새로고침
        </button>
      </p>
    );
  }
  return (
    <div
      style={styles.peekScroll}
      role="list"
      aria-label="코스 빠른 미리보기"
    >
      {peekCourses.map((entry) => {
        const course = entry?.course ?? entry;
        const badge = entry?.badge ?? null;
        return (
          <PeekCourseCard
            key={String(course.id || course.title)}
            course={course}
            badge={badge}
            nameByCurator={nameByCurator}
            nicknameByCurator={nicknameByCurator}
            onActivate={onActivate}
          />
        );
      })}
    </div>
  );
}

function DiscoveryTabBar({ tabs, activeTab, onChange, disabled }) {
  return (
    <div
      style={styles.tabRow}
      role="tablist"
      aria-label="코스 목록 종류"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            style={styles.tabBtn(active)}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 홈 「지금 뜨는 코스」 패널 — 통합 추천 목록 + 배지, 상단 검색.
 */
export default function HomeCoursesDiscoveryRail({
  visible = true,
  /** @type {'full'|'peek'} */
  layout = "full",
  user = null,
  isCurator = false,
  refreshKey = 0,
  studioFullscreen = false,
  onEnterStudioFullscreen,
  onActiveTabChange,
  onSelectCourse,
  onSearchFocus,
  onSearchModeChange,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const trendingCacheOnMount = readHomeCourseDiscoveryTrendingCache();
  const myCacheOnMount = readHomeCourseDiscoveryMyCache(user?.id);
  /** @type {'trending'|'mine'|'imported'} */
  const [activeTab, setActiveTab] = useState("trending");
  const handleDiscoveryTabChange = useCallback(
    (tab) => {
      setActiveTab(tab);
      onActiveTabChange?.(tab);
    },
    [onActiveTabChange]
  );

  const discoveryTabs = useMemo(
    () =>
      DISCOVERY_TABS.filter((tab) => tab.id !== "mine" || isCurator),
    [isCurator]
  );

  useEffect(() => {
    if (!isCurator && activeTab === "mine") {
      handleDiscoveryTabChange("trending");
    }
  }, [isCurator, activeTab, handleDiscoveryTabChange]);
  /** 공개/비공개 토글 진행 중 course id */
  const [togglingCourseId, setTogglingCourseId] = useState("");
  /** 스크랩 코스 삭제 진행 중 course id */
  const [removingImportId, setRemovingImportId] = useState("");
  /** 내 코스 삭제 진행 중 course id */
  const [deletingOwnCourseId, setDeletingOwnCourseId] = useState("");
  const [phase, setPhase] = useState(() => {
    if (trendingCacheOnMount?.rows?.length) return "ready";
    return visible ? "loading" : "idle";
  });
  const [myPhase, setMyPhase] = useState(() => {
    if (!user?.id) return "idle";
    if (myCacheOnMount?.rows) return "ready";
    return "idle";
  });
  const [rows, setRows] = useState(() => trendingCacheOnMount?.rows ?? []);
  const [myRows, setMyRows] = useState(() => myCacheOnMount?.rows ?? []);
  const [statsByCourseId, setStatsByCourseId] = useState(
    () => trendingCacheOnMount?.statsByCourseId ?? new Map()
  );
  const [nameByCurator, setNameByCurator] = useState(
    () => trendingCacheOnMount?.nameByCurator ?? new Map()
  );
  const [nicknameByCurator, setNicknameByCurator] = useState(
    () => trendingCacheOnMount?.nicknameByCurator ?? new Map()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPhase, setSearchPhase] = useState("idle");
  const [searchResults, setSearchResults] = useState([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  /** 검색 지역과 인접한 동네 코스 묶음 — [{ key, courses }] */
  const [nearbyAreaSections, setNearbyAreaSections] = useState([]);
  const loadGenRef = useRef(0);
  const myLoadGenRef = useRef(0);
  const searchGenRef = useRef(0);
  const searchInputRef = useRef(null);
  const courseSearchMode = useHomeSearchMode({
    historyStateKey: "judoCourseDiscoverySearchMode",
  });
  const {
    isOpen: courseSearchOpen,
    open: openCourseSearchMode,
    close: closeCourseSearchMode,
  } = courseSearchMode;

  const trimmedSearch = String(searchQuery || "").trim();
  const showInlineSearchResults =
    Boolean(trimmedSearch) && !courseSearchOpen;

  const { editorPicks, weeklyRanking } = useMemo(
    () => partitionHomeCourseDiscovery(rows, statsByCourseId),
    [rows, statsByCourseId]
  );

  const trendingUnified = useMemo(() => {
    const totalPublic = rows.length;
    const limit =
      totalPublic <= 10
        ? totalPublic
        : HOME_COURSE_DISCOVERY_SECTION_SIZE * 2;
    return buildHomeCourseDiscoveryUnifiedList(
      editorPicks,
      weeklyRanking,
      statsByCourseId,
      { limit }
    );
  }, [editorPicks, rows.length, statsByCourseId, weeklyRanking]);

  const { ownCourses, importedCourses } = useMemo(
    () => splitMyCuratorCourses(myRows),
    [myRows]
  );

  const ownCourseCounts = useMemo(() => {
    let publicN = 0;
    let privateN = 0;
    for (const course of ownCourses) {
      if (isCoursePublicListed(course)) publicN += 1;
      else privateN += 1;
    }
    return { publicN, privateN, total: ownCourses.length };
  }, [ownCourses]);

  const searchedOwnCourses = useMemo(() => {
    if (!trimmedSearch) return ownCourses;
    return ownCourses.filter((course) =>
      courseMatchesSearch(course, trimmedSearch)
    );
  }, [ownCourses, trimmedSearch]);

  const searchedImportedCourses = useMemo(() => {
    if (!trimmedSearch) return importedCourses;
    const plan = buildCourseDiscoverySearchPlan(trimmedSearch);
    const q = plan.primaryQuery || trimmedSearch;
    return filterCoursesForDiscoverySearch(importedCourses, q, {
      nameByCurator,
    });
  }, [importedCourses, trimmedSearch, nameByCurator]);

  const mergeCuratorNames = useCallback(async (courses, genRef, gen) => {
    const ids = [
      ...new Set(
        (Array.isArray(courses) ? courses : [])
          .map((c) => String(c.curator_id || "").trim())
          .filter(Boolean)
      ),
    ];
    if (ids.length === 0) return;
    const maps = await fetchCuratorMapsForUserIds(ids);
    if (genRef.current !== gen) return;
    setNameByCurator((prev) => {
      const next = new Map(prev);
      for (const [k, v] of maps.nameByCurator.entries()) next.set(k, v);
      return next;
    });
    setNicknameByCurator((prev) => {
      const next = new Map(prev);
      for (const [k, v] of maps.nicknameByCurator.entries()) next.set(k, v);
      return next;
    });
  }, []);

  const mergeSearchStats = useCallback(async (courses, genRef, gen) => {
    const courseIds = (Array.isArray(courses) ? courses : [])
      .map((c) => String(c.id || "").trim())
      .filter(Boolean);
    if (!courseIds.length) return;
    const statMap = await getCourseEngagementStatsBatch(courseIds);
    if (genRef.current !== gen) return;
    setStatsByCourseId((prev) => {
      const next = new Map(prev);
      for (const [k, v] of statMap.entries()) {
        next.set(k, v);
      }
      return next;
    });
  }, []);

  const peekCourses = useMemo(() => {
    if (activeTab === "mine") {
      return ownCourses
        .slice(0, HOME_COURSE_DISCOVERY_SECTION_SIZE)
        .map((course) => ({ course, badge: null }));
    }
    if (activeTab === "imported") {
      return importedCourses
        .slice(0, HOME_COURSE_DISCOVERY_SECTION_SIZE)
        .map((course) => ({ course, badge: null }));
    }
    return buildHomeCourseDiscoveryPeekList(
      editorPicks,
      weeklyRanking,
      HOME_COURSE_DISCOVERY_SECTION_SIZE,
      statsByCourseId
    );
  }, [
    activeTab,
    ownCourses,
    importedCourses,
    editorPicks,
    weeklyRanking,
    statsByCourseId,
  ]);

  const peekPhase =
    activeTab === "trending"
      ? phase
      : myPhase === "needs_login"
        ? "ready"
        : myPhase;

  const activateCourse = useCallback(
    (id) => {
      if (!id) return;
      if (typeof onSelectCourse === "function") {
        onSelectCourse(id);
        return;
      }
      navigate(`/courses/${encodeURIComponent(id)}`);
    },
    [onSelectCourse, navigate]
  );

  const activateCourseFromSearch = useCallback(
    (id) => {
      closeCourseSearchMode();
      activateCourse(id);
    },
    [activateCourse, closeCourseSearchMode]
  );

  const openCourseSearch = useCallback(() => {
    onSearchFocus?.();
    openCourseSearchMode();
  }, [openCourseSearchMode, onSearchFocus]);

  const load = useCallback(async () => {
    const gen = loadGenRef.current + 1;
    loadGenRef.current = gen;
    const cached = readHomeCourseDiscoveryTrendingCache();
    let hasDisplayedRows = false;
    if (cached?.rows?.length) {
      setRows(cached.rows);
      setStatsByCourseId(cached.statsByCourseId);
      setNameByCurator(cached.nameByCurator);
      setNicknameByCurator(cached.nicknameByCurator ?? new Map());
      setPhase("ready");
      hasDisplayedRows = true;
    } else {
      setPhase("loading");
    }
    try {
      const list = await fetchPublicCuratorCourses({
        limit: HOME_COURSE_DISCOVERY_FETCH_LIMIT,
      });
      if (loadGenRef.current !== gen) return;
      const courses = await enrichCoursesWithAutoCover(
        Array.isArray(list) ? list : []
      );
      setRows(courses);
      setPhase("ready");
      hasDisplayedRows = courses.length > 0;

      const courseIds = courses
        .map((c) => String(c.id || "").trim())
        .filter(Boolean);
      const statMap = courseIds.length
        ? await getCourseEngagementStatsBatch(courseIds)
        : new Map();
      if (loadGenRef.current !== gen) return;
      setStatsByCourseId(statMap);

      const ids = [
        ...new Set(
          courses.map((c) => String(c.curator_id || "").trim()).filter(Boolean)
        ),
      ];
      const { nameByCurator: nameMap, nicknameByCurator: nicknameMap } =
        await fetchCuratorMapsForUserIds(ids);
      if (loadGenRef.current !== gen) return;
      setNameByCurator(nameMap);
      setNicknameByCurator(nicknameMap);
      commitHomeCourseDiscoveryTrendingCache({
        rows: courses,
        statsByCourseId: statMap,
        nameByCurator: nameMap,
        nicknameByCurator: nicknameMap,
        at: Date.now(),
      });
    } catch (e) {
      if (loadGenRef.current !== gen) return;
      console.warn("[HomeCoursesDiscoveryRail]", e);
      if (!hasDisplayedRows) {
        setRows([]);
        setStatsByCourseId(new Map());
        setNameByCurator(new Map());
        setNicknameByCurator(new Map());
        setPhase("error");
      }
    }
  }, []);

  const loadMyCourses = useCallback(async () => {
    const gen = myLoadGenRef.current + 1;
    myLoadGenRef.current = gen;
    if (!user?.id) {
      setMyRows([]);
      setMyPhase("needs_login");
      return;
    }
    const uid = String(user.id).trim();
    const cached = readHomeCourseDiscoveryMyCache(uid);
    let hasDisplayedRows = false;
    if (cached?.rows) {
      setMyRows(cached.rows);
      setMyPhase("ready");
      hasDisplayedRows = cached.rows.length > 0;
    } else {
      setMyPhase("loading");
    }
    try {
      const list = await fetchMyCuratorCourses(uid, { limit: 100 });
      if (myLoadGenRef.current !== gen) return;
      const courses = await enrichCoursesWithAutoCover(
        Array.isArray(list) ? list : []
      );
      setMyRows(courses);
      setMyPhase("ready");
      hasDisplayedRows = true;

      const courseIds = courses
        .map((c) => String(c.id || "").trim())
        .filter(Boolean);
      let statMap = new Map();
      if (courseIds.length > 0) {
        statMap = await getCourseEngagementStatsBatch(courseIds);
        if (myLoadGenRef.current !== gen) return;
        setStatsByCourseId((prev) => {
          const next = new Map(prev);
          for (const [k, v] of statMap.entries()) next.set(k, v);
          return next;
        });
      }
      commitHomeCourseDiscoveryMyCache(uid, {
        rows: courses,
        statsByCourseId: statMap,
        nameByCurator: new Map(),
        at: Date.now(),
      });
    } catch (e) {
      if (myLoadGenRef.current !== gen) return;
      console.warn("[HomeCoursesDiscoveryRail] my courses", e);
      if (!hasDisplayedRows) {
        setMyRows([]);
        setMyPhase("error");
      }
    }
  }, [user?.id]);

  /** 내 코스 공개/비공개 토글 — 공개는 장소 2곳 이상 필요(publishCuratorCourse) */
  const handleTogglePublic = useCallback(
    async (course) => {
      const id = String(course?.id || "").trim();
      if (!id) return;
      const isPublicNow =
        String(course?.status || "") === "published" && course?.is_public;
      setTogglingCourseId(id);
      try {
        const updated = isPublicNow
          ? await updateCuratorCourse(id, {
              status: "private",
              is_public: false,
            })
          : await publishCuratorCourse(id);
        const nextStatus = String(updated?.status || (isPublicNow ? "private" : "published"));
        const nextPublic = Boolean(updated?.is_public);
        setMyRows((prev) => {
          const next = prev.map((r) =>
            String(r.id) === id
              ? { ...r, status: nextStatus, is_public: nextPublic }
              : r
          );
          if (user?.id) {
            commitHomeCourseDiscoveryMyCache(user.id, {
              rows: next,
              statsByCourseId: new Map(),
              nameByCurator: new Map(),
              at: Date.now(),
            });
          }
          return next;
        });
        showToast(
          isPublicNow ? "비공개로 바꿨어요." : "공개했어요.",
          "success",
          2200
        );
      } catch (e) {
        showToast(
          e?.message ||
            (isPublicNow
              ? "비공개로 바꾸지 못했어요."
              : "공개하지 못했어요. (장소 2곳 이상 필요)"),
          "warning",
          3200
        );
      } finally {
        setTogglingCourseId("");
      }
    },
    [showToast, user?.id]
  );

  const handleRemoveImportedCourse = useCallback(
    async (course) => {
      const id = String(course?.id ?? "").trim();
      if (!id) return;
      if (
        !window.confirm(
          "스크랩한 코스를 삭제할까요? 원본 코스는 그대로 남습니다."
        )
      ) {
        return;
      }
      setRemovingImportId(id);
      try {
        await removeImportedCuratorCourse(id);
        setMyRows((prev) => {
          const next = prev.filter((r) => String(r.id) !== id);
          if (user?.id) {
            commitHomeCourseDiscoveryMyCache(user.id, {
              rows: next,
              statsByCourseId: new Map(),
              nameByCurator: new Map(),
              at: Date.now(),
            });
          }
          return next;
        });
        showToast("스크랩한 코스를 삭제했어요.", "success", 2200);
      } catch (e) {
        showToast(e?.message || "삭제하지 못했어요.", "warning", 3200);
      } finally {
        setRemovingImportId("");
      }
    },
    [showToast, user?.id]
  );

  const handleDeleteOwnCourse = useCallback(
    async (course) => {
      const id = String(course?.id ?? "").trim();
      if (!id) return;
      const title = String(course?.title || "").trim() || "제목 없음";
      if (
        !window.confirm(
          `「${title}」 코스를 삭제할까요?\n삭제 후 복구할 수 없습니다.`
        )
      ) {
        return;
      }
      setDeletingOwnCourseId(id);
      try {
        await deleteCuratorCourse(id);
        setMyRows((prev) => {
          const next = prev.filter((r) => String(r.id) !== id);
          if (user?.id) {
            commitHomeCourseDiscoveryMyCache(user.id, {
              rows: next,
              statsByCourseId: new Map(),
              nameByCurator: new Map(),
              at: Date.now(),
            });
          }
          return next;
        });
        setStatsByCourseId((prev) => {
          const next = new Map(prev);
          next.delete(id.toLowerCase());
          return next;
        });
        showToast("코스를 삭제했어요.", "success", 2200);
      } catch (e) {
        showToast(e?.message || "삭제하지 못했어요.", "warning", 3200);
      } finally {
        setDeletingOwnCourseId("");
      }
    },
    [showToast, user?.id]
  );

  useEffect(() => {
    if (!visible || activeTab !== "trending" || !trimmedSearch) {
      searchGenRef.current += 1;
      setSearchPhase("idle");
      setSearchResults([]);
      setSearchHasMore(false);
      setNearbyAreaSections([]);
      return undefined;
    }

    const gen = searchGenRef.current + 1;
    searchGenRef.current = gen;
    setSearchPhase("loading");

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          // 성수동→성수 등 동네명 정규화 + 인접 지역 묶음 계획
          const plan = buildCourseDiscoverySearchPlan(trimmedSearch);
          const { courses, hasMore } = await searchPublicCuratorCourses(
            plan.primaryQuery || trimmedSearch,
            {
              limit: COURSE_SEARCH_PAGE_SIZE,
              apiBaseUrl: AI_API_BASE,
            }
          );
          if (searchGenRef.current !== gen) return;
          const primary = await enrichCoursesWithAutoCover(
            Array.isArray(courses) ? courses : []
          );
          if (searchGenRef.current !== gen) return;
          setSearchResults(primary);
          setSearchHasMore(Boolean(hasMore));
          setSearchPhase("ready");
          void mergeSearchStats(primary, searchGenRef, gen);
          void mergeCuratorNames(primary, searchGenRef, gen);

          if (plan.nearby.length === 0) {
            setNearbyAreaSections([]);
            return;
          }

          // 인접 지역 코스(검색 지역과 별개 섹션) — 이미 나온 코스는 제외
          const seen = new Set(
            primary
              .map((c) => String(c?.id || "").trim().toLowerCase())
              .filter(Boolean)
          );
          const sections = [];
          for (const area of plan.nearby) {
            try {
              const r = await searchPublicCuratorCourses(area.query, {
                limit: COURSE_NEARBY_PAGE_SIZE,
                apiBaseUrl: AI_API_BASE,
              });
              if (searchGenRef.current !== gen) return;
              const fresh = (Array.isArray(r.courses) ? r.courses : []).filter(
                (c) => {
                  const id = String(c?.id || "").trim().toLowerCase();
                  if (!id || seen.has(id)) return false;
                  seen.add(id);
                  return true;
                }
              );
              if (fresh.length > 0) {
                const enrichedFresh = await enrichCoursesWithAutoCover(fresh);
                if (searchGenRef.current !== gen) return;
                sections.push({ key: area.key, courses: enrichedFresh });
                void mergeSearchStats(enrichedFresh, searchGenRef, gen);
                void mergeCuratorNames(enrichedFresh, searchGenRef, gen);
              }
            } catch (nearErr) {
              if (searchGenRef.current !== gen) return;
              console.warn(
                "[HomeCoursesDiscoveryRail] nearby search",
                area.key,
                nearErr
              );
            }
          }
          if (searchGenRef.current !== gen) return;
          setNearbyAreaSections(sections);
        } catch (e) {
          if (searchGenRef.current !== gen) return;
          console.warn("[HomeCoursesDiscoveryRail] search", e);
          setSearchResults([]);
          setSearchHasMore(false);
          setNearbyAreaSections([]);
          setSearchPhase("error");
        }
      })();
    }, COURSE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    visible,
    activeTab,
    trimmedSearch,
    mergeSearchStats,
    mergeCuratorNames,
  ]);

  useEffect(() => {
    if (!visible) {
      loadGenRef.current += 1;
      myLoadGenRef.current += 1;
      setPhase("idle");
      setMyPhase("idle");
      return undefined;
    }
    if (activeTab === "trending") {
      void load();
    } else {
      void loadMyCourses();
    }
    return () => {
      loadGenRef.current += 1;
      myLoadGenRef.current += 1;
    };
  }, [visible, activeTab, load, loadMyCourses]);

  /** 부모에서 내 코스 변경(삭제 등) 신호 — 보이는 동안 목록 재조회 */
  useEffect(() => {
    if (!visible || !refreshKey) return;
    if (activeTab === "mine" || activeTab === "imported") {
      void loadMyCourses();
    }
  }, [refreshKey, visible, activeTab, loadMyCourses]);

  if (!visible) return null;

  if (layout === "peek") {
    const peekEmptyHint =
      activeTab === "mine"
        ? myPhase === "needs_login"
          ? "로그인하면 내 코스를 볼 수 있어요."
          : "내 코스가 없어요."
        : activeTab === "imported"
          ? myPhase === "needs_login"
            ? "로그인하면 가져온 코스를 볼 수 있어요."
            : "가져온 코스가 없어요."
          : "공개 코스가 없어요.";
    return (
      <div style={{ ...styles.root, height: "auto", gap: 4 }} aria-label="지금 뜨는 코스 미리보기">
        <p style={styles.peekHint}>위로 밀면 전체 목록 · 카드 탭하면 바로 보기</p>
        <DiscoveryPeekStrip
          phase={peekPhase}
          peekCourses={peekCourses}
          nameByCurator={nameByCurator}
          nicknameByCurator={nicknameByCurator}
          onActivate={activateCourse}
          emptyHint={peekEmptyHint}
          onRetry={() =>
            void (activeTab === "trending" ? load() : loadMyCourses())
          }
        />
      </div>
    );
  }

  const renderOwnCourseCard = (c, onActivate) => {
    const cid = String(c.id || "").trim();
    const isPublic = isCoursePublicListed(c);
    const toggling = togglingCourseId === cid;
    const deleting = deletingOwnCourseId === cid;
    const placeN = Math.max(0, Math.floor(Number(c.place_count) || 0));
    const canTurnPublic = placeN >= 2;
    return (
      <CompactCourseCard
        key={cid || c.title}
        course={c}
        statsByCourseId={statsByCourseId}
        nameByCurator={nameByCurator}
        nicknameByCurator={nicknameByCurator}
        active={false}
        onActivate={onActivate}
        showEngagement
        rightSlot={
          isCurator ? (
            <div style={styles.cardActionRow}>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                aria-label={
                  isPublic
                    ? "공개 상태 — 탭하면 비공개"
                    : "비공개 상태 — 탭하면 공개"
                }
                title={
                  !isPublic && !canTurnPublic
                    ? "공개하려면 장소를 2곳 이상 추가하세요."
                    : isPublic
                      ? "공개됨 (탭하면 비공개)"
                      : "비공개 (탭하면 공개)"
                }
                disabled={toggling || (!isPublic && !canTurnPublic)}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleTogglePublic(c);
                }}
                style={{
                  ...styles.cardMiniBtn,
                  border: isPublic
                    ? "1px solid rgba(52,199,89,0.5)"
                    : T.chipBorder,
                  background: isPublic ? "rgba(52,199,89,0.16)" : T.chipBg,
                  color: isPublic ? "#34c759" : T.textSub,
                  opacity:
                    toggling || (!isPublic && !canTurnPublic) ? 0.55 : 1,
                  cursor: toggling ? "wait" : "pointer",
                }}
              >
                {toggling ? "…" : isPublic ? "공개" : "비공개"}
              </button>
              <button
                type="button"
                style={{
                  ...styles.cardMiniBtn,
                  border: `1px solid ${T.chipBorder}`,
                  background: T.chipActiveBg,
                  color: T.text,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    `/studio/courses/${encodeURIComponent(cid)}/edit`
                  );
                }}
              >
                수정
              </button>
              <button
                type="button"
                disabled={deleting}
                style={{
                  ...styles.cardMiniBtn,
                  border: "1px solid rgba(231,76,60,0.45)",
                  background: "rgba(231,76,60,0.12)",
                  color: "#ffb4a8",
                  opacity: deleting ? 0.6 : 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteOwnCourse(c);
                }}
              >
                {deleting ? "…" : "삭제"}
              </button>
            </div>
          ) : null
        }
      />
    );
  };

  const renderImportedCourseCard = (c, onActivate) => {
    const cid = String(c.id || "").trim();
    const removing = removingImportId === cid;
    return (
      <CompactCourseCard
        key={cid || c.title}
        course={c}
        statsByCourseId={statsByCourseId}
        nameByCurator={nameByCurator}
        nicknameByCurator={nicknameByCurator}
        active={false}
        onActivate={onActivate}
        showEngagement={false}
        metaExtra={COURSE_SCRAP_SECTION_TITLE}
        rightSlot={
          <button
            type="button"
            aria-label="스크랩 삭제"
            title="스크랩한 코스를 삭제합니다. 원본 코스는 그대로입니다."
            disabled={removing}
            onClick={(e) => {
              e.stopPropagation();
              void handleRemoveImportedCourse(c);
            }}
            style={{
              flexShrink: 0,
              alignSelf: "center",
              minWidth: 44,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(231,76,60,0.45)",
              background: "rgba(231,76,60,0.12)",
              color: "#ffb4a8",
              fontSize: 11,
              fontWeight: 800,
              cursor: removing ? "wait" : "pointer",
              opacity: removing ? 0.6 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {removing ? "…" : "삭제"}
          </button>
        }
      />
    );
  };

  const renderMineTabCourses = (onActivate, forOverlay = false) => {
    const listOwn = trimmedSearch ? searchedOwnCourses : ownCourses;
    const listStyle = forOverlay ? styles.overlaySearchResults : styles.singleList;

    return (
      <div style={listStyle} role="list" aria-label="내 코스">
        {isCurator ? (
          <>
            <div style={styles.mineActionRow}>
              {!studioFullscreen &&
              typeof onEnterStudioFullscreen === "function" ? (
                <button
                  type="button"
                  style={styles.studioVerBtn}
                  aria-label="Studio ver. 전체화면으로 보기"
                  title="전체화면"
                  onClick={() => {
                    setActiveTab("mine");
                    onEnterStudioFullscreen();
                  }}
                >
                  <span>✦ Studio ver.</span>
                  <span style={styles.studioVerBtnHint}>전체화면</span>
                </button>
              ) : null}
              <button
                type="button"
                style={{
                  ...styles.newCourseBtn,
                  ...(studioFullscreen ? { flex: "1 1 100%" } : null),
                }}
                aria-label="새 잔 코스"
                onClick={() => navigate("/studio/courses/new")}
              >
                +
              </button>
            </div>
            <StudioCourseSuggestionPanel
              onDraftSaved={() => void loadMyCourses()}
            />
          </>
        ) : null}
        <p style={styles.sectionTitleOwn}>내가 만든 코스</p>
        {ownCourses.length === 0 ? (
          <div style={styles.sectionEmpty}>
            {isCurator
              ? "아직 만든 잔 코스가 없어요. + 로 새 코스를 만들어 보세요."
              : "직접 만든 코스는 큐레이터만 만들 수 있어요. 가져온 탭에서 스크랩한 코스를 볼 수 있어요."}
          </div>
        ) : listOwn.length === 0 && trimmedSearch ? (
          <div style={styles.sectionEmpty}>검색 결과가 없어요.</div>
        ) : (
          listOwn.map((c) => renderOwnCourseCard(c, onActivate))
        )}
      </div>
    );
  };

  const renderImportedTabCourses = (onActivate, forOverlay = false) => {
    const listImported = trimmedSearch
      ? searchedImportedCourses
      : importedCourses;
    const listStyle = forOverlay ? styles.overlaySearchResults : styles.singleList;

    return (
      <div style={listStyle} role="list" aria-label="가져온 코스">
        <p style={styles.sectionTitleScrap}>{COURSE_SCRAP_SECTION_TITLE}</p>
        {importedCourses.length === 0 ? (
          <div style={styles.sectionEmpty}>
            가져온 코스가 없어요. 공개 코스에서 스크랩해 보세요.
          </div>
        ) : listImported.length === 0 && trimmedSearch ? (
          <div style={styles.sectionEmpty}>검색 결과가 없어요.</div>
        ) : (
          listImported.map((c) => renderImportedCourseCard(c, onActivate))
        )}
      </div>
    );
  };

  const renderPersonalList = () => {
    const tabLabel =
      activeTab === "imported" ? "가져온 코스" : "내 코스";
    const listEmpty =
      activeTab === "imported"
        ? importedCourses.length === 0
        : ownCourses.length === 0;
    const loadingEmpty =
      activeTab === "imported"
        ? importedCourses.length === 0
        : ownCourses.length === 0;

    if (myPhase === "needs_login") {
      return (
        <div style={styles.stateBox}>
          로그인하면 {tabLabel}를 볼 수 있어요.
        </div>
      );
    }
    if (myPhase === "loading" && loadingEmpty) {
      return <div style={styles.stateBox}>불러오는 중…</div>;
    }
    if (myPhase === "error") {
      return (
        <div style={styles.stateBox}>
          목록을 불러오지 못했어요.
          <button
            type="button"
            style={styles.retryBtn}
            onClick={() => void loadMyCourses()}
          >
            다시 시도
          </button>
        </div>
      );
    }
    if (listEmpty && activeTab === "imported") {
      return (
        <div style={styles.stateBox}>
          가져온 코스가 없어요. 공개 코스에서 스크랩해 보세요.
          <button
            type="button"
            style={styles.retryBtn}
            onClick={() => void loadMyCourses()}
          >
            새로고침
          </button>
        </div>
      );
    }
    if (activeTab === "imported") {
      return renderImportedTabCourses(activateCourse);
    }
    return renderMineTabCourses(activateCourse);
  };

  const courseSearchTabLabel =
    activeTab === "mine"
      ? "내 코스"
      : activeTab === "imported"
        ? "가져온 코스"
        : "지금 뜨는 코스";

  const renderTrendingSearchResults = (onActivate, forOverlay = false) => (
    <div
      style={
        forOverlay ? styles.overlaySearchResults : styles.searchResults
      }
      role="list"
      aria-label="코스 검색 결과"
    >
      {searchPhase === "loading" ? (
        <p style={styles.emptyCol}>검색 중…</p>
      ) : searchPhase === "error" ? (
        <p style={styles.emptyCol}>
          검색에 실패했어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <>
          {searchResults.length === 0 ? (
            <p style={styles.emptyCol}>
              {nearbyAreaSections.length > 0
                ? "딱 맞는 코스는 없지만, 근처 지역 코스를 모아봤어요."
                : "검색 결과가 없어요."}
            </p>
          ) : (
            <>
              {searchResults.map((c) => (
                <CompactCourseCard
                  key={String(c.id || c.title)}
                  course={c}
                  statsByCourseId={statsByCourseId}
                  nameByCurator={nameByCurator}
                  nicknameByCurator={nicknameByCurator}
                  active={false}
                  onActivate={onActivate}
                />
              ))}
              {searchHasMore ? (
                <p style={styles.emptyCol}>
                  더 많은 결과가 있어요. 검색어를 구체적으로 입력해 보세요.
                </p>
              ) : null}
            </>
          )}
          {nearbyAreaSections.map((section) => (
            <div key={section.key} role="list">
              <p style={styles.nearbySectionTitle}>
                근처 · {section.key} 코스
              </p>
              {section.courses.map((c) => (
                <CompactCourseCard
                  key={String(c.id || c.title)}
                  course={c}
                  statsByCourseId={statsByCourseId}
                  nameByCurator={nameByCurator}
                  nicknameByCurator={nicknameByCurator}
                  active={false}
                  onActivate={onActivate}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderPersonalSearchResults = (onActivate, forOverlay = false) => {
    const tabLabel =
      activeTab === "imported" ? "가져온 코스" : "내 코스";
    if (myPhase === "needs_login") {
      return (
        <div style={styles.stateBox}>
          로그인하면 {tabLabel}를 볼 수 있어요.
        </div>
      );
    }
    if (activeTab === "imported") {
      return renderImportedTabCourses(onActivate, forOverlay);
    }
    return renderMineTabCourses(onActivate, forOverlay);
  };

  const overlaySearchResults =
    activeTab === "trending"
      ? trimmedSearch
        ? renderTrendingSearchResults(activateCourseFromSearch, true)
        : null
      : trimmedSearch
        ? renderPersonalSearchResults(activateCourseFromSearch, true)
        : null;

  const searchBar = (
    <div style={styles.searchWrap}>
      {activeTab === "mine" ? (
        <span style={styles.searchIconLead} aria-hidden>
          🔍
        </span>
      ) : null}
      <input
        ref={searchInputRef}
        type="search"
        enterKeyHint="search"
        inputMode="search"
        value={searchQuery}
        readOnly
        onFocus={openCourseSearch}
        onClick={openCourseSearch}
        placeholder={
          activeTab === "mine"
            ? `공개 ${ownCourseCounts.publicN} · 비공개 ${ownCourseCounts.privateN}`
            : activeTab === "imported"
              ? "스크랩한 코스 검색"
              : "제목·지역·태그·큐레이터 검색"
        }
        autoComplete="off"
        aria-label="코스 검색"
        style={{
          ...styles.searchInput,
          ...(activeTab === "mine" ? styles.searchInputWithIcon : null),
          cursor: "text",
        }}
      />
      {searchQuery ? (
        <button
          type="button"
          style={styles.searchClear}
          aria-label="검색어 지우기"
          onClick={() => {
            setSearchQuery("");
            openCourseSearch();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );

  const renderTrendingContent = () => {
    if (phase === "loading" && rows.length === 0) {
      return <div style={styles.stateBox}>불러오는 중…</div>;
    }
    if (phase === "error") {
      return (
        <div style={styles.stateBox}>
          코스를 불러오지 못했어요.
          <button type="button" style={styles.retryBtn} onClick={() => void load()}>
            다시 시도
          </button>
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div style={styles.stateBox}>
          아직 공개된 코스가 없어요.
          <button type="button" style={styles.retryBtn} onClick={() => void load()}>
            새로고침
          </button>
        </div>
      );
    }
    if (showInlineSearchResults) {
      return renderTrendingSearchResults(activateCourse);
    }
    return (
      <div style={styles.singleList}>
        {trendingUnified.map(({ course, badge }) => (
          <CompactCourseCard
            key={String(course.id || course.title)}
            course={course}
            badge={badge}
            statsByCourseId={statsByCourseId}
            nameByCurator={nameByCurator}
            nicknameByCurator={nicknameByCurator}
            active={false}
            onActivate={activateCourse}
          />
        ))}
      </div>
    );
  };

  useEffect(() => {
    onSearchModeChange?.(courseSearchOpen);
  }, [courseSearchOpen, onSearchModeChange]);

  useEffect(() => {
    if (!visible || layout !== "full") {
      if (courseSearchOpen) closeCourseSearchMode();
    }
  }, [visible, layout, courseSearchOpen, closeCourseSearchMode]);

  return (
    <>
    <div style={styles.root} aria-label="지금 뜨는 코스">
      <div style={styles.sheetChrome}>
        <DiscoveryTabBar
          tabs={discoveryTabs}
          activeTab={activeTab}
          onChange={handleDiscoveryTabChange}
          disabled={phase === "loading" && activeTab === "trending"}
        />
        {searchBar}
      </div>
      <div style={styles.contentArea}>
        {activeTab !== "trending" ? renderPersonalList() : renderTrendingContent()}
      </div>
    </div>
    <HomeCourseSearchOverlay
      open={courseSearchOpen}
      query={searchQuery}
      onQueryChange={setSearchQuery}
      onClose={closeCourseSearchMode}
      tabLabel={courseSearchTabLabel}
      showLeadingSearchIcon={activeTab === "mine"}
      placeholder={
        activeTab === "mine"
          ? `공개 ${ownCourseCounts.publicN} · 비공개 ${ownCourseCounts.privateN}`
          : undefined
      }
      inputRef={searchInputRef}
    >
      {overlaySearchResults}
    </HomeCourseSearchOverlay>
    </>
  );
}
