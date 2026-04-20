import { useState, useEffect } from "react";
import { useToast } from "../Toast/ToastProvider";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";

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
const TAB_CURATORS = "curators";

/**
 * 지도 위 가로 스트립: 탭 — 오늘 한잔 랭킹(24h) / 떠오르는 큐레이터(7일)
 */
export default function HotCheckinStrip({
  rankingTop5 = [],
  risingCurators = [],
  placesOnMap = [],
  mapRef,
  onPickPlace,
  onPickCurator,
  hideWhenPreviewOpen = false,
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState(TAB_HOT);

  const topFive = Array.isArray(rankingTop5) ? rankingTop5 : [];
  const curators = Array.isArray(risingCurators) ? risingCurators : [];

  const showStrip =
    !hideWhenPreviewOpen && (topFive.length > 0 || curators.length > 0);

  useEffect(() => {
    if (tab === TAB_HOT && topFive.length === 0 && curators.length > 0) {
      setTab(TAB_CURATORS);
    }
    if (tab === TAB_CURATORS && curators.length === 0 && topFive.length > 0) {
      setTab(TAB_HOT);
    }
  }, [tab, topFive.length, curators.length]);

  if (!showStrip) return null;

  const styles = {
    wrap: {
      position: "absolute",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(720px, calc(100% - 32px))",
      bottom: "calc(108px + env(safe-area-inset-bottom, 0px))",
      zIndex: 85,
      pointerEvents: "auto",
      boxSizing: "border-box",
    },
    bar: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 16,
      background: "rgba(255,255,255,0.4)",
      boxShadow:
        "0 6px 28px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.95)",
      border: "1px solid rgba(255,255,255,0.82)",
      backdropFilter: "blur(24px) saturate(200%)",
      WebkitBackdropFilter: "blur(24px) saturate(200%)",
    },
    tabRow: {
      display: "flex",
      gap: 6,
      flexShrink: 0,
    },
    tabBtn: (active) => ({
      flex: "1 1 0%",
      minWidth: 0,
      padding: "6px 8px",
      borderRadius: 999,
      border: active
        ? "1px solid rgba(225,29,72,0.35)"
        : "1px solid rgba(0,0,0,0.06)",
      background: active
        ? "linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)"
        : "rgba(255,255,255,0.55)",
      color: active ? "#9f1239" : "#4b5563",
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "-0.02em",
      cursor: "pointer",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }),
    scroll: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      flex: 1,
      minWidth: 0,
      paddingBottom: 2,
      scrollbarWidth: "thin",
    },
    chipHot: {
      flexShrink: 0,
      maxWidth: 200,
      padding: "6px 12px",
      borderRadius: 999,
      border: "1px solid #fecaca",
      background: "linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%)",
      cursor: "pointer",
      textAlign: "left",
      fontSize: 12,
      fontWeight: 600,
      color: "#9f1239",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    chipCurator: {
      flexShrink: 0,
      maxWidth: 220,
      padding: "6px 12px",
      borderRadius: 999,
      border: "1px solid #ddd6fe",
      background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)",
      cursor: "pointer",
      textAlign: "left",
      fontSize: 12,
      fontWeight: 600,
      color: "#5b21b6",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 2,
      minWidth: 0,
    },
    chipSub: {
      fontSize: 10,
      fontWeight: 600,
      color: "rgba(91,33,182,0.72)",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    count: {
      marginLeft: 6,
      fontWeight: 800,
      color: "#e11d48",
      fontVariantNumeric: "tabular-nums",
    },
    empty: {
      fontSize: 12,
      fontWeight: 600,
      color: "#6b7280",
      padding: "4px 4px 2px",
    },
  };

  const handleHotChip = (row) => {
    const found = placesOnMap.find((p) => placeMatchesRankId(p, row.place_id));
    const wgs = found ? resolvePlaceWgs84(found) : null;

    if (found && wgs && mapRef?.current?.moveToLocation) {
      mapRef.current.moveToLocation(wgs.lat, wgs.lng);
      onPickPlace?.(found, row);
      return;
    }

    showToast(
      "지도에 표시된 가게만 이동할 수 있어요. 검색으로 불러온 뒤 다시 눌러 주세요.",
      "info",
      3200
    );
  };

  const handleCuratorChip = (row) => {
    const u = String(row?.username ?? "").trim();
    if (!u) return;
    onPickCurator?.(row);
  };

  return (
    <div style={styles.wrap} aria-label="홈 추천 스트립">
      <div style={styles.bar}>
        {topFive.length > 0 && curators.length > 0 ? (
          <div style={styles.tabRow} role="tablist" aria-label="스트립 탭">
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_HOT}
              style={styles.tabBtn(tab === TAB_HOT)}
              onClick={() => setTab(TAB_HOT)}
            >
              🔥 오늘 한잔 TOP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === TAB_CURATORS}
              style={styles.tabBtn(tab === TAB_CURATORS)}
              onClick={() => setTab(TAB_CURATORS)}
            >
              ✨ 떠오르는 큐레이터
            </button>
          </div>
        ) : topFive.length > 0 ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 15 }} aria-hidden>
              🔥
            </span>
            오늘 한잔 TOP
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 15 }} aria-hidden>
              ✨
            </span>
            떠오르는 큐레이터
          </div>
        )}

        <div style={styles.scroll} role="tabpanel">
          {tab === TAB_HOT ? (
            topFive.length === 0 ? (
              <div style={styles.empty}>이번엔 조용해요</div>
            ) : (
              topFive.map((row) => (
                <button
                  key={String(row.place_id)}
                  type="button"
                  style={styles.chipHot}
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
              const sub =
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
                  title={sub}
                  onClick={() => handleCuratorChip(row)}
                >
                  <span
                    style={{
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {name}
                  </span>
                  {sub ? <span style={styles.chipSub}>{sub}</span> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
