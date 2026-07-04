import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyCuratorCourses,
  fetchPublicCuratorCourses,
  publishCuratorCourse,
  updateCuratorCourse,
} from "../../api/curatorCourses";
import { useToast } from "../Toast/ToastProvider";
import { searchPublicCuratorCourses } from "../../api/searchPublicCourses";
import { buildCourseDiscoverySearchPlan } from "../../utils/courseSearchAreaExpansion";
import { splitMyCuratorCourses } from "../../utils/courseImportUi";
import { COURSE_SCRAP_SECTION_TITLE } from "../../utils/coursePickCopy";
import {
  getCourseEngagementStatsBatch,
  pickHomeCourseCompletionMetricLine,
} from "../../api/courseCompletionStats";
import { supabase } from "../../lib/supabase";
import {
  HOME_COURSE_DISCOVERY_FETCH_LIMIT,
  buildHomeCourseDiscoveryPeekList,
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

const COURSE_SEARCH_DEBOUNCE_MS = 320;
const COURSE_SEARCH_PAGE_SIZE = 24;
const COURSE_NEARBY_PAGE_SIZE = 6;
const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

function curatorLabelFromProfile(p) {
  if (!p || typeof p !== "object") return "큐레이터";
  const dn = String(p.display_name || "").trim();
  if (dn) return dn;
  const un = String(p.username || "").trim();
  if (un) return un.startsWith("@") ? un : `@${un}`;
  return "큐레이터";
}

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
  active,
  onActivate,
  metaExtra = "",
  showEngagement = true,
  rightSlot = null,
}) {
  const id = String(course?.id || "").trim();
  const title = String(course?.title || "").trim() || "제목 없음";
  const cover = String(course?.cover_image_url || "").trim();
  const area = String(course?.area || "").trim();
  const cid = String(course?.curator_id || "").trim();
  const curatorName = nameByCurator.get(cid) || "큐레이터";
  const n = Number(course?.place_count);
  const placeTxt = Number.isFinite(n) && n > 0 ? `${Math.floor(n)}곳` : "";
  const metaBits = [metaExtra, curatorName, area, placeTxt].filter(Boolean);
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
        <div style={styles.cardMeta}>{metaBits.join(" · ")}</div>
        {showEngagement && metricLine ? (
          <div style={styles.cardMetric}>
            {metricLine.emoji} {metricLine.text}
          </div>
        ) : null}
      </div>
      {rightSlot}
    </div>
  );
}

function PeekCourseCard({ course, nameByCurator, onActivate }) {
  const id = String(course?.id || "").trim();
  const title = String(course?.title || "").trim() || "제목 없음";
  const cover = String(course?.cover_image_url || "").trim();
  const area = String(course?.area || "").trim();
  const cid = String(course?.curator_id || "").trim();
  const curatorName = nameByCurator.get(cid) || "큐레이터";
  const n = Number(course?.place_count);
  const placeTxt = Number.isFinite(n) && n > 0 ? `${Math.floor(n)}곳` : "";
  const metaBits = [placeTxt, area || curatorName].filter(Boolean);

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
      {peekCourses.map((c) => (
        <PeekCourseCard
          key={String(c.id || c.title)}
          course={c}
          nameByCurator={nameByCurator}
          onActivate={onActivate}
        />
      ))}
    </div>
  );
}

function DiscoveryTabBar({ activeTab, onChange, disabled }) {
  return (
    <div
      style={styles.tabRow}
      role="tablist"
      aria-label="코스 목록 종류"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {DISCOVERY_TABS.map((tab) => {
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

function DiscoveryColumn({
  title,
  courses,
  emptyHint,
  statsByCourseId,
  nameByCurator,
  onActivate,
}) {
  return (
    <section style={styles.column} aria-label={title}>
      <h3 style={styles.columnTitle}>{title}</h3>
      <div style={styles.columnScroll}>
        {courses.length === 0 ? (
          <p style={styles.emptyCol}>{emptyHint}</p>
        ) : (
          courses.map((c) => (
            <CompactCourseCard
              key={String(c.id || c.title)}
              course={c}
              statsByCourseId={statsByCourseId}
              nameByCurator={nameByCurator}
              active={false}
              onActivate={onActivate}
            />
          ))
        )}
      </div>
    </section>
  );
}

/**
 * 홈 「지금 뜨는 코스」 패널 — 에디터픽/주간 랭킹 4+4, 상단 검색.
 */
export default function HomeCoursesDiscoveryRail({
  visible = true,
  /** @type {'full'|'peek'} */
  layout = "full",
  user = null,
  refreshKey = 0,
  onSelectCourse,
  onSearchFocus,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const trendingCacheOnMount = readHomeCourseDiscoveryTrendingCache();
  const myCacheOnMount = readHomeCourseDiscoveryMyCache(user?.id);
  /** @type {'trending'|'mine'|'imported'} */
  const [activeTab, setActiveTab] = useState("trending");
  /** 공개/비공개 토글 진행 중 course id */
  const [togglingCourseId, setTogglingCourseId] = useState("");
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

  const trimmedSearch = String(searchQuery || "").trim();

  const { editorPicks, weeklyRanking } = useMemo(
    () => partitionHomeCourseDiscovery(rows, statsByCourseId),
    [rows, statsByCourseId]
  );

  const { ownCourses, importedCourses } = useMemo(
    () => splitMyCuratorCourses(myRows),
    [myRows]
  );

  const personalTabCourses = useMemo(() => {
    if (activeTab === "mine") return ownCourses;
    if (activeTab === "imported") return importedCourses;
    return [];
  }, [activeTab, ownCourses, importedCourses]);

  const filteredPersonalCourses = useMemo(() => {
    if (!trimmedSearch) return personalTabCourses;
    // 성수동 → 성수 등 동네명을 클러스터 키로 정규화해 부분일치 누락 방지
    const plan = buildCourseDiscoverySearchPlan(trimmedSearch);
    const q = plan.primaryQuery || trimmedSearch;
    return filterCoursesForDiscoverySearch(personalTabCourses, q, {
      nameByCurator,
    });
  }, [personalTabCourses, trimmedSearch, nameByCurator]);

  const mergeCuratorNames = useCallback(async (courses, genRef, gen) => {
    const ids = [
      ...new Set(
        (Array.isArray(courses) ? courses : [])
          .map((c) => String(c.curator_id || "").trim())
          .filter(Boolean)
      ),
    ];
    if (ids.length === 0) return;
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", ids);
    if (genRef.current !== gen) return;
    if (error || !Array.isArray(profs)) return;
    setNameByCurator((prev) => {
      const next = new Map(prev);
      for (const p of profs) {
        if (p?.id) next.set(String(p.id), curatorLabelFromProfile(p));
      }
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
    if (activeTab === "mine") return ownCourses.slice(0, 6);
    if (activeTab === "imported") return importedCourses.slice(0, 6);
    return buildHomeCourseDiscoveryPeekList(editorPicks, weeklyRanking, 6);
  }, [activeTab, ownCourses, importedCourses, editorPicks, weeklyRanking]);

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

  const load = useCallback(async () => {
    const gen = loadGenRef.current + 1;
    loadGenRef.current = gen;
    const cached = readHomeCourseDiscoveryTrendingCache();
    let hasDisplayedRows = false;
    if (cached?.rows?.length) {
      setRows(cached.rows);
      setStatsByCourseId(cached.statsByCourseId);
      setNameByCurator(cached.nameByCurator);
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
      const courses = Array.isArray(list) ? list : [];
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
      let nameMap = new Map();
      if (ids.length > 0) {
        const { data: profs, error } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", ids);
        if (loadGenRef.current !== gen) return;
        if (!error && Array.isArray(profs)) {
          for (const p of profs) {
            if (p?.id) nameMap.set(String(p.id), curatorLabelFromProfile(p));
          }
        }
      }
      setNameByCurator(nameMap);
      commitHomeCourseDiscoveryTrendingCache({
        rows: courses,
        statsByCourseId: statMap,
        nameByCurator: nameMap,
        at: Date.now(),
      });
    } catch (e) {
      if (loadGenRef.current !== gen) return;
      console.warn("[HomeCoursesDiscoveryRail]", e);
      if (!hasDisplayedRows) {
        setRows([]);
        setStatsByCourseId(new Map());
        setNameByCurator(new Map());
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
      const courses = Array.isArray(list) ? list : [];
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
          const primary = Array.isArray(courses) ? courses : [];
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
                sections.push({ key: area.key, courses: fresh });
                void mergeSearchStats(fresh, searchGenRef, gen);
                void mergeCuratorNames(fresh, searchGenRef, gen);
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
          onActivate={activateCourse}
          emptyHint={peekEmptyHint}
          onRetry={() =>
            void (activeTab === "trending" ? load() : loadMyCourses())
          }
        />
      </div>
    );
  }

  const renderPersonalList = () => {
    if (myPhase === "needs_login") {
      return (
        <div style={styles.stateBox}>
          로그인하면{" "}
          {activeTab === "imported" ? "가져온 코스" : "내 코스"}를 볼 수 있어요.
        </div>
      );
    }
    if (myPhase === "loading" && personalTabCourses.length === 0) {
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
    if (personalTabCourses.length === 0) {
      return (
        <div style={styles.stateBox}>
          {activeTab === "imported"
            ? "가져온 코스가 없어요. 공개 코스에서 스크랩해 보세요."
            : "아직 만든 코스가 없어요. 스튜디오에서 만들어 보세요."}
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
    if (filteredPersonalCourses.length === 0) {
      return (
        <div style={styles.stateBox}>검색 결과가 없어요.</div>
      );
    }
    return (
      <div style={styles.singleList} role="list">
        {filteredPersonalCourses.map((c) => {
          const cid = String(c.id || "").trim();
          const isMine = activeTab === "mine";
          const isPublic =
            String(c?.status || "") === "published" && c?.is_public;
          const toggling = togglingCourseId === cid;
          return (
            <CompactCourseCard
              key={cid || c.title}
              course={c}
              statsByCourseId={statsByCourseId}
              nameByCurator={nameByCurator}
              active={false}
              onActivate={activateCourse}
              showEngagement={isMine}
              metaExtra={
                activeTab === "imported" ? COURSE_SCRAP_SECTION_TITLE : ""
              }
              rightSlot={
                isMine ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPublic}
                    aria-label={isPublic ? "공개 상태 — 탭하면 비공개" : "비공개 상태 — 탭하면 공개"}
                    title={isPublic ? "공개됨 (탭하면 비공개)" : "비공개 (탭하면 공개)"}
                    disabled={toggling}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleTogglePublic(c);
                    }}
                    style={{
                      flexShrink: 0,
                      alignSelf: "center",
                      minWidth: 58,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: isPublic
                        ? "1px solid rgba(52,199,89,0.5)"
                        : T.chipBorder,
                      background: isPublic
                        ? "rgba(52,199,89,0.16)"
                        : T.chipBg,
                      color: isPublic ? "#34c759" : T.textSub,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: toggling ? "wait" : "pointer",
                      opacity: toggling ? 0.6 : 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {toggling ? "…" : isPublic ? "공개" : "비공개"}
                  </button>
                ) : null
              }
            />
          );
        })}
      </div>
    );
  };

  const searchBar = (
    <div style={styles.searchWrap}>
      <input
        ref={searchInputRef}
        type="search"
        enterKeyHint="search"
        inputMode="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => onSearchFocus?.()}
        placeholder="제목·지역·태그·큐레이터 검색"
        autoComplete="off"
        aria-label="코스 검색"
        style={styles.searchInput}
      />
      {searchQuery ? (
        <button
          type="button"
          style={styles.searchClear}
          aria-label="검색어 지우기"
          onClick={() => {
            setSearchQuery("");
            searchInputRef.current?.focus();
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
    if (trimmedSearch) {
      return (
        <div style={styles.searchResults} role="list" aria-label="코스 검색 결과">
          {searchPhase === "loading" ? (
            <p style={styles.emptyCol}>검색 중…</p>
          ) : searchPhase === "error" ? (
            <p style={styles.emptyCol}>
              검색에 실패했어요. API 서버와 DB 마이그레이션을 확인해 주세요.
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
                      active={false}
                      onActivate={activateCourse}
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
                      active={false}
                      onActivate={activateCourse}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      );
    }
    return (
      <div style={styles.columns}>
        <DiscoveryColumn
          title="에디터픽"
          courses={editorPicks}
          emptyHint="공개 코스가 더 생기면 여기도 채워져요."
          statsByCourseId={statsByCourseId}
          nameByCurator={nameByCurator}
          onActivate={activateCourse}
        />
        <DiscoveryColumn
          title="이번 주 랭킹"
          courses={weeklyRanking}
          emptyHint="공개 코스가 더 생기면 여기도 채워져요."
          statsByCourseId={statsByCourseId}
          nameByCurator={nameByCurator}
          onActivate={activateCourse}
        />
      </div>
    );
  };

  return (
    <div style={styles.root} aria-label="지금 뜨는 코스">
      <div style={styles.sheetChrome}>
        <DiscoveryTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          disabled={phase === "loading" && activeTab === "trending"}
        />
        {searchBar}
      </div>
      <div style={styles.contentArea}>
        {activeTab !== "trending" ? renderPersonalList() : renderTrendingContent()}
      </div>
    </div>
  );
}
