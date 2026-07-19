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
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";
import {
  HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX,
  HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX,
  homeCoursesDiscoverySheetExpandedPx,
  homeCoursesDiscoverySheetMaxHeightCss,
  homeHotStripCoursesWrapBottomCss,
} from "../../utils/homeHotStripLayout";
import { useVerticalSnapSheet } from "../../hooks/useVerticalSnapSheet";
import { useVisualViewportBottomInset } from "../../hooks/useVisualViewportBottomInset";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import HomeListDiscoveryDetail from "./HomeListDiscoveryDetail";

const SHEET_HEIGHT_TRANSITION = "height 0.28s cubic-bezier(0.32, 0.72, 0, 1)";

function normalizeThemeTags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => String(t || "").replace(/^#/, "").trim())
    .filter(Boolean);
}

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

function ListCard({ list, curatorLabel, onOpen, onSpread }) {
  const n = Number(list?.place_count) || 0;
  const area = String(list?.area || "").trim();
  const tags = normalizeThemeTags(list?.theme_tags).slice(0, 4);
  return (
    <article
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(15,15,18,0.96) 100%)",
        padding: "12px 12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen?.(list)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: T.text,
            marginBottom: 4,
          }}
        >
          {list?.title || "제목 없음"}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.4,
          }}
        >
          {[area || null, n > 0 ? `${n}곳` : null, curatorLabel || null]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {tags.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 8,
            }}
          >
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 7px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => onSpread?.(list)}
        style={{
          marginTop: 2,
          border: "1px solid rgba(46,204,113,0.45)",
          background: "rgba(46,204,113,0.16)",
          color: "#d6ffe6",
          borderRadius: 10,
          minHeight: 40,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        지도에 펼치기
      </button>
    </article>
  );
}

function placeImageUrl(place) {
  const direct = String(place?.image_url || "").trim();
  if (direct) return direct;
  const embedded =
    place?.places && typeof place.places === "object" ? place.places : null;
  return String(embedded?.image_url || "").trim();
}

function ListPlacePreviewCard({
  place,
  index,
  focused = false,
  onFocus,
}) {
  const name = String(place?.place_name || "이름 없음").trim() || "이름 없음";
  const address = String(place?.place_address || "").trim();
  const memo = String(place?.memo || "").trim();
  const img = placeImageUrl(place);
  const w = resolvePlaceWgs84(place);
  const addrLine =
    address ||
    (w ? `${w.lat.toFixed(4)}, ${w.lng.toFixed(4)}` : "");
  const clickable = typeof onFocus === "function";

  const body = (
    <>
      <div
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          color: "#d6ffe6",
          background: "rgba(46,204,113,0.18)",
          border: "1px solid rgba(46,204,113,0.35)",
        }}
      >
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: T.text,
            lineHeight: 1.3,
          }}
        >
          {name}
        </div>
        {addrLine ? (
          <div
            style={{
              fontSize: 11,
              color: T.textMuted,
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {addrLine}
          </div>
        ) : null}
        {memo ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.82)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {memo}
          </p>
        ) : (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              fontWeight: 600,
              color: T.textFaint,
            }}
          >
            작성한 이유가 없어요
          </p>
        )}
      </div>
      {img ? (
        <img
          src={img}
          alt=""
          loading="lazy"
          style={{
            flexShrink: 0,
            width: 64,
            height: 64,
            borderRadius: 12,
            objectFit: "cover",
            background: T.thumbBg,
          }}
        />
      ) : null}
    </>
  );

  const shellStyle = {
    borderRadius: 14,
    border: focused ? T.cardActiveBorder : T.cardBorder,
    background: focused ? T.cardActiveBg : T.cardBg,
    padding: "12px 12px 11px",
    display: "flex",
    gap: 10,
    width: "100%",
    boxSizing: "border-box",
    color: "inherit",
    font: "inherit",
  };

  if (!clickable) {
    return <div style={shellStyle}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onFocus?.(place)}
      aria-pressed={focused}
      aria-label={`${name} 지도에서 보기`}
      style={{
        ...shellStyle,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {body}
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
  onSheetSnapChange,
  sheetResetKey = 0,
}) {
  const navigate = useNavigate();
  const { visibleHeightPx, layoutHeightPx, open: keyboardOpen } =
    useVisualViewportBottomInset();
  const baseExpandedPx = homeCoursesDiscoverySheetExpandedPx(layoutHeightPx, {
    visibleH: visibleHeightPx,
    keyboardOpen,
  });
  const browsingPreview = Boolean(browseList?.list);
  const expandedPx = browsingPreview
    ? Math.round(
        Math.min(
          layoutHeightPx * 0.68,
          Math.max(baseExpandedPx, layoutHeightPx * 0.62)
        )
      )
    : baseExpandedPx;
  const collapsedPx = HOME_COURSES_DISCOVERY_SHEET_COLLAPSED_PX;
  const minimizedPx = HOME_COURSES_DISCOVERY_SHEET_MINIMIZED_PX;

  const {
    snap,
    heightPx,
    isDragging,
    onDragHandlePointerDown,
    setSnapCollapsed,
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
  const [curatorMap, setCuratorMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [detailPlaces, setDetailPlaces] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
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
      setSelected(null);
      setDetailPlaces([]);
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
        setLists(rows);
        const uids = [
          ...new Set(
            rows.map((r) => String(r.curator_id || "").trim()).filter(Boolean)
          ),
        ];
        const map = await fetchCuratorMapsForUserIds(uids);
        if (!cancelled) setCuratorMap(map || {});
      } catch (e) {
        console.warn("[맛집첩] load:", e);
        if (!cancelled) setLists([]);
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
      const c = curatorMap[uid];
      if (!c) return "";
      const handle = String(c.username || c.slug || "").trim();
      return handle ? `@${handle}` : String(c.displayName || c.name || "").trim();
    },
    [curatorMap]
  );

  /** 검색 — 공개 RPC/폴백, 내 맛집첩은 장소명까지 붙여 로컬 필터 */
  useEffect(() => {
    if (!open || browsing || selected) return;
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
          setSearchResults(found);
          const uids = [
            ...new Set(
              (found || [])
                .map((r) => String(r.curator_id || "").trim())
                .filter(Boolean)
            ),
          ];
          if (uids.length) {
            const map = await fetchCuratorMapsForUserIds(uids);
            if (!cancelled && map) {
              setCuratorMap((prev) => ({ ...prev, ...map }));
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
    selected,
    isSearching,
    searchTrimmed,
    tab,
    user?.id,
    isCurator,
    lists,
  ]);

  const openDetail = useCallback(async (list) => {
    setSelected(list);
    setDetailLoading(true);
    try {
      const places = await fetchCuratorListPlaces(list.id);
      setDetailPlaces(places);
    } catch (e) {
      console.warn("[맛집첩] detail:", e);
      setDetailPlaces([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const displayedLists = useMemo(() => {
    if (isSearching && Array.isArray(searchResults)) return searchResults;
    return lists;
  }, [isSearching, searchResults, lists]);

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
        if (!cancelled && map) {
          setCuratorMap((prev) => ({ ...prev, ...map }));
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
            display: "flex",
            flexDirection: "column",
            padding: "2px 12px 6px",
            overflow: "hidden",
          }}
        >
          <HomeListDiscoveryDetail
            list={browseList.list}
            places={browsePlaces}
            curatorLabel={browseCuratorLabel}
            user={user}
            onBack={() => {
              setSelected(null);
              setDetailPlaces([]);
              onBrowseBack?.();
            }}
            onSheetCollapse={setSnapCollapsed}
            onFocusPlace={onFocusPlace}
            focusPlaceId={focusPlaceId}
            onOpenCurator={onOpenCurator}
            resolveCuratorHandle={resolveCuratorHandle}
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
                {selected ? selected.title : "맛집첩"}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  marginTop: 2,
                }}
              >
                {selected
                  ? "동선 없이 핀으로 펼쳐 보는 묶음"
                  : "동네·테마로 묶은 큐레이터 픽"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (selected) {
                  setSelected(null);
                  setDetailPlaces([]);
                  return;
                }
                onClose?.();
              }}
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
              {selected ? "목록" : "닫기"}
            </button>
          </div>

          {!selected ? (
            <>
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
            </>
          ) : null}

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              padding: "0 14px 18px",
            }}
          >
            {selected ? (
              detailLoading ? (
                <div
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    padding: 20,
                  }}
                >
                  불러오는 중…
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {String(selected.description || "").trim() ? (
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.55,
                        color: "rgba(255,255,255,0.78)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {String(selected.description).trim()}
                    </p>
                  ) : null}
                  {normalizeThemeTags(selected.theme_tags).length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      {normalizeThemeTags(selected.theme_tags).map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: T.chipBg,
                            color: T.textSub,
                            border: T.chipBorder,
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSpreadList?.(selected, detailPlaces)}
                    style={{
                      border: "none",
                      borderRadius: 12,
                      minHeight: 46,
                      background:
                        "linear-gradient(180deg, #3ad47f 0%, #27ae60 100%)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    지도에 펼치기 · {detailPlaces.length}곳
                  </button>
                  {detailPlaces.map((p, i) => (
                    <ListPlacePreviewCard
                      key={String(p.place_id || p.id || i)}
                      place={p}
                      index={i}
                    />
                  ))}
                </div>
              )
            ) : searchBusy && isSearching ? (
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
            ) : displayedLists.length === 0 ? (
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {isSearching ? (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.45)",
                      padding: "0 2px 2px",
                    }}
                  >
                    검색 결과 {displayedLists.length}개
                  </div>
                ) : null}
                {displayedLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    curatorLabel={curatorLabelFor(list)}
                    onOpen={openDetail}
                    onSpread={async (l) => {
                      try {
                        const places = await fetchCuratorListPlaces(l.id);
                        onSpreadList?.(l, places);
                      } catch (e) {
                        console.warn("[맛집첩] spread:", e);
                      }
                    }}
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
