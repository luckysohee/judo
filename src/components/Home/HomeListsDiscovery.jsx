import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchCuratorListPlaces,
  fetchMyCuratorLists,
  fetchPublicCuratorLists,
} from "../../api/curatorLists";
import { searchPublicCuratorLists } from "../../api/searchPublicLists";
import { fetchCuratorMapsForUserIds } from "../../utils/curatorCourseDiscoveryLabels";
import { filterListsForDiscoverySearch } from "../../utils/listDiscoverySearch";
import {
  enrichListsWithAutoCover,
  pickListDisplayCoverUrl,
} from "../../utils/listCoverThumb";
import { buildHomeListDiscoveryUnifiedList } from "../../utils/homeListDiscoveryLists";
import { getListLikeStatsBatch } from "../../api/listLikes";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";
import {
  HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX,
  HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX,
  homeCoursesDiscoverySheetExpandedPx,
  homeListsDiscoveryBrowseExpandedPx,
  homeCoursesDiscoverySheetMaxHeightCss,
  homeHotStripCoursesWrapBottomCss,
} from "../../utils/homeHotStripLayout";
import { useVerticalSnapSheet } from "../../hooks/useVerticalSnapSheet";
import { useVisualViewportBottomInset } from "../../hooks/useVisualViewportBottomInset";
import HomeListDiscoveryDetail from "./HomeListDiscoveryDetail";

const SHEET_HEIGHT_TRANSITION = "height 0.28s cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * 홈 지도 우측 — 「맛집첩」 엔트리 칩 (코스 칩 자매)
 */
export function HomeListsEntryChip({
  visible = false,
  open = false,
  onToggle,
  buttonStyle = {},
  activeButtonStyle = {},
  labelStyle = {},
}) {
  if (!visible || typeof onToggle !== "function") return null;
  const label = open ? "맛집첩 닫기" : "맛집첩";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="home-lists-discovery-panel"
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
        }}
        aria-hidden
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
        >
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      </span>
      <span style={labelStyle}>맛집첩</span>
    </button>
  );
}

function ListCard({ list, curatorLabel = "", badge = null, onOpen }) {
  const title = String(list?.title || "").trim() || "제목 없음";
  const cover = pickListDisplayCoverUrl(list);
  const n = Number(list?.place_count);
  const placeTxt = Number.isFinite(n) && n > 0 ? `${Math.floor(n)}곳` : "";
  const metaBits = [curatorLabel || null, placeTxt || null].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(list)}
      aria-label={title}
      style={{
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
      }}
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: 8,
            objectFit: "cover",
            display: "block",
            background: T.thumbBg,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: 8,
            background: T.thumbBg,
          }}
        />
      )}
      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <h4
          style={{
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
          }}
        >
          {title}
        </h4>
        {badge ? (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.textSub,
              lineHeight: 1.3,
            }}
          >
            {badge.emoji} {badge.text}
          </div>
        ) : null}
        {metaBits.length > 0 ? (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {metaBits.join(" · ")}
          </div>
        ) : null}
      </div>
    </button>
  );
}

/**
 * 홈 — 공개 맛집첩 바텀시트 (코스 디스커버리 시트 패턴)
 */
export default function HomeListsDiscoveryPanel({
  open = false,
  onClose,
  user = null,
  isCurator = false,
  browseList = null,
  onBrowseBack,
  onSpreadList,
  onFocusPlace,
  focusPlaceId = "",
  onOpenCurator,
  resolveCuratorHandle,
  onPlaceThumb,
  onSheetSnapChange,
  sheetResetKey = 0,
}) {
  const navigate = useNavigate();
  const { visibleHeightPx, layoutHeightPx, open: keyboardOpen } =
    useVisualViewportBottomInset();
  const browsingPreview = Boolean(browseList?.list);
  const expandedPx = browsingPreview
    ? homeListsDiscoveryBrowseExpandedPx(layoutHeightPx, {
        visibleH: visibleHeightPx,
        keyboardOpen,
      })
    : homeCoursesDiscoverySheetExpandedPx(layoutHeightPx, {
        visibleH: visibleHeightPx,
        keyboardOpen,
      });
  const collapsedPx = HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX;
  const minimizedPx = HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX;

  const {
    snap,
    heightPx,
    isDragging,
    onDragHandlePointerDown,
    setSnapCollapsed,
    setSnapExpanded,
  } = useVerticalSnapSheet({
    enabled: open,
    expandedPx,
    collapsedPx,
    minimizedPx,
    initialSnap: "expanded",
    resetKey: open ? sheetResetKey : 0,
  });

  useEffect(() => {
    if (!open || isDragging || snap !== "minimized") return;
    onClose?.();
  }, [open, snap, isDragging, onClose]);

  useEffect(() => {
    onSheetSnapChange?.(open ? snap : "closed");
  }, [open, snap, onSheetSnapChange]);

  const [tab, setTab] = useState("trending");
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState([]);
  const [nameByCurator, setNameByCurator] = useState(() => new Map());
  const [statsByListId, setStatsByListId] = useState(() => new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const browsing = Boolean(browseList?.list);
  const browsePlaces = Array.isArray(browseList?.places)
    ? browseList.places
    : [];
  const searchTrimmed = String(debouncedSearch || "").trim();
  const isSearching = searchTrimmed.length > 0;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 220);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedSearch("");
      setSearchResults(null);
      return;
    }
    if (browsing) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        let rows = [];
        if (tab === "mine" && user?.id && isCurator) {
          rows = await fetchMyCuratorLists(user.id);
        } else {
          rows = await fetchPublicCuratorLists({ limit: 48 });
        }
        if (cancelled) return;
        const withCovers = await enrichListsWithAutoCover(rows);
        if (cancelled) return;
        setLists(withCovers);
        const uids = [
          ...new Set(
            withCovers
              .map((r) => String(r.curator_id || "").trim())
              .filter(Boolean)
          ),
        ];
        const listIds = withCovers
          .map((r) => String(r.id || "").trim())
          .filter(Boolean);
        const [map, stats] = await Promise.all([
          fetchCuratorMapsForUserIds(uids),
          tab === "trending"
            ? getListLikeStatsBatch(listIds)
            : Promise.resolve(new Map()),
        ]);
        if (cancelled) return;
        if (map?.nameByCurator) {
          setNameByCurator((prev) => {
            const next = new Map(prev);
            for (const [k, v] of map.nameByCurator) next.set(k, v);
            return next;
          });
        }
        setStatsByListId(stats instanceof Map ? stats : new Map());
      } catch (e) {
        console.warn("[맛집첩] load:", e);
        if (!cancelled) {
          setLists([]);
          setStatsByListId(new Map());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, user?.id, isCurator, browsing]);

  const curatorLabelFor = useCallback(
    (list) => {
      const uid = String(list?.curator_id || "").trim();
      if (!uid) return "";
      return nameByCurator.get(uid) || "";
    },
    [nameByCurator]
  );

  /** 검색 — 공개 RPC/폴백, 내 맛집첩은 장소명까지 붙여 로컬 필터 */
  useEffect(() => {
    if (!open || browsing) return;
    if (!isSearching) {
      setSearchResults(null);
      setSearchBusy(false);
      return;
    }
    let cancelled = false;
    setSearchBusy(true);
    void (async () => {
      try {
        if (tab === "mine" && user?.id && isCurator) {
          const enriched = await Promise.all(
            (lists || []).map(async (row) => {
              if (Array.isArray(row._placeNames)) return row;
              try {
                const places = await fetchCuratorListPlaces(row.id);
                return {
                  ...row,
                  _placeNames: (places || [])
                    .map((p) =>
                      String(p.place_name || p.place_address || "").trim()
                    )
                    .filter(Boolean),
                };
              } catch {
                return row;
              }
            })
          );
          if (cancelled) return;
          const filtered = filterListsForDiscoverySearch(
            enriched,
            searchTrimmed,
            { curatorLabelFor }
          );
          setSearchResults(filtered);
        } else {
          const { lists: found } = await searchPublicCuratorLists(
            searchTrimmed,
            { limit: 48 }
          );
          if (cancelled) return;
          const withCovers = await enrichListsWithAutoCover(found || []);
          if (cancelled) return;
          setSearchResults(withCovers);
          const uids = [
            ...new Set(
              withCovers
                .map((r) => String(r.curator_id || "").trim())
                .filter(Boolean)
            ),
          ];
          if (uids.length) {
            const map = await fetchCuratorMapsForUserIds(uids);
            if (!cancelled && map?.nameByCurator) {
              setNameByCurator((prev) => {
                const next = new Map(prev);
                for (const [k, v] of map.nameByCurator) next.set(k, v);
                return next;
              });
            }
          }
        }
      } catch (e) {
        console.warn("[맛집첩] search:", e);
        if (!cancelled) {
          setSearchResults(
            filterListsForDiscoverySearch(lists, searchTrimmed, {
              curatorLabelFor,
            })
          );
        }
      } finally {
        if (!cancelled) setSearchBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    browsing,
    isSearching,
    searchTrimmed,
    tab,
    user?.id,
    isCurator,
    lists,
  ]);

  /** 목록 탭 → 바로 지도에 핀 펼치기(+ 스와이프 상세) */
  const openListOnMap = useCallback(
    async (list) => {
      if (!list?.id || typeof onSpreadList !== "function") return;
      try {
        const places = await fetchCuratorListPlaces(list.id);
        if (!Array.isArray(places) || places.length === 0) {
          console.warn("[맛집첩] spread: empty places", list.id);
        }
        onSpreadList(list, places);
      } catch (e) {
        console.warn("[맛집첩] spread:", e);
      }
    },
    [onSpreadList]
  );

  const displayedEntries = useMemo(() => {
    if (isSearching && Array.isArray(searchResults)) {
      return searchResults.map((list) => ({ list, badge: null }));
    }
    if (tab === "trending") {
      return buildHomeListDiscoveryUnifiedList(lists, statsByListId);
    }
    return (Array.isArray(lists) ? lists : []).map((list) => ({
      list,
      badge: null,
    }));
  }, [isSearching, searchResults, lists, tab, statsByListId]);

  const browseCuratorLabel = useMemo(() => {
    if (!browseList?.list) return "";
    return curatorLabelFor(browseList.list);
  }, [browseList?.list, curatorLabelFor]);

  /** browse 시 큐레이터 라벨 보강 */
  useEffect(() => {
    if (!open || !browsing) return;
    const uid = String(browseList?.list?.curator_id || "").trim();
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const map = await fetchCuratorMapsForUserIds([uid]);
        if (!cancelled && map?.nameByCurator) {
          setNameByCurator((prev) => {
            const next = new Map(prev);
            for (const [k, v] of map.nameByCurator) next.set(k, v);
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, browsing, browseList?.list?.curator_id]);

  const bottomCss = useMemo(() => homeHotStripCoursesWrapBottomCss(), []);

  if (!open) return null;

  return (
    <div
      id="home-lists-discovery-panel"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomCss,
        zIndex: 280,
        height: heightPx,
        maxHeight: homeCoursesDiscoverySheetMaxHeightCss(),
        transition: isDragging ? "none" : SHEET_HEIGHT_TRANSITION,
        display: "flex",
        flexDirection: "column",
        borderRadius: "18px 18px 0 0",
        border: "1px solid rgba(255,255,255,0.12)",
        borderBottom: "none",
        background:
          "linear-gradient(180deg, rgba(22,22,26,0.98) 0%, rgba(10,10,12,0.98) 100%)",
        boxShadow: "0 -12px 40px rgba(0,0,0,0.45)",
        overflow: "hidden",
        minWidth: 0,
        pointerEvents: "auto",
      }}
    >
      <div
        onPointerDown={onDragHandlePointerDown}
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 8,
          paddingBottom: 4,
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.28)",
          }}
        />
      </div>

      {browsing ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "2px 12px 6px",
            overflow: "hidden",
            touchAction: "manipulation",
          }}
        >
          <HomeListDiscoveryDetail
            list={browseList.list}
            places={browsePlaces}
            curatorLabel={browseCuratorLabel}
            user={user}
            sheetSnap={snap}
            onBack={() => onBrowseBack?.()}
            onSheetCollapse={setSnapCollapsed}
            onSheetExpand={setSnapExpanded}
            onFocusPlace={onFocusPlace}
            focusPlaceId={focusPlaceId}
            onOpenCurator={onOpenCurator}
            resolveCuratorHandle={resolveCuratorHandle}
            onPlaceThumb={onPlaceThumb}
          />
        </div>
      ) : (
        <>
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "4px 14px 8px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: T.text,
                }}
              >
                맛집첩
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  marginTop: 2,
                }}
              >
                동네·테마로 묶은 큐레이터 픽
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClose?.()}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.85)",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              닫기
            </button>
          </div>

          <div style={{ flexShrink: 0, padding: "0 14px 8px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 12,
                    border: T.inputBorder,
                    background: T.inputBg,
                    padding: "0 10px",
                    minHeight: 42,
                  }}
                >
                  <span
                    aria-hidden
                    style={{ fontSize: 14, opacity: 0.55, lineHeight: 1 }}
                  >
                    🔍
                  </span>
                  <input
                    type="search"
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="큐레이터·장소·태그·동네 검색"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: T.text,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "10px 0",
                    }}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      aria-label="검색어 지우기"
                      onClick={() => setSearchQuery("")}
                      style={{
                        border: "none",
                        background: "rgba(255,255,255,0.1)",
                        color: T.textSub,
                        borderRadius: 999,
                        width: 26,
                        height: 26,
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  gap: 6,
                  padding: "0 14px 10px",
                }}
              >
                {[
                  { id: "trending", label: "지금 뜨는" },
                  ...(isCurator && user?.id
                    ? [{ id: "mine", label: "내 맛집첩" }]
                    : []),
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      borderRadius: 999,
                      border:
                        tab === t.id
                          ? "1px solid rgba(46,204,113,0.5)"
                          : "1px solid rgba(255,255,255,0.12)",
                      background:
                        tab === t.id
                          ? "rgba(46,204,113,0.16)"
                          : "rgba(255,255,255,0.05)",
                      color:
                        tab === t.id ? "#d6ffe6" : "rgba(255,255,255,0.7)",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "7px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
                {isCurator ? (
                  <button
                    type="button"
                    onClick={() => navigate("/studio/lists/new")}
                    style={{
                      marginLeft: "auto",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "7px 12px",
                      cursor: "pointer",
                    }}
                  >
                    + 만들기
                  </button>
                ) : null}
              </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "contain",
              touchAction: "pan-y",
              padding: "0 14px 18px",
            }}
          >
            {searchBusy && isSearching ? (
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  padding: 20,
                }}
              >
                검색 중…
              </div>
            ) : loading && !isSearching ? (
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  padding: 20,
                }}
              >
                불러오는 중…
              </div>
            ) : displayedEntries.length === 0 ? (
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: "28px 8px",
                  textAlign: "center",
                }}
              >
                {isSearching
                  ? `「${searchTrimmed}」에 맞는 맛집첩이 없어요. 더 짧게 입력해 보세요.`
                  : tab === "mine"
                    ? "아직 만든 맛집첩이 없어요. + 만들기로 동네·테마 묶음을 올려 보세요."
                    : "아직 공개된 맛집첩이 없어요. 큐레이터가 올리면 여기에 뜹니다."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {isSearching ? (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.45)",
                      padding: "0 2px 2px",
                    }}
                  >
                    검색 결과 {displayedEntries.length}개
                  </div>
                ) : null}
                {displayedEntries.map(({ list, badge }) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    badge={badge}
                    curatorLabel={curatorLabelFor(list)}
                    onOpen={openListOnMap}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
