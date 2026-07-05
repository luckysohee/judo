import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPublicCuratorCourses } from "../../api/curatorCourses";
import CourseStepThumbStrip from "../Course/CourseStepThumbStrip";
import {
  getCourseStatsBatch,
  pickHomeCourseCompletionMetricLine,
} from "../../api/courseCompletionStats";
import { supabase } from "../../lib/supabase";
import {
  HOME_COURSE_RAIL_FOLLOW_STAMP,
  HOME_COURSE_RAIL_PICK_STAMP,
  HOME_COURSE_RAIL_STAMP_ON_MAP,
} from "../../utils/homeCourseStampCopy";
import {
  enrichCoursesWithAutoCover,
  pickCourseDisplayCoverUrl,
} from "../../utils/courseStepThumb";

const RAIL_TITLE = "지금 뜨는 코스";
const FETCH_LIMIT = 16;
const FLOW_ARROW = " → ";

function curatorLabelFromProfile(p) {
  if (!p || typeof p !== "object") return "큐레이터";
  const dn = String(p.display_name || "").trim();
  if (dn) return dn;
  const un = String(p.username || "").trim();
  if (un) return un.startsWith("@") ? un : `@${un}`;
  return "큐레이터";
}

function formatListedAt(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function shortenLabel(s, max) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

/** 스텝당 이름 우선, 없으면 category 기반 짧은 라벨. */
function labelForPreviewStep(step) {
  if (!step || typeof step !== "object") return "";
  const name = String(step.name || "").trim();
  if (name && name !== "이름 없음") return shortenLabel(name, 12);
  const cat = String(step.category || "").trim();
  if (cat) return shortenLabel(cat, 10);
  return "";
}

/**
 * 최대 3곳 + 화살표. 더 많은 스텝이 있으면 마지막에 ···
 */
function buildFlowPreviewLine(previewSteps, placeCount) {
  const steps = Array.isArray(previewSteps) ? previewSteps : [];
  const labels = [];
  for (const s of steps.slice(0, 3)) {
    const lb = labelForPreviewStep(s);
    if (lb) labels.push(lb);
  }
  if (labels.length === 0) return "";
  let line = labels.join(FLOW_ARROW);
  const n = Number(placeCount);
  if (Number.isFinite(n) && n > labels.length) {
    line = `${line}${FLOW_ARROW}···`;
  }
  return line;
}

/**
 * 한 줄 분위기: description 우선(짧게), 없으면 area + theme_tags 조합.
 */
function buildCourseMoodCopy(course, { maxLen = 48 } = {}) {
  if (!course || typeof course !== "object") return "";
  const cap =
    typeof maxLen === "number" && maxLen > 0 ? Math.floor(maxLen) : 48;
  const desc = String(course.description || "")
    .replace(/\s+/g, " ")
    .trim();
  if (desc) {
    const firstLine = String(desc.split(/\n|\r/)[0] || "").trim();
    if (!firstLine) return "";
    if (firstLine.length <= cap) return firstLine;
    return `${firstLine.slice(0, cap - 1).trim()}…`;
  }
  const area = String(course.area || "").trim();
  const tags = (Array.isArray(course.theme_tags) ? course.theme_tags : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 4);
  if (area && tags.length >= 2) {
    return `${area} · ${tags[0]} · ${tags[1]}`;
  }
  if (area && tags.length === 1) {
    return `${area} · ${tags[0]}`;
  }
  if (tags.length >= 3) {
    return `${tags[0]} · ${tags[1]} · ${tags[2]}`;
  }
  if (tags.length === 2) {
    return `${tags[0]} · ${tags[1]}`;
  }
  if (tags.length === 1) return tags[0];
  if (area) return `${area} 루트`;
  return "";
}

const styles = {
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "calc(76px + env(safe-area-inset-top, 0px))",
    zIndex: 86,
    pointerEvents: "none",
    boxSizing: "border-box",
  },
  /** `HomeCoursesDiscovery` 패널 안에 넣을 때 — 지도 상단 고정 위치 제거 */
  wrapEmbed: {
    position: "relative",
    left: "auto",
    right: "auto",
    top: "auto",
    zIndex: "auto",
    width: "100%",
    height: "100%",
    flex: "1 1 auto",
    minHeight: 0,
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    pointerEvents: "auto",
    boxSizing: "border-box",
  },
  inner: {
    pointerEvents: "auto",
    padding: "0 10px 6px",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  innerEmbed: {
    pointerEvents: "auto",
    padding: 0,
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  innerEmbedDock: {
    pointerEvents: "auto",
    padding: "6px 8px 8px",
    width: "100%",
    height: "100%",
    flex: 1,
    minHeight: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "8px",
    paddingLeft: "4px",
    paddingRight: "max(4px, min(200px, 42vw))",
  },
  title: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#0f172a",
    textShadow: "0 1px 0 rgba(255,255,255,0.75)",
  },
  scroller: {
    display: "flex",
    flexDirection: "row",
    gap: "10px",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "6px",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    scrollSnapType: "x mandatory",
    scrollPaddingInline: "6px",
    touchAction: "pan-x",
    overscrollBehaviorX: "contain",
    boxSizing: "border-box",
  },
  /** 하단 핫 스트립 탭 안: 커버+제목 컴팩트 카드 가로 스크롤 */
  scrollerEmbed: {
    display: "flex",
    flexDirection: "row",
    gap: 0,
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 0,
    width: "100%",
    height: "76px",
    minHeight: "76px",
    maxHeight: "76px",
    alignItems: "stretch",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    scrollSnapType: "x mandatory",
    scrollPaddingInline: 0,
    touchAction: "pan-x",
    overscrollBehaviorX: "contain",
    boxSizing: "border-box",
  },
  scrollerEmbedDock: {
    display: "flex",
    flexDirection: "row",
    gap: 0,
    flex: 1,
    minHeight: 0,
    width: "100%",
    height: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    scrollSnapType: "x mandatory",
    scrollPaddingInline: 0,
    touchAction: "pan-x",
    overscrollBehaviorX: "contain",
    boxSizing: "border-box",
  },
  card: {
    flex: "0 0 min(280px, 78vw)",
    width: "min(280px, 78vw)",
    maxWidth: "min(280px, 78vw)",
    scrollSnapAlign: "center",
    borderRadius: "18px",
    overflow: "hidden",
    background: "rgba(255,255,255,0.42)",
    border: "1px solid rgba(255,255,255,0.88)",
    boxShadow:
      "0 10px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)",
    backdropFilter: "blur(20px) saturate(185%)",
    WebkitBackdropFilter: "blur(20px) saturate(185%)",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    WebkitTapHighlightColor: "transparent",
    display: "block",
  },
  cardEmbed: {
    flex: "0 0 100%",
    width: "100%",
    maxWidth: "100%",
    scrollSnapAlign: "center",
    scrollSnapStop: "always",
    borderRadius: "12px",
    overflow: "hidden",
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.9)",
    boxShadow:
      "0 4px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    WebkitTapHighlightColor: "transparent",
    display: "block",
    boxSizing: "border-box",
  },
  coverWrapEmbed: {
    position: "relative",
    width: "100%",
    height: "76px",
    flexShrink: 0,
  },
  cardEmbedDock: {
    flex: "0 0 100%",
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    scrollSnapAlign: "center",
    scrollSnapStop: "always",
    borderRadius: "12px",
    overflow: "hidden",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.92)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    WebkitTapHighlightColor: "transparent",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  coverWrapEmbedDock: {
    position: "relative",
    width: "100%",
    flex: "1 1 auto",
    minHeight: "88px",
    maxHeight: "118px",
  },
  cardBodyEmbedDock: {
    flexShrink: 0,
    padding: "7px 10px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    background: "rgba(255,255,255,0.96)",
  },
  moodLineEmbedDock: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.42,
    letterSpacing: "-0.02em",
    color: "rgba(51,65,85,0.92)",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
  },
  embedDockHintStamp: {
    flexShrink: 0,
    margin: "0 0 4px",
    padding: "5px 10px",
    borderRadius: 8,
    background: "rgba(124,58,237,0.08)",
    border: "1px dashed rgba(124,58,237,0.28)",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.4,
    color: "rgba(76,29,149,0.88)",
    textAlign: "center",
  },
  cardTitleOverlayEmbed: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    lineHeight: 1.28,
    color: "rgba(255,255,255,0.98)",
    textShadow:
      "0 2px 10px rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.2)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  coverTitleBlockEmbed: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "6px 8px 7px",
    pointerEvents: "none",
  },
  pagerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "6px",
    minHeight: "22px",
  },
  pagerBtn: {
    width: "28px",
    height: "28px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.85)",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  },
  pagerLabel: {
    fontSize: "11px",
    fontWeight: 800,
    color: "rgba(15,23,42,0.55)",
    letterSpacing: "-0.02em",
    minWidth: "52px",
    textAlign: "center",
  },
  pagerDots: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    flexShrink: 0,
  },
  pagerDot: (active) => ({
    width: active ? "7px" : "5px",
    height: active ? "7px" : "5px",
    borderRadius: 999,
    background: active ? "rgba(15,23,42,0.72)" : "rgba(15,23,42,0.22)",
    transition: "width 0.15s ease, height 0.15s ease, background 0.15s ease",
  }),
  coverWrap: {
    position: "relative",
    width: "100%",
    height: "122px",
    flexShrink: 0,
  },
  cover: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(226,232,240,0.65) 55%, rgba(251,207,232,0.35) 100%)",
  },
  coverGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "78%",
    background:
      "linear-gradient(to top, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.28) 42%, rgba(15,23,42,0) 100%)",
    pointerEvents: "none",
  },
  coverTitleBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "10px 12px 11px",
    pointerEvents: "none",
  },
  cardTitleOverlay: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: "-0.035em",
    lineHeight: 1.28,
    color: "rgba(255,255,255,0.98)",
    textShadow:
      "0 2px 12px rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.2)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cardBody: {
    padding: "10px 12px 11px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: 0,
  },
  flowRow: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "-0.025em",
    lineHeight: 1.35,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  thumbStrip: {
    marginTop: 2,
  },
  moodLine: {
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.4,
    letterSpacing: "-0.02em",
    color: "rgba(67,56,202,0.88)",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  meta: {
    fontSize: "10px",
    fontWeight: 600,
    color: "rgba(15,23,42,0.48)",
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  /** 완주 사회적 증거 한 줄 */
  metricsSlot: {
    minHeight: "14px",
    marginTop: "1px",
  },
  metricsLine: {
    fontSize: "11px",
    fontWeight: 750,
    letterSpacing: "-0.02em",
    lineHeight: 1.35,
    color: "rgba(185, 28, 28, 0.92)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  followRowEmbed: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    padding: "0 4px 2px",
    minWidth: 0,
  },
  followMetaEmbed: {
    flex: "1 1 auto",
    minWidth: 0,
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.35,
    color: "rgba(15,23,42,0.55)",
  },
  followBtnEmbed: {
    flexShrink: 0,
    border: "1px solid rgba(91,33,182,0.35)",
    background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
    color: "#5b21b6",
    borderRadius: 999,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    letterSpacing: "-0.02em",
  },
  embedPickHint: {
    margin: "0 4px 6px",
    padding: "6px 8px",
    borderRadius: 10,
    background: "rgba(99,102,241,0.08)",
    border: "1px dashed rgba(99,102,241,0.22)",
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.4,
    color: "rgba(49,46,129,0.72)",
    textAlign: "center",
  },
  empty: {
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(15,23,42,0.55)",
    padding: "12px 8px 4px",
    textAlign: "center",
    textShadow: "0 1px 0 rgba(255,255,255,0.7)",
  },
  skeletonCard: {
    flex: "0 0 min(280px, 78vw)",
    width: "min(280px, 78vw)",
    height: "248px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.35)",
    border: "1px solid rgba(255,255,255,0.5)",
    animation: "homeCourseRailPulse 1.1s ease-in-out infinite",
    scrollSnapAlign: "center",
  },
  skeletonCardEmbed: {
    flex: "0 0 100%",
    width: "100%",
    height: "76px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.35)",
    border: "1px solid rgba(255,255,255,0.5)",
    animation: "homeCourseRailPulse 1.1s ease-in-out infinite",
    scrollSnapAlign: "center",
    boxSizing: "border-box",
  },
  skeletonCardEmbedDock: {
    flex: "0 0 100%",
    width: "100%",
    height: "100%",
    minHeight: 120,
    borderRadius: "12px",
    background: "rgba(255,255,255,0.35)",
    border: "1px solid rgba(255,255,255,0.5)",
    animation: "homeCourseRailPulse 1.1s ease-in-out infinite",
    scrollSnapAlign: "center",
    boxSizing: "border-box",
  },
};

const skeletonKeyframes = `
@keyframes homeCourseRailPulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.9; }
}
`;

/** 가로 스크롤 행 — 뷰 중앙에 가장 가까운 카드 인덱스 */
function getSwipeIndexFromScroll(el) {
  if (!el || el.children.length === 0) return 0;
  const host = el.getBoundingClientRect();
  const midX = host.left + host.width / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < el.children.length; i++) {
    const cr = el.children[i].getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const d = Math.abs(cx - midX);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

const TAP_MOVE_PX = 10;

/**
 * 홈 지도 위 공개 코스 가로 레일. 장소 검색·핫스트립과 겹치지 않게 상단에 얇게 노출.
 * @param {{ visible?: boolean, embedInHotStrip?: boolean, onPreviewCourse?: (courseId: string) => void }} props
 *   `embedInHotStrip`: `HomeCoursesDiscovery` 패널 안에 넣을 때 상단 고정 레이아웃 제거.
 *   `onPreviewCourse`: 카드 탭 시에만 홈 지도 미리보기(임베드). 스와이프만으로는 미리보기 없음.
 */
export default function HomeCourseRail({
  visible = true,
  embedInHotStrip = false,
  /** 코스 탭 — 탭 고정·하단 도킹 패널(플로팅 스트립 높이는 유지) */
  embedDockExtension = false,
  onPreviewCourse,
  previewCourseId = "",
  following = false,
  followBusy = false,
  onStartFollow,
  user = null,
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(() => (visible ? "loading" : "idle"));
  const [rows, setRows] = useState([]);
  const [statsByCourseId, setStatsByCourseId] = useState(() => new Map());
  const [nameByCurator, setNameByCurator] = useState(() => new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const loadGenRef = useRef(0);
  const scrollerRef = useRef(null);
  const swipeSettleTimerRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, moved: false });
  const lastPreviewIdRef = useRef("");

  const syncActiveIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = getSwipeIndexFromScroll(el);
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  }, []);

  const onScrollerScroll = useCallback(() => {
    const prev = swipeSettleTimerRef.current;
    if (prev != null) window.clearTimeout(prev);
    swipeSettleTimerRef.current = window.setTimeout(() => {
      swipeSettleTimerRef.current = null;
      syncActiveIndexFromScroll();
    }, 180);
  }, [syncActiveIndexFromScroll]);

  const scrollToCourseIndex = useCallback((nextIdx) => {
    const el = scrollerRef.current;
    if (!el || el.children.length === 0) return;
    const clamped = Math.max(0, Math.min(el.children.length - 1, nextIdx));
    const child = el.children[clamped];
    if (!(child instanceof HTMLElement)) return;
    const host = el.getBoundingClientRect();
    const cr = child.getBoundingClientRect();
    const delta =
      cr.left + cr.width / 2 - (host.left + host.width / 2);
    el.scrollBy({ left: delta, behavior: "smooth" });
    setActiveIndex(clamped);
  }, []);

  const load = useCallback(async () => {
    const gen = loadGenRef.current + 1;
    loadGenRef.current = gen;
    setPhase("loading");
    try {
      const list = await fetchPublicCuratorCourses({ limit: FETCH_LIMIT });
      if (loadGenRef.current !== gen) return;
      const courses = await enrichCoursesWithAutoCover(
        Array.isArray(list) ? list : []
      );
      setRows(courses);

      const courseIds = courses
        .map((c) => String(c.id || "").trim())
        .filter(Boolean);
      const statMap = await getCourseStatsBatch(courseIds);
      if (loadGenRef.current !== gen) return;
      setStatsByCourseId(statMap);

      const ids = [
        ...new Set(
          courses
            .map((c) => String(c.curator_id || "").trim())
            .filter(Boolean)
        ),
      ];
      if (ids.length === 0) {
        setNameByCurator(new Map());
        setActiveIndex(0);
        lastPreviewIdRef.current = "";
        setPhase("ready");
        return;
      }
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", ids);
      if (loadGenRef.current !== gen) return;
      const m = new Map();
      if (!error && Array.isArray(profs)) {
        for (const p of profs) {
          if (p?.id) m.set(String(p.id), curatorLabelFromProfile(p));
        }
      }
      setNameByCurator(m);
      setActiveIndex(0);
      lastPreviewIdRef.current = "";
      setPhase("ready");
    } catch (e) {
      if (loadGenRef.current !== gen) return;
      console.warn("[HomeCourseRail]", e);
      setRows([]);
      setStatsByCourseId(new Map());
      setNameByCurator(new Map());
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      loadGenRef.current += 1;
      setPhase("idle");
      return undefined;
    }
    void load();
    return () => {
      loadGenRef.current += 1;
    };
  }, [visible, load]);

  useEffect(() => {
    if (!visible || phase !== "ready" || rows.length < 2) return undefined;
    const el = scrollerRef.current;
    if (!el || typeof el.addEventListener !== "function") return undefined;
    const onScrollEnd = () => {
      if (swipeSettleTimerRef.current != null) {
        window.clearTimeout(swipeSettleTimerRef.current);
        swipeSettleTimerRef.current = null;
      }
      syncActiveIndexFromScroll();
    };
    el.addEventListener("scrollend", onScrollEnd, { passive: true });
    return () => el.removeEventListener("scrollend", onScrollEnd);
  }, [visible, phase, rows.length, syncActiveIndexFromScroll]);

  useEffect(() => {
    return () => {
      if (swipeSettleTimerRef.current != null) {
        window.clearTimeout(swipeSettleTimerRef.current);
        swipeSettleTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!visible || typeof document === "undefined") return undefined;
    const id = "home-course-rail-keyframes";
    if (document.getElementById(id)) return undefined;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = skeletonKeyframes;
    document.head.appendChild(el);
    return () => {
      try {
        document.getElementById(id)?.remove();
      } catch {
        /* ignore */
      }
    };
  }, [visible]);

  if (!visible) return null;

  const embedDock = embedInHotStrip && embedDockExtension;
  const embedCompact = embedInHotStrip && !embedDockExtension;

  const wrapStyle = embedInHotStrip ? styles.wrapEmbed : styles.wrap;
  const innerStyle = embedDock
    ? styles.innerEmbedDock
    : embedInHotStrip
      ? styles.innerEmbed
      : styles.inner;
  const scrollerStyle = embedDock
    ? styles.scrollerEmbedDock
    : embedCompact
      ? styles.scrollerEmbed
      : styles.scroller;
  const cardStyle = embedDock
    ? styles.cardEmbedDock
    : embedCompact
      ? styles.cardEmbed
      : styles.card;
  const skeletonStyle = embedDock
    ? styles.skeletonCardEmbedDock
    : embedCompact
      ? styles.skeletonCardEmbed
      : styles.skeletonCard;
  const showPager = rows.length > 1 && (!embedInHotStrip || embedDock);
  const activeCourseId = String(rows[activeIndex]?.id || "").trim();
  const previewId = String(previewCourseId || "").trim();
  const showEmbedStampBanner =
    embedDock && phase === "ready" && rows.length > 0;
  const embedStampHintText = previewId
    ? HOME_COURSE_RAIL_STAMP_ON_MAP
    : HOME_COURSE_RAIL_PICK_STAMP;
  const showEmbedFollowRow =
    embedDock &&
    phase === "ready" &&
    previewId &&
    previewId === activeCourseId &&
    Boolean(user?.id) &&
    !following &&
    typeof onStartFollow === "function";

  return (
    <div style={wrapStyle} aria-label={RAIL_TITLE}>
      <div style={innerStyle}>
        {!embedInHotStrip ? (
          <div style={styles.titleRow}>
            <h2 style={styles.title}>{RAIL_TITLE}</h2>
          </div>
        ) : null}
        {phase === "loading" ? (
          <div style={scrollerStyle}>
            {[0, 1, 2].map((k) => (
              <div key={k} style={skeletonStyle} aria-hidden />
            ))}
          </div>
        ) : phase === "error" ? (
          <div style={styles.empty}>
            코스를 불러오지 못했어요.
            <button
              type="button"
              onClick={() => void load()}
              style={{
                display: "block",
                margin: "8px auto 0",
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div style={styles.empty}>
            아직 공개된 코스가 없어요.
            <button
              type="button"
              onClick={() => void load()}
              style={{
                display: "block",
                margin: "8px auto 0",
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              새로고침
            </button>
          </div>
        ) : (
          <>
            {showEmbedStampBanner ? (
              <p style={styles.embedDockHintStamp}>{embedStampHintText}</p>
            ) : null}
            {showEmbedFollowRow ? (
              <div style={styles.followRowEmbed}>
                <p style={styles.followMetaEmbed}>
                  {HOME_COURSE_RAIL_FOLLOW_STAMP}
                </p>
                <button
                  type="button"
                  style={styles.followBtnEmbed}
                  disabled={followBusy}
                  onClick={onStartFollow}
                >
                  {followBusy ? "시작 중…" : "따라가기"}
                </button>
              </div>
            ) : null}
            {showPager ? (
              <div style={styles.pagerRow} aria-live="polite">
                <button
                  type="button"
                  style={styles.pagerBtn}
                  aria-label="이전 코스"
                  disabled={activeIndex <= 0}
                  onClick={() => scrollToCourseIndex(activeIndex - 1)}
                >
                  ‹
                </button>
                <span style={styles.pagerLabel}>
                  {activeIndex + 1} / {rows.length}
                </span>
                {rows.length <= 8 ? (
                  <div style={styles.pagerDots} aria-hidden>
                    {rows.map((c, i) => (
                      <span
                        key={String(c.id || i)}
                        style={styles.pagerDot(i === activeIndex)}
                      />
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  style={styles.pagerBtn}
                  aria-label="다음 코스"
                  disabled={activeIndex >= rows.length - 1}
                  onClick={() => scrollToCourseIndex(activeIndex + 1)}
                >
                  ›
                </button>
              </div>
            ) : null}
            <div
              ref={scrollerRef}
              style={scrollerStyle}
              role="list"
              aria-label="공개 코스 미리보기, 좌우로 스와이프"
              onScroll={onScrollerScroll}
            >
            {rows.map((c, cardIndex) => {
              const id = String(c.id || "").trim();
              const title = String(c.title || "").trim() || "제목 없음";
              const cover = pickCourseDisplayCoverUrl(c);
              const area = String(c.area || "").trim();
              const cid = String(c.curator_id || "").trim();
              const curatorName =
                nameByCurator.get(cid) || curatorLabelFromProfile(null);
              const n = Number(c.place_count);
              const placeTxt =
                Number.isFinite(n) && n > 0 ? `${Math.floor(n)}곳` : "";
              const when = formatListedAt(c.created_at);
              const metaBits = [curatorName, area, placeTxt, when].filter(
                Boolean
              );
              const previewSteps = Array.isArray(c.preview_steps)
                ? c.preview_steps
                : [];
              const flowLine = buildFlowPreviewLine(previewSteps, n);
              const mood = buildCourseMoodCopy(c, {
                maxLen: embedDock ? 140 : 48,
              });
              const statRow = id ? statsByCourseId.get(id.toLowerCase()) : null;
              const metricLine = pickHomeCourseCompletionMetricLine(statRow);
              const metricLabel = metricLine
                ? `${metricLine.emoji} ${metricLine.text}`
                : "";

              return (
                <button
                  key={id || title}
                  type="button"
                  style={cardStyle}
                  role="listitem"
                  onPointerDown={(e) => {
                    pointerRef.current = {
                      x: e.clientX,
                      y: e.clientY,
                      moved: false,
                    };
                  }}
                  onPointerMove={(e) => {
                    const p = pointerRef.current;
                    if (
                      Math.abs(e.clientX - p.x) > TAP_MOVE_PX ||
                      Math.abs(e.clientY - p.y) > TAP_MOVE_PX
                    ) {
                      p.moved = true;
                    }
                  }}
                  onClick={() => {
                    if (pointerRef.current.moved) return;
                    if (!id) return;
                    if (typeof onPreviewCourse === "function") {
                      lastPreviewIdRef.current = id;
                      onPreviewCourse(id);
                      return;
                    }
                    navigate(`/courses/${encodeURIComponent(id)}`);
                  }}
                >
                  <div
                    style={
                      embedDock
                        ? styles.coverWrapEmbedDock
                        : embedCompact
                          ? styles.coverWrapEmbed
                          : styles.coverWrap
                    }
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        style={styles.cover}
                        loading="lazy"
                      />
                    ) : (
                      <div style={styles.cover} aria-hidden />
                    )}
                    <div style={styles.coverGradient} aria-hidden />
                    <div
                      style={
                        embedInHotStrip
                          ? styles.coverTitleBlockEmbed
                          : styles.coverTitleBlock
                      }
                    >
                      <h3
                        style={
                          embedInHotStrip
                            ? styles.cardTitleOverlayEmbed
                            : styles.cardTitleOverlay
                        }
                      >
                        {title}
                      </h3>
                    </div>
                  </div>
                  {!embedInHotStrip || embedDock ? (
                  <div
                    style={
                      embedDock ? styles.cardBodyEmbedDock : styles.cardBody
                    }
                  >
                    {flowLine ? (
                      <div style={styles.flowRow} title={flowLine}>
                        {flowLine}
                      </div>
                    ) : null}
                    {previewSteps.length > 0 && !embedDock ? (
                      <CourseStepThumbStrip
                        steps={previewSteps}
                        limit={3}
                        compact
                        enabled={cardIndex === activeIndex}
                        style={styles.thumbStrip}
                      />
                    ) : null}
                    {mood ? (
                      <p
                        style={
                          embedDock ? styles.moodLineEmbedDock : styles.moodLine
                        }
                      >
                        {mood}
                      </p>
                    ) : null}
                    <div style={styles.meta}>{metaBits.join(" · ")}</div>
                    {metricLine ? (
                      <div
                        style={{ ...styles.metricsSlot, ...styles.metricsLine }}
                        aria-label={metricLabel}
                      >
                        <span aria-hidden>{metricLabel}</span>
                      </div>
                    ) : (
                      <div style={styles.metricsSlot} aria-hidden />
                    )}
                  </div>
                  ) : null}
                </button>
              );
            })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
