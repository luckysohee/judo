import { useState, useEffect } from "react";
import { useToast } from "../Toast/ToastProvider";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import { supabase } from "../../lib/supabase";
import {
  getJudoModeCopy,
  JUDO_CHECKIN_SCHEDULE_TOAST,
  JUDO_DAY_SIDE_STRIP_HINT,
} from "../../utils/judoOperationMode";
import MutualCheckinsHomeSection from "./MutualCheckinsHomeSection";
import HomeCourseRail from "./HomeCourseRail";
import {
  HOME_HOT_STRIP_CONTENT_SLOT_PX,
  HOME_HOT_STRIP_NAV_CLEARANCE_PX,
  HOME_HOT_STRIP_TAB_ROW_PX,
  homeHotStripCoursesWrapBottomCss,
  homeHotStripWrapTopCss,
} from "../../utils/homeHotStripLayout";

function placeMatchesRankId(place, rankPlaceId) {
  const rid = String(rankPlaceId);
  const keys = [
    place?.id,
    place?.place_id,
    place?.kakao_place_id,
    place?.kakaoId,
  ]
    .filter((x) => x != null && x !== "")
    .map((x) => String(x));
  return keys.includes(rid);
}

const TAB_HOT = "hot";
const TAB_COURSES = "courses";
const TAB_CURATORS = "curators";
const TAB_MUTUAL = "mutual";

export { TAB_COURSES };

/** 한 줄 칩·탭 행 / 콘텐츠 슬롯 — `homeHotStripLayout`과 동기화 */
const STRIP_ROW_PX = HOME_HOT_STRIP_TAB_ROW_PX;
const STRIP_CONTENT_SLOT_H = HOME_HOT_STRIP_CONTENT_SLOT_PX;
const STRIP_WRAP_TOP_CSS = homeHotStripWrapTopCss();
const STRIP_COURSES_WRAP_BOTTOM_CSS = homeHotStripCoursesWrapBottomCss();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 지도 위 가로 스트립: 탭 — 오늘 한잔 TOP(24h) / 지금 뜨는 코스 / 떠오르는 큐레이터(7일) / 아는 사람
 */
export default function HotCheckinStrip({
  rankingTop5 = [],
  risingCurators = [],
  placesOnMap = [],
  mapRef,
  onPickPlace,
  onPickCurator,
  user = null,
  onOpenMutualPlaceDetail,
  onPickMutualUser,
  onMutualSearchOpenChange,
  hideWhenPreviewOpen = false,
  /** 검색바 문장·검색 진행 중에는 아래 UI와 겹침 방지 */
  hideWhenSearchActive = false,
  judoMode = null,
  /** 공개 코스 탭·데이터 노출(기본 true). false면 코스 탭 자체를 숨김 */
  showPublicCoursesTab = true,
  /** 맞피 패널·코스 동선 UI 등으로 상단 코스 레일을 끌 때 false */
  courseDiscoveryHostVisible = true,
  /** 공개 코스 탭 카드 탭 → 홈 지도 미리보기 */
  onPreviewPublicCourse,
  /** 지도에 띄운 공개 코스 id — 따라가기 CTA 동기화 */
  previewCourseId = "",
  courseFollowing = false,
  courseFollowBusy = false,
  onStartCourseFollow,
  /** 탭 전환 시 상위(검색바·술 칩 숨김 등) */
  onActiveTabChange,
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState(TAB_HOT);

  const dayLocked = Boolean(judoMode?.isDayMode);
  const dayScheduleToast = () => {
    const t = judoMode ? getJudoModeCopy(judoMode).checkInDisabledText : "";
    showToast(t || JUDO_CHECKIN_SCHEDULE_TOAST, "info", 3200);
  };

  const topFive = Array.isArray(rankingTop5) ? rankingTop5 : [];
  const curators = Array.isArray(risingCurators) ? risingCurators : [];
  const showMutualTab = Boolean(user?.id);

  const mayShowCoursesTab =
    showPublicCoursesTab !== false && courseDiscoveryHostVisible !== false;
  const showStrip =
    !hideWhenPreviewOpen &&
    !hideWhenSearchActive &&
    (topFive.length > 0 ||
      curators.length > 0 ||
      showMutualTab ||
      mayShowCoursesTab);

  useEffect(() => {
    if (!mayShowCoursesTab && tab === TAB_COURSES) {
      setTab(TAB_HOT);
    }
  }, [mayShowCoursesTab, tab]);

  useEffect(() => {
    if (typeof onActiveTabChange !== "function") return;
    onActiveTabChange(tab);
    // tab만 구독 — 콜백은 setState 등 안정 참조 전제
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!showStrip) return null;

  const isCoursesTab = tab === TAB_COURSES;
  const coursesRailVisible =
    isCoursesTab &&
    mayShowCoursesTab &&
    !hideWhenPreviewOpen &&
    !hideWhenSearchActive;

  const styles = {
    wrap: {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(720px, calc(100% - 32px))",
      zIndex: isCoursesTab ? 120 : 85,
      pointerEvents: "auto",
      boxSizing: "border-box",
      ...(isCoursesTab
        ? {
            top: STRIP_WRAP_TOP_CSS,
            bottom: STRIP_COURSES_WRAP_BOTTOM_CSS,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }
        : {
            bottom: `calc(${HOME_HOT_STRIP_NAV_CLEARANCE_PX}px + env(safe-area-inset-bottom, 0px))`,
          }),
    },
    bar: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 6,
      padding: "6px 8px",
      borderRadius: 14,
      background: isCoursesTab
        ? "rgba(255,255,255,0.97)"
        : "rgba(255,255,255,0.4)",
      boxShadow: isCoursesTab
        ? "0 -4px 32px rgba(15,23,42,0.14), 0 12px 40px rgba(15,23,42,0.08)"
        : "0 6px 28px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.95)",
      border: isCoursesTab
        ? "1px solid rgba(99,102,241,0.18)"
        : "1px solid rgba(255,255,255,0.82)",
      backdropFilter: "blur(24px) saturate(200%)",
      WebkitBackdropFilter: "blur(24px) saturate(200%)",
      boxSizing: "border-box",
      ...(isCoursesTab
        ? {
            position: "relative",
            flex: "1 1 auto",
            height: "100%",
            minHeight: 0,
            overflow: "hidden",
          }
        : {}),
    },
    /** 탭 아래 — 칩·아는 사람(76px) */
    contentSlot: {
      width: "100%",
      minHeight: STRIP_CONTENT_SLOT_H,
      height: STRIP_CONTENT_SLOT_H,
      maxHeight: STRIP_CONTENT_SLOT_H,
      display: "flex",
      alignItems: "stretch",
      overflow: "hidden",
      flexShrink: 0,
      boxSizing: "border-box",
    },
    /** 코스 탭 — 탭 아래로만 확장 */
    contentSlotCourses: {
      width: "100%",
      flex: "1 1 auto",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0,
      boxSizing: "border-box",
    },
    tabRow: {
      display: "flex",
      gap: 6,
      flexShrink: 0,
      minHeight: STRIP_ROW_PX,
      alignItems: "center",
    },
    tabBtn: (active) => ({
      flex: "1 1 0%",
      minWidth: 0,
      padding: "3px 8px",
      borderRadius: 999,
      border: active
        ? "1px solid rgba(225,29,72,0.35)"
        : "1px solid rgba(0,0,0,0.06)",
      background: active
        ? "linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)"
        : "rgba(255,255,255,0.55)",
      color: active ? "#9f1239" : "#4b5563",
      fontSize: 10,
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
      cursor: "pointer",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }),
    scroll: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      width: "100%",
      minWidth: 0,
      paddingBottom: 0,
      scrollbarWidth: "thin",
      minHeight: STRIP_ROW_PX,
      maxHeight: STRIP_CONTENT_SLOT_H,
      alignItems: "center",
      alignSelf: "stretch",
      boxSizing: "border-box",
    },
    chipHot: {
      flexShrink: 0,
      maxWidth: 200,
      padding: "3px 10px",
      borderRadius: 999,
      border: "1px solid #fecaca",
      background: "linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%)",
      cursor: "pointer",
      textAlign: "left",
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1.25,
      color: "#9f1239",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "inline-flex",
      alignItems: "center",
      minHeight: STRIP_ROW_PX,
      boxSizing: "border-box",
    },
    chipCurator: {
      flexShrink: 0,
      maxWidth: 240,
      padding: "3px 10px",
      borderRadius: 999,
      border: "1px solid #ddd6fe",
      background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)",
      cursor: "pointer",
      textAlign: "left",
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1.25,
      color: "#5b21b6",
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      minWidth: 0,
      minHeight: STRIP_ROW_PX,
      maxHeight: STRIP_ROW_PX,
      boxSizing: "border-box",
    },
    chipCuratorName: {
      minWidth: 0,
      flex: "1 1 auto",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    chipCuratorStat: {
      flexShrink: 0,
      fontSize: 9,
      fontWeight: 600,
      color: "rgba(91,33,182,0.68)",
    },
    count: {
      marginLeft: 4,
      fontWeight: 800,
      color: "#e11d48",
      fontVariantNumeric: "tabular-nums",
      fontSize: 10,
    },
    empty: {
      fontSize: 11,
      fontWeight: 600,
      color: "#6b7280",
      padding: "2px 2px 0",
      minHeight: STRIP_ROW_PX,
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
      lineHeight: 1.25,
    },
  };

  const handleHotChip = async (row) => {
    if (dayLocked) {
      dayScheduleToast();
      return;
    }
    const found = placesOnMap.find((p) => placeMatchesRankId(p, row.place_id));
    const wgs = found ? resolvePlaceWgs84(found) : null;

    if (found && wgs && mapRef?.current?.moveToLocation) {
      mapRef.current.moveToLocation(wgs.lat, wgs.lng);
      onPickPlace?.(found, row);
      return;
    }

    // 지도에 마커가 없더라도 DB에서 바로 찾아 이동.
    try {
      const pid = String(row?.place_id ?? "").trim();
      if (!pid) throw new Error("empty place_id");

      const byIdQuery = UUID_RE.test(pid)
        ? supabase.from("places").select("*").eq("id", pid).maybeSingle()
        : supabase
            .from("places")
            .select("*")
            .eq("kakao_place_id", pid)
            .maybeSingle();
      const { data: placeById, error: byIdErr } = await byIdQuery;
      if (byIdErr) throw byIdErr;
      let resolved = placeById;

      if (!resolved && row?.place_name) {
        const { data: byName, error: byNameErr } = await supabase
          .from("places")
          .select("*")
          .eq("name", String(row.place_name).trim())
          .limit(1);
        if (byNameErr) throw byNameErr;
        resolved = Array.isArray(byName) ? byName[0] : null;
      }

      if (!resolved) {
        showToast("아직 위치를 찾지 못했어요. 잠시 후 다시 시도해 주세요.", "info", 3200);
        return;
      }

      const rw = resolvePlaceWgs84(resolved);
      if (rw && mapRef?.current?.moveToLocation) {
        mapRef.current.moveToLocation(rw.lat, rw.lng);
      }
      onPickPlace?.(resolved, row);
    } catch (error) {
      console.warn("hot-strip place resolve:", error?.message || error);
      showToast("장소 위치를 불러오지 못했어요. 다시 시도해 주세요.", "info", 3200);
    }
  };

  const handleCuratorChip = (row) => {
    const u = String(row?.username ?? "").trim();
    if (!u) return;
    onPickCurator?.(row);
  };

  return (
    <div style={styles.wrap} aria-label="홈 추천 스트립">
      <div style={styles.bar}>
        <div style={styles.tabRow} role="tablist" aria-label="스트립 탭">
          <button
            type="button"
            role="tab"
            aria-selected={tab === TAB_HOT}
            style={styles.tabBtn(tab === TAB_HOT)}
            onClick={() => setTab(TAB_HOT)}
            title="오늘 한잔 TOP"
          >
            🔥 오늘 한잔 TOP
          </button>
          {mayShowCoursesTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_COURSES}
              style={styles.tabBtn(tab === TAB_COURSES)}
              onClick={() => setTab(TAB_COURSES)}
              title="지금 뜨는 코스"
            >
              🗺️ 지금 뜨는 코스
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={tab === TAB_CURATORS}
            style={styles.tabBtn(tab === TAB_CURATORS)}
            onClick={() => setTab(TAB_CURATORS)}
            title="떠오르는 큐레이터"
          >
            ✨ 떠오르는 큐레이터
          </button>
          {showMutualTab ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_MUTUAL}
              style={styles.tabBtn(tab === TAB_MUTUAL)}
              onClick={() => setTab(TAB_MUTUAL)}
              title="아는 사람 활동"
            >
              👀 아는 사람
            </button>
          ) : null}
        </div>
        {isCoursesTab ? (
          <div
            style={styles.contentSlotCourses}
            role="tabpanel"
            aria-label="지금 뜨는 코스"
          >
            <HomeCourseRail
              visible={coursesRailVisible}
              embedInHotStrip
              embedDockExtension
              onPreviewCourse={onPreviewPublicCourse}
              previewCourseId={previewCourseId}
              following={courseFollowing}
              followBusy={courseFollowBusy}
              onStartFollow={onStartCourseFollow}
              user={user}
            />
          </div>
        ) : tab === TAB_MUTUAL && showMutualTab ? (
          <div style={styles.contentSlot} role="tabpanel" aria-label="아는 사람 활동">
            <MutualCheckinsHomeSection
              compact
              stripMode
              user={user}
              judoMode={judoMode}
              onOpenPlaceDetail={onOpenMutualPlaceDetail}
              onPickUserFromSearch={onPickMutualUser}
              onSearchOpenChange={onMutualSearchOpenChange}
            />
          </div>
        ) : !isCoursesTab ? (
          <div style={styles.contentSlot} role="tabpanel">
            <div style={styles.scroll}>
            {tab === TAB_HOT ? (
              topFive.length === 0 ? (
                <div style={styles.empty}>
                  {dayLocked ? JUDO_DAY_SIDE_STRIP_HINT : "이번엔 조용해요"}
                </div>
              ) : (
                topFive.map((row) => (
                  <button
                    key={String(row.place_id)}
                    type="button"
                    style={{
                      ...styles.chipHot,
                      ...(dayLocked
                        ? {
                            opacity: 0.52,
                            cursor: "not-allowed",
                            filter: "grayscale(0.28)",
                          }
                        : {}),
                    }}
                    title={row.place_address || row.place_name}
                    onClick={() => handleHotChip(row)}
                  >
                    {row.place_name}
                    <span style={styles.count}>{row.total_checkins}</span>
                  </button>
                ))
              )
            ) : curators.length === 0 ? (
              <div style={styles.empty}>이번 주는 조용해요</div>
            ) : (
              curators.map((row) => {
                const name =
                  String(row.display_name || "").trim() ||
                  `@${String(row.username || "").trim()}`;
                const wp = Number(row.week_places) || 0;
                const wf = Number(row.week_follows) || 0;
                const statShort =
                  wp > 0 && wf > 0
                    ? `잔+${wp} · 팔+${wf}`
                    : wp > 0
                      ? `잔+${wp}`
                      : wf > 0
                        ? `팔+${wf}`
                        : "";
                const titleLong =
                  wp > 0 && wf > 0
                    ? `이번 주 잔 +${wp} · 팔로 +${wf}`
                    : wp > 0
                      ? `이번 주 잔 +${wp}`
                      : wf > 0
                        ? `팔로 +${wf}`
                        : "";
                return (
                  <button
                    key={String(row.curator_id ?? row.username)}
                    type="button"
                    style={styles.chipCurator}
                    title={titleLong || name}
                    onClick={() => handleCuratorChip(row)}
                  >
                    <span style={styles.chipCuratorName}>{name}</span>
                    {statShort ? (
                      <span style={styles.chipCuratorStat}>{statShort}</span>
                    ) : null}
                  </button>
                );
              })
            )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
