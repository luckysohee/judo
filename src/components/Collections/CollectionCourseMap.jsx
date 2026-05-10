import { useEffect, useMemo, useRef, useState } from "react";
import { loadKakaoMapsSdk } from "../../utils/loadKakaoMapsSdk";
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import {
  formatWalkingMinutes,
  walkingMinutesBetweenCoords,
} from "../../utils/walkingTime";

const DEFAULT_CENTER = { lat: 37.54465, lng: 127.05595 };

/** Custom overlay 배열 ref 의 내용을 모두 지도에서 떼어내고 비운다. */
function clearOverlayList(ref) {
  if (!ref?.current) return;
  ref.current.forEach((o) => {
    try {
      o.setMap(null);
    } catch {
      /* ignore */
    }
  });
  ref.current = [];
}

/**
 * 컬렉션 코스용 카카오맵 — `order_index` 정렬된 `collection_places` 행만 받아,
 * 좌표가 있는 장소만 번호 마커 + 순서대로 Polyline.
 *
 * @param {{ collectionPlaces: object[] }} props
 */
export default function CollectionCourseMap({ collectionPlaces }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const segmentOverlaysRef = useRef([]);
  const polylineRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  const mapStops = useMemo(() => {
    if (!Array.isArray(collectionPlaces)) return [];
    const out = [];
    collectionPlaces.forEach((row, idx) => {
      const place = row?.places || {};
      const coords = resolvePlaceWgs84(place);
      if (!coords) return;
      const title =
        String(place.name || place.display_name || "이름 없음").trim() ||
        "이름 없음";
      out.push({
        rowKey: row?.id ?? `${idx}-${place?.id ?? "p"}`,
        orderLabel: idx + 1,
        title,
        lat: coords.lat,
        lng: coords.lng,
      });
    });
    return out;
  }, [collectionPlaces]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMapError(null);
        await loadKakaoMapsSdk({
          appKey: import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY,
        });
      } catch (e) {
        if (!cancelled) {
          setMapError(
            e?.message === "VITE_KAKAO_JAVASCRIPT_KEY is missing"
              ? "지도 키가 설정되지 않았습니다."
              : e?.message || "지도를 불러오지 못했습니다.",
          );
        }
        return;
      }
      if (cancelled || !containerRef.current) return;

      window.kakao.maps.load(() => {
        if (cancelled || !containerRef.current) return;
        try {
          if (!mapRef.current) {
            const kakao = window.kakao.maps;
            mapRef.current = new kakao.Map(containerRef.current, {
              center: new kakao.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
              level: 5,
            });
          }
          if (!cancelled) setMapReady(true);
          setTimeout(() => {
            if (!cancelled) mapRef.current?.relayout();
          }, 120);
        } catch (err) {
          console.error("CollectionCourseMap init:", err);
          if (!cancelled) setMapError("지도 초기화에 실패했습니다.");
        }
      });
    })();

    return () => {
      cancelled = true;
      clearOverlayList(overlaysRef);
      clearOverlayList(segmentOverlaysRef);
      if (polylineRef.current) {
        try {
          polylineRef.current.setMap(null);
        } catch {
          /* ignore */
        }
        polylineRef.current = null;
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) return;

    const map = mapRef.current;
    const kakao = window.kakao.maps;

    clearOverlayList(overlaysRef);
    clearOverlayList(segmentOverlaysRef);
    if (polylineRef.current) {
      try {
        polylineRef.current.setMap(null);
      } catch {
        /* ignore */
      }
      polylineRef.current = null;
    }

    if (mapStops.length === 0) {
      map.setCenter(new kakao.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng));
      map.setLevel(5);
      setTimeout(() => map.relayout(), 50);
      return;
    }

    mapStops.forEach((stop) => {
      const position = new kakao.LatLng(stop.lat, stop.lng);
      const wrap = document.createElement("div");
      wrap.style.cssText =
        "display:flex;flex-direction:column;align-items:center;pointer-events:auto;";
      wrap.title = stop.title;

      const badge = document.createElement("div");
      badge.textContent = String(stop.orderLabel);
      badge.style.cssText = [
        "min-width:28px;height:28px;padding:0 8px",
        "border-radius:999px",
        "background:linear-gradient(145deg,#2ecc71,#27ae60)",
        "border:2px solid rgba(255,255,255,0.95)",
        "box-shadow:0 2px 8px rgba(0,0,0,0.35)",
        "color:#fff;font-size:13px;font-weight:800",
        "display:flex;align-items:center;justify-content:center",
        "font-family:system-ui,sans-serif",
      ].join(";");

      const label = document.createElement("div");
      const short =
        stop.title.length > 10 ? `${stop.title.slice(0, 9)}…` : stop.title;
      label.textContent = short;
      label.style.cssText = [
        "margin-top:4px;max-width:120px;padding:2px 6px",
        "background:rgba(17,17,17,0.82)",
        "color:#eee;font-size:11px;font-weight:600",
        "border-radius:6px;border:1px solid rgba(255,255,255,0.12)",
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
        "font-family:system-ui,sans-serif",
      ].join(";");

      wrap.appendChild(badge);
      wrap.appendChild(label);

      const overlay = new kakao.CustomOverlay({
        position,
        content: wrap,
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: 3,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    const path = mapStops.map((s) => new kakao.LatLng(s.lat, s.lng));
    if (path.length >= 2) {
      polylineRef.current = new kakao.Polyline({
        path,
        strokeWeight: 4,
        strokeColor: "#2ecc71",
        strokeOpacity: 0.88,
        strokeStyle: "solid",
        zIndex: 1,
      });
      polylineRef.current.setMap(map);

      for (let i = 0; i < mapStops.length - 1; i += 1) {
        const a = mapStops[i];
        const b = mapStops[i + 1];
        const minutes = walkingMinutesBetweenCoords(a, b);
        const labelText = formatWalkingMinutes(minutes);
        if (!labelText) continue;
        const midPosition = new kakao.LatLng(
          (a.lat + b.lat) / 2,
          (a.lng + b.lng) / 2,
        );
        const node = document.createElement("div");
        node.textContent = labelText;
        node.style.cssText = [
          "padding:3px 8px",
          "background:rgba(17,17,17,0.86)",
          "color:#fff;font-size:11px;font-weight:700",
          "border-radius:999px;border:1px solid rgba(46,204,113,0.55)",
          "white-space:nowrap;pointer-events:none",
          "box-shadow:0 2px 6px rgba(0,0,0,0.35)",
          "font-family:system-ui,sans-serif",
          "transform:translateY(-1px)",
        ].join(";");
        const overlay = new kakao.CustomOverlay({
          position: midPosition,
          content: node,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 2,
        });
        overlay.setMap(map);
        segmentOverlaysRef.current.push(overlay);
      }
    }

    if (mapStops.length >= 2) {
      const bounds = new kakao.LatLngBounds();
      mapStops.forEach((s) => bounds.extend(new kakao.LatLng(s.lat, s.lng)));
      map.setBounds(bounds, 56, 56, 56, 56);
    } else {
      map.setCenter(new kakao.LatLng(mapStops[0].lat, mapStops[0].lng));
      map.setLevel(4);
    }

    setTimeout(() => map.relayout(), 80);
  }, [mapReady, mapStops]);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>코스 지도</div>
      {mapError ? (
        <div style={styles.mapError}>{mapError}</div>
      ) : null}
      <div style={styles.mapShell}>
        <div ref={containerRef} style={styles.mapCanvas} />
        {!mapError && mapReady && mapStops.length === 0 ? (
          <div style={styles.mapEmptyOverlay}>
            좌표가 있는 장소가 없어 경로를 그릴 수 없습니다.
          </div>
        ) : null}
      </div>
      {!mapError && mapStops.length > 0 ? (
        <p style={styles.hint}>
          번호는 리스트 순서(코스 순서)와 같습니다. 좌표 없는 장소는 지도에서
          생략됩니다.
        </p>
      ) : null}
    </div>
  );
}

const styles = {
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
    marginBottom: 10,
  },
  mapShell: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #262626",
    background: "#0d0d0d",
  },
  mapCanvas: {
    width: "100%",
    height: "min(42vh, 320px)",
    minHeight: 220,
  },
  mapEmptyOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    textAlign: "center",
    fontSize: 13,
    color: "#bdbdbd",
    background: "rgba(0,0,0,0.45)",
    pointerEvents: "none",
  },
  mapError: {
    fontSize: 13,
    color: "#e74c3c",
    marginBottom: 8,
  },
  hint: {
    margin: "10px 0 0",
    fontSize: 12,
    color: "#888",
    lineHeight: 1.45,
  },
};
