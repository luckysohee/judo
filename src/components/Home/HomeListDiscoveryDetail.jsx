import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import {
  fetchListLikeCount,
  isListLikedByMe,
  toggleCuratorListLike,
} from "../../api/listLikes";
import { isListScrappedByMe, toggleCuratorListScrap } from "../../api/listScraps";
import { shareOrCopyCourseLink } from "../../utils/courseDetailUi";
import {
  LIST_SCRAP_LABEL_SHORT,
  LIST_SCRAPPED_LABEL,
} from "../../utils/listPickCopy";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";
import { resolveCourseStepThumbUrl } from "../../utils/courseStepThumb";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import { useToast } from "../Toast/ToastProvider";

const PAGE_TITLE_APP = "주도";

function formatCuratorAtHandle(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

function curatorHandleFromCuratorRow(row) {
  if (!row || typeof row !== "object") return "";
  return formatCuratorAtHandle(row.slug || row.username);
}

function curatorHandleFromProfile(p) {
  if (!p || typeof p !== "object") return "";
  return formatCuratorAtHandle(p.username);
}

function curatorDisplayNameFromCuratorRow(row) {
  if (!row || typeof row !== "object") return "큐레이터";
  const nick = String(row.name || row.display_name || "").trim();
  if (nick) return nick;
  const handle = String(row.slug || row.username || "").trim();
  if (!handle) return "큐레이터";
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

function curatorDisplayNameFromProfile(p) {
  if (!p || typeof p !== "object") return "큐레이터";
  const dn = String(p.display_name || "").trim();
  if (dn) return dn;
  const un = String(p.username || "").trim();
  if (!un) return "큐레이터";
  return un.startsWith("@") ? un.slice(1) : un;
}

function placeImageUrl(place) {
  const direct = String(place?.image_url || "").trim();
  if (direct) return direct;
  const embedded =
    place?.places && typeof place.places === "object" ? place.places : null;
  return String(embedded?.image_url || "").trim();
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  },
  /** 목록/접기만 고정 — 제목·좋아요는 스크롤로 올림 */
  navBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexShrink: 0,
    padding: "0 0 4px",
  },
  backBtn: {
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  },
  collapseBtn: {
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
  },
  scroller: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowX: "hidden",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    touchAction: "pan-y",
  },
  chrome: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: "0 0 8px",
  },
  h1: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    color: T.text,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textMuted,
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 0,
    overflow: "hidden",
  },
  metaSep: {
    margin: "0 4px",
    color: T.textFaint,
  },
  curatorBtn: {
    margin: 0,
    padding: "2px 8px",
    borderRadius: 999,
    border: T.chipBorder,
    background: T.chipActiveBg,
    color: T.text,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.3,
  },
  actionRow: {
    display: "flex",
    flexWrap: "nowrap",
    gap: 5,
  },
  actionBtn: (active) => ({
    flex: "1 1 0",
    minWidth: 0,
    padding: "5px 4px",
    borderRadius: 9,
    border: active
      ? "1px solid rgba(244,63,94,0.45)"
      : T.btnGhostBorder,
    background: active ? "rgba(244,63,94,0.12)" : T.btnGhostBg,
    color: active ? "#fb7185" : T.textSub,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  }),
  actionBtnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  /**
   * 스크롤 뷰포트 높이를 거의 꽉 채움 → 제목·좋아요를 올리면
   * 사진+상호+설명이 시트에 딱 들어가고, 사진은 그만큼 위로 확장
   */
  placeFill: {
    boxSizing: "border-box",
    minHeight: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    paddingBottom: 2,
  },
  placeRailWrap: {
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  placeRail: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    overflowX: "auto",
    overflowY: "hidden",
    margin: "0 -12px",
    padding: "0 12px",
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    touchAction: "pan-x",
  },
  placeCard: (focused) => ({
    flex: "0 0 min(94%, 380px)",
    width: "min(94%, 380px)",
    alignSelf: "stretch",
    height: "auto",
    minHeight: "100%",
    scrollSnapAlign: "center",
    scrollSnapStop: "always",
    borderRadius: 14,
    border: focused ? T.cardActiveBorder : T.cardBorder,
    background: focused ? T.cardActiveBg : T.cardBg,
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "minmax(0, 1fr) auto",
    boxSizing: "border-box",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
    padding: 0,
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
  }),
  placePhoto: {
    minHeight: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    background: T.thumbBg,
  },
  placePhotoEmpty: {
    minHeight: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: T.textFaint,
    background: T.thumbBg,
  },
  placeBody: {
    padding: "8px 10px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  placeDots: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    padding: "5px 0 0",
    flexShrink: 0,
  },
  placeDot: (on) => ({
    width: on ? 12 : 5,
    height: 5,
    borderRadius: 999,
    background: on ? "rgba(46,204,113,0.9)" : "rgba(255,255,255,0.22)",
    transition: "width 0.18s ease, background 0.18s ease",
  }),
};

function placeRowId(place, index) {
  return String(place?.place_id || place?.id || index).trim();
}

/**
 * 가로 스와이프 — 장소 사진 + 설명. 스냅된 카드로 지도 핀 포커스.
 * 사진: 업로드 → 카카오 → 구글 순.
 */
function ListPlaceSwipeRail({ places, focusPlaceId, onFocusPlace }) {
  const railRef = useRef(null);
  const cardRefs = useRef([]);
  const rows = Array.isArray(places) ? places : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [thumbsByKey, setThumbsByKey] = useState({});
  const [failedThumbKeys, setFailedThumbKeys] = useState(() => new Set());
  const thumbsByKeyRef = useRef({});
  const failedThumbKeysRef = useRef(new Set());
  const focusFromScrollRef = useRef(false);
  const settleTimerRef = useRef(null);
  const resolvingRef = useRef(new Set());
  thumbsByKeyRef.current = thumbsByKey;
  failedThumbKeysRef.current = failedThumbKeys;

  const resolveIndexFromScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail || rows.length === 0) return 0;
    const mid = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < rows.length; i += 1) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const center = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(center - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }, [rows.length]);

  const commitActive = useCallback(
    (idx) => {
      const i = Math.max(0, Math.min(rows.length - 1, idx));
      setActiveIndex(i);
      const place = rows[i];
      if (place && typeof onFocusPlace === "function") {
        focusFromScrollRef.current = true;
        onFocusPlace(place);
      }
    },
    [rows, onFocusPlace]
  );

  const onRailScroll = useCallback(() => {
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      commitActive(resolveIndexFromScroll());
    }, 80);
  }, [commitActive, resolveIndexFromScroll]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current != null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  /** 외부에서 리스트 탭으로 포커스가 바뀌면 해당 카드로 스크롤 */
  useEffect(() => {
    if (focusFromScrollRef.current) {
      focusFromScrollRef.current = false;
      return;
    }
    const fid = String(focusPlaceId || "").trim();
    if (!fid || rows.length === 0) return;
    const idx = rows.findIndex((p, i) => placeRowId(p, i) === fid);
    if (idx < 0) return;
    setActiveIndex(idx);
    const el = cardRefs.current[idx];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [focusPlaceId, rows]);

  const firstPlaceKey = placeRowId(rows[0], 0);
  const initKeyRef = useRef("");
  /** 펼친 직후(리스트 바뀌었을 때) 첫 장소 지도 포커스 */
  useEffect(() => {
    if (rows.length === 0) return;
    const key = `${firstPlaceKey}|${rows.length}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;
    commitActive(0);
  }, [rows.length, firstPlaceKey, commitActive]);

  /** 활성 카드 우선 → 이웃 → 나머지: 카카오·구글 썸네일 */
  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    const order = [];
    const push = (i) => {
      if (i >= 0 && i < rows.length && !order.includes(i)) order.push(i);
    };
    push(activeIndex);
    push(activeIndex + 1);
    push(activeIndex - 1);
    for (let i = 0; i < rows.length; i += 1) push(i);

    void (async () => {
      for (const i of order) {
        if (cancelled) return;
        const p = rows[i];
        const key = placeRowId(p, i);
        if (!key) continue;
        if (
          placeImageUrl(p) ||
          thumbsByKeyRef.current[key] ||
          failedThumbKeysRef.current.has(key)
        ) {
          continue;
        }
        if (resolvingRef.current.has(key)) continue;
        resolvingRef.current.add(key);
        try {
          const w = resolvePlaceWgs84(p);
          const url = await resolveCourseStepThumbUrl(
            {
              place_id: p.place_id || p.id,
              name: p.place_name,
              place_name: p.place_name,
              address: p.place_address,
              place_address: p.place_address,
              lat: w?.lat ?? p.lat,
              lng: w?.lng ?? p.lng,
              kakao_place_id: p.kakao_place_id,
              image_url: p.image_url,
            },
            { skipGoogleFallback: false }
          );
          if (cancelled) continue;
          if (url) {
            setThumbsByKey((prev) =>
              prev[key] ? prev : { ...prev, [key]: url }
            );
          } else {
            setFailedThumbKeys((prev) => {
              if (prev.has(key)) return prev;
              const next = new Set(prev);
              next.add(key);
              return next;
            });
          }
        } catch {
          if (!cancelled) {
            setFailedThumbKeys((prev) => {
              const next = new Set(prev);
              next.add(key);
              return next;
            });
          }
        } finally {
          resolvingRef.current.delete(key);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, activeIndex]);

  if (rows.length === 0) {
    return (
      <div style={{ color: T.textMuted, fontSize: 13, padding: "16px 4px" }}>
        담긴 장소가 없어요.
      </div>
    );
  }

  return (
    <div style={styles.placeRailWrap}>
      <div
        ref={railRef}
        style={styles.placeRail}
        onScroll={onRailScroll}
        aria-label="맛집첩 장소 가로 스크롤"
      >
        <style>{`
          [aria-label="맛집첩 장소 가로 스크롤"]::-webkit-scrollbar { display: none; }
        `}</style>
        {rows.map((p, i) => {
          const pid = placeRowId(p, i);
          const name =
            String(p?.place_name || "이름 없음").trim() || "이름 없음";
          const memo = String(p?.memo || "").trim();
          const img = placeImageUrl(p) || thumbsByKey[pid] || "";
          const focused =
            i === activeIndex ||
            (Boolean(focusPlaceId) && pid === String(focusPlaceId));

          return (
            <button
              key={pid || String(i)}
              type="button"
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={styles.placeCard(focused)}
              aria-label={`${i + 1}번째 ${name}`}
              aria-current={focused ? "true" : undefined}
              onClick={() => {
                const el = cardRefs.current[i];
                if (el && typeof el.scrollIntoView === "function") {
                  el.scrollIntoView({
                    behavior: "smooth",
                    inline: "center",
                    block: "nearest",
                  });
                }
                commitActive(i);
              }}
            >
              {img ? (
                <img src={img} alt="" style={styles.placePhoto} loading="lazy" />
              ) : (
                <div style={styles.placePhotoEmpty}>
                  {failedThumbKeys.has(pid) ? "사진 없음" : "사진 불러오는 중…"}
                </div>
              )}
              <div style={styles.placeBody}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 900,
                      color: "#d6ffe6",
                      background: "rgba(46,204,113,0.18)",
                      border: "1px solid rgba(46,204,113,0.35)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: T.text,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                </div>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    color: memo
                      ? "rgba(255,255,255,0.86)"
                      : T.textFaint,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {memo || "작성한 이유가 없어요"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {rows.length > 1 ? (
        <div style={styles.placeDots} aria-hidden>
          {rows.map((_, i) => (
            <span key={i} style={styles.placeDot(i === activeIndex)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 맛집첩 펼침 미리보기 — 큐레이터 · 좋아요 · 공유 · 스크랩 · 해시태그
 */
export default function HomeListDiscoveryDetail({
  list,
  places,
  curatorLabel = "",
  user = null,
  sheetSnap = "expanded",
  onBack,
  onSheetCollapse,
  onSheetExpand,
  onFocusPlace,
  focusPlaceId = "",
  onOpenCurator,
  resolveCuratorHandle,
}) {
  const { showToast } = useToast();
  const listId = String(list?.id || "").trim();
  const title = String(list?.title || "맛집첩").trim() || "맛집첩";
  const description = String(list?.description || "").trim();
  const area = String(list?.area || "").trim();
  const rows = Array.isArray(places) ? places : [];

  const [curatorHandle, setCuratorHandle] = useState(
    () => curatorLabel || "큐레이터"
  );
  const [curatorDisplayName, setCuratorDisplayName] = useState("큐레이터");
  const [curatorProfile, setCuratorProfile] = useState(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [scrappedByMe, setScrappedByMe] = useState(false);
  const [scrapBusy, setScrapBusy] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !listId) return "";
    const u = new URL(window.location.href);
    u.pathname = "/";
    u.search = `list=${encodeURIComponent(listId)}`;
    u.hash = "";
    return u.toString();
  }, [listId]);

  useEffect(() => {
    let cancelled = false;
    const cid = String(list?.curator_id || "").trim();
    if (!cid) {
      setCuratorHandle(curatorLabel || "큐레이터");
      setCuratorDisplayName("큐레이터");
      setCuratorProfile(null);
      return undefined;
    }
    const hint =
      typeof resolveCuratorHandle === "function"
        ? resolveCuratorHandle(cid)
        : null;
    if (hint) setCuratorHandle(hint);
    else if (curatorLabel) setCuratorHandle(curatorLabel);

    void (async () => {
      const [curRes, profRes] = await Promise.all([
        supabase
          .from("curators")
          .select("slug, username, name, display_name")
          .eq("user_id", cid)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, display_name, username")
          .eq("id", cid)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const curatorRow =
        curRes.data && !curRes.error ? curRes.data : null;
      const profile =
        profRes.data && !profRes.error ? profRes.data : null;
      setCuratorProfile(profile);
      setCuratorHandle(
        curatorHandleFromCuratorRow(curatorRow) ||
          curatorHandleFromProfile(profile) ||
          hint ||
          curatorLabel ||
          "큐레이터"
      );
      setCuratorDisplayName(
        curatorDisplayNameFromCuratorRow(curatorRow) ||
          curatorDisplayNameFromProfile(profile)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [list?.curator_id, curatorLabel, resolveCuratorHandle]);

  useEffect(() => {
    let cancelled = false;
    if (!listId) {
      setLikeCount(0);
      return undefined;
    }
    void fetchListLikeCount(listId).then((n) => {
      if (!cancelled) setLikeCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !listId) {
      setLikedByMe(false);
      setScrappedByMe(false);
      return undefined;
    }
    void Promise.all([
      isListLikedByMe(listId),
      isListScrappedByMe(listId),
    ]).then(([liked, scrap]) => {
      if (cancelled) return;
      setLikedByMe(liked);
      setScrappedByMe(scrap);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, listId]);

  const handleCuratorClick = useCallback(() => {
    const cid = String(list?.curator_id || "").trim();
    if (!cid || typeof onOpenCurator !== "function") return;
    onOpenCurator({
      curatorId: cid,
      name: curatorDisplayName,
      profile: curatorProfile,
    });
  }, [list?.curator_id, onOpenCurator, curatorDisplayName, curatorProfile]);

  const handleToggleLike = useCallback(async () => {
    if (!listId) return;
    if (!user?.id) {
      showToast("로그인한 뒤 좋아요를 눌러 주세요.", "info", 3200);
      return;
    }
    setLikeBusy(true);
    try {
      const r = await toggleCuratorListLike(listId);
      setLikedByMe(r.liked);
      setLikeCount(r.likeCount);
    } catch (e) {
      showToast(e?.message || "좋아요를 처리하지 못했어요.", "warning", 3200);
    } finally {
      setLikeBusy(false);
    }
  }, [listId, user?.id, showToast]);

  const handleShare = useCallback(async () => {
    try {
      const r = await shareOrCopyCourseLink({
        url: shareUrl,
        title,
        text: `${title} — ${PAGE_TITLE_APP} 맛집첩`,
      });
      if (r === "clipboard") {
        showToast("링크를 복사했어요.", "success", 2500);
      }
    } catch {
      if (shareUrl) {
        window.prompt("아래 링크를 복사해 주세요.", shareUrl);
      }
    }
  }, [shareUrl, title, showToast]);

  const handleToggleScrap = useCallback(async () => {
    if (!listId) return;
    if (!user?.id) {
      showToast("로그인한 뒤 스크랩할 수 있어요.", "info", 3200);
      return;
    }
    setScrapBusy(true);
    try {
      const r = await toggleCuratorListScrap(listId);
      setScrappedByMe(r.scrapped);
      showToast(
        r.scrapped ? "맛집첩을 스크랩했어요." : "스크랩을 해제했어요.",
        "success",
        2400
      );
    } catch (e) {
      showToast(e?.message || "스크랩을 처리하지 못했어요.", "warning", 3200);
    } finally {
      setScrapBusy(false);
    }
  }, [listId, user?.id, showToast]);

  const canOpenCurator =
    typeof onOpenCurator === "function" &&
    Boolean(String(list?.curator_id || "").trim());

  const metaRest = [
    area || null,
    rows.length > 0 ? `${rows.length}곳` : null,
  ].filter(Boolean);

  const sheetCollapsed = sheetSnap === "collapsed";
  const canToggleSheet =
    sheetCollapsed
      ? typeof onSheetExpand === "function"
      : typeof onSheetCollapse === "function";

  return (
    <div style={styles.root}>
      <div style={styles.navBar}>
        <button type="button" style={styles.backBtn} onClick={() => onBack?.()}>
          ← 목록
        </button>
        {canToggleSheet ? (
          <button
            type="button"
            style={styles.collapseBtn}
            onClick={() => {
              if (sheetCollapsed) onSheetExpand?.();
              else onSheetCollapse?.();
            }}
            aria-label={sheetCollapsed ? "시트 펼치기" : "시트 접기"}
          >
            {sheetCollapsed ? "∧ 펼치기" : "∨ 접기"}
          </button>
        ) : (
          <span />
        )}
      </div>

      <div style={styles.scroller} aria-label="맛집첩 미리보기">
        <style>{`
          [aria-label="맛집첩 미리보기"]::-webkit-scrollbar { display: none; }
        `}</style>

        <div style={styles.chrome}>
          <h2 style={styles.h1} title={description || title}>
            {title}
          </h2>
          <div style={styles.meta}>
            {[
              canOpenCurator ? (
                <button
                  key="curator"
                  type="button"
                  style={styles.curatorBtn}
                  onClick={handleCuratorClick}
                  aria-label={`${curatorHandle} 큐레이터 프로필`}
                >
                  {curatorHandle}
                </button>
              ) : curatorHandle ? (
                <span key="curator">{curatorHandle}</span>
              ) : null,
              ...metaRest.map((bit, i) => (
                <span key={`meta-${i}`}>{bit}</span>
              )),
            ]
              .filter(Boolean)
              .map((node, i) => (
                <Fragment key={i}>
                  {i > 0 ? (
                    <span style={styles.metaSep} aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {node}
                </Fragment>
              ))}
          </div>

          <div style={styles.actionRow}>
            <button
              type="button"
              style={{
                ...styles.actionBtn(likedByMe),
                ...(likeBusy ? styles.actionBtnDisabled : null),
              }}
              disabled={likeBusy}
              aria-pressed={likedByMe}
              onClick={() => void handleToggleLike()}
            >
              {likeBusy
                ? "…"
                : `${likedByMe ? "♥" : "♡"} ${
                    likeCount > 0 ? likeCount : "좋아요"
                  }`}
            </button>
            <button
              type="button"
              style={styles.actionBtn(false)}
              onClick={() => void handleShare()}
            >
              공유
            </button>
            <button
              type="button"
              style={{
                ...styles.actionBtn(scrappedByMe),
                ...(scrapBusy ? styles.actionBtnDisabled : null),
              }}
              disabled={scrapBusy}
              aria-pressed={scrappedByMe}
              title={!user?.id ? "로그인이 필요해요" : "맛집첩 스크랩"}
              onClick={() => void handleToggleScrap()}
            >
              {scrapBusy
                ? "…"
                : scrappedByMe
                  ? LIST_SCRAPPED_LABEL
                  : LIST_SCRAP_LABEL_SHORT}
            </button>
          </div>
        </div>

        <div style={styles.placeFill} aria-label="담은 장소">
          {rows.length > 0 ? (
            <ListPlaceSwipeRail
              places={rows}
              focusPlaceId={focusPlaceId}
              onFocusPlace={onFocusPlace}
            />
          ) : (
            <div
              style={{ color: T.textMuted, fontSize: 13, padding: "12px 4px" }}
            >
              담긴 장소가 없어요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
