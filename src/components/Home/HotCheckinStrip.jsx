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

/**
 * 지도 위 가로 스크롤: 24h 체크인 랭킹 TOP5 (부모가 useRealtimeCheckins 로 넘김)
 */
export default function HotCheckinStrip({
  rankingTop5 = [],
  placesOnMap = [],
  mapRef,
  onPickPlace,
  /** 장소 프리뷰 카드 열림 시 겹침 방지 */
  hideWhenPreviewOpen = false,
}) {
  const { showToast } = useToast();

  const topFive = Array.isArray(rankingTop5) ? rankingTop5 : [];
  if (topFive.length === 0 || hideWhenPreviewOpen) return null;

  const handleChip = (row) => {
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

  const styles = {
    /* 검색바(bottomBar)와 동일: 가운데 정렬, 검색창 바로 위에 붙임 */
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
      alignItems: "center",
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
    title: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: 800,
      color: "#1f2937",
      display: "flex",
      alignItems: "center",
      gap: 4,
      letterSpacing: "-0.02em",
    },
    fire: {
      fontSize: 16,
      lineHeight: 1,
    },
    scroll: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      flex: 1,
      minWidth: 0,
      paddingBottom: 2,
      scrollbarWidth: "thin",
    },
    chip: {
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
    count: {
      marginLeft: 6,
      fontWeight: 800,
      color: "#e11d48",
      fontVariantNumeric: "tabular-nums",
    },
  };

  return (
    <div style={styles.wrap} aria-label="지금 핫한 가게">
      <div style={styles.bar}>
        <div style={styles.title}>
          <span style={styles.fire} aria-hidden>
            🔥
          </span>
          지금 핫한 가게
        </div>
        <div style={styles.scroll}>
          {topFive.map((row) => (
            <button
              key={String(row.place_id)}
              type="button"
              style={styles.chip}
              title={row.place_address || row.place_name}
              onClick={() => handleChip(row)}
            >
              {row.place_name}
              <span style={styles.count}>{row.total_checkins}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
