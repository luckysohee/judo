import { useEffect, useMemo, useRef, useState } from "react";
import { getKakaoJavascriptAppKey, loadKakaoMapsSdk } from "../../utils/loadKakaoMapsSdk";
import { fetchChainedCourseWalkingRoutes } from "../../utils/fetchCourseWalkingRoute.js";
import {
  buildCourseMapPreviewModel,
  COURSE_MAP_PREVIEW_DEFAULT_CENTER,
} from "./courseMapPreviewModel";

const MAP_SHELL_DEFAULT = {
  width: "100%",
  height: "min(320px, 52vh)",
  minHeight: "260px",
  borderRadius: "10px",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(0,0,0,0.35)",
  position: "relative",
};

const MAP_SHELL_COMPACT = {
  height: "min(240px, 36vh)",
  minHeight: "200px",
  maxHeight: "280px",
};

const HINT = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.52)",
  marginTop: "10px",
  lineHeight: 1.45,
};

const MAP_ERROR_OVERLAY = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px",
  background: "rgba(0,0,0,0.72)",
  color: "#ffb4a8",
  fontSize: "12px",
  lineHeight: 1.45,
  textAlign: "center",
  zIndex: 2,
  pointerEvents: "none",
};

const MAP_FILL = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

/**
 * 코스 편집용 지도: 코스 순번 마커·동선(폴리라인) + 선택 시 검색 결과 핀(탭으로 코스에 담기).
 * @param {{
 *   placeRows?: object[],
 *   compact?: boolean,
 *   embedded?: boolean,
 *   interactive?: boolean,
 *   searchHits?: { id: string, name?: string, lat?: number|null, lng?: number|null }[],
 *   selectedSearchId?: string | null,
 *   onSearchHitPress?: (hit: object) => void,
 * }} props
 */
export default function CourseMapPreview({
  placeRows = [],
  compact = false,
  embedded = false,
  interactive = false,
  searchHits = [],
  selectedSearchId = null,
  onSearchHitPress,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const polylineRef = useRef(null);
  const walkingFetchGenRef = useRef(0);
  const onSearchHitPressRef = useRef(onSearchHitPress);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  /** @type {{ lat: number, lng: number }[] | null} */
  const [walkingPath, setWalkingPath] = useState(null);

  useEffect(() => {
    onSearchHitPressRef.current = onSearchHitPress;
  }, [onSearchHitPress]);

  const mapShellStyle = useMemo(
    () =>
      embedded
        ? MAP_FILL
        : {
            ...MAP_SHELL_DEFAULT,
            ...(compact ? MAP_SHELL_COMPACT : {}),
          },
    [compact, embedded]
  );

  const mapInteractive = embedded ? interactive : false;

  const model = useMemo(
    () => buildCourseMapPreviewModel(placeRows),
    [placeRows]
  );

  const pathSignature = useMemo(
    () =>
      model.points
        .map((p) => `${p.order}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}`)
        .join("|"),
    [model.points]
  );

  const searchPinsSignature = useMemo(() => {
    const list = Array.isArray(searchHits) ? searchHits : [];
    return list
      .filter(
        (h) =>
          h &&
          h.id &&
          Number.isFinite(Number(h.lat)) &&
          Number.isFinite(Number(h.lng))
      )
      .map(
        (h) =>
          `${String(h.id)}:${Number(h.lat).toFixed(5)}:${Number(h.lng).toFixed(5)}:${selectedSearchId === String(h.id) ? "1" : "0"}`
      )
      .join("|");
  }, [searchHits, selectedSearchId]);

  const waypoints = useMemo(
    () => model.points.map((p) => ({ lat: p.lat, lng: p.lng })),
    [model.points]
  );

  useEffect(() => {
    if (waypoints.length < 2) {
      setWalkingPath(null);
      return undefined;
    }
    const gen = ++walkingFetchGenRef.current;
    setWalkingPath(null);
    const wps = waypoints;

    fetchChainedCourseWalkingRoutes(wps).then((route) => {
      if (gen !== walkingFetchGenRef.current) return;
      if (
        route?.ok &&
        Number(route.routedLegCount) > 0 &&
        Array.isArray(route.path) &&
        route.path.length >= 2
      ) {
        setWalkingPath(route.path);
      } else {
        setWalkingPath(null);
      }
    });

    return () => {
      walkingFetchGenRef.current += 1;
    };
  }, [pathSignature, waypoints]);

  useEffect(() => {
    let cancelled = false;
    setMapError("");
    const appKey = getKakaoJavascriptAppKey();
    if (!appKey) {
      setMapError("VITE_KAKAO_JAVASCRIPT_KEY 가 없어 지도를 불러올 수 없습니다.");
      return undefined;
    }

    loadKakaoMapsSdk({ appKey })
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!window.kakao?.maps) {
          setMapError("카카오 지도 SDK 를 찾지 못했습니다.");
          return;
        }
        window.kakao.maps.load(() => {
          if (cancelled || !containerRef.current) return;
          if (mapRef.current) return;
          try {
            containerRef.current.innerHTML = "";
            const center = new window.kakao.maps.LatLng(
              COURSE_MAP_PREVIEW_DEFAULT_CENTER.lat,
              COURSE_MAP_PREVIEW_DEFAULT_CENTER.lng
            );
            const map = new window.kakao.maps.Map(containerRef.current, {
              center,
              level: 5,
              draggable: mapInteractive,
              scrollwheel: mapInteractive && !embedded,
              disableDoubleClick: !mapInteractive,
              disableDoubleClickZoom: !mapInteractive,
            });
            try {
              if (typeof map.setZoomable === "function") {
                map.setZoomable(mapInteractive);
              }
              if (typeof map.setDraggable === "function") {
                map.setDraggable(mapInteractive);
              }
            } catch {
              /* ignore */
            }
            mapRef.current = map;
            setMapReady(true);
            requestAnimationFrame(() => {
              try {
                map.relayout();
              } catch {
                /* ignore */
              }
            });
          } catch {
            setMapError("지도 인스턴스를 만들지 못했습니다.");
          }
        });
      })
      .catch(() => {
        if (!cancelled) setMapError("카카오 지도 스크립트 로딩에 실패했습니다.");
      });

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((o) => {
        try {
          o.setMap(null);
        } catch {
          /* ignore */
        }
      });
      overlaysRef.current = [];
      if (polylineRef.current) {
        try {
          polylineRef.current.setMap(null);
        } catch {
          /* ignore */
        }
        polylineRef.current = null;
      }
      mapRef.current = null;
      if (containerRef.current) {
        try {
          containerRef.current.innerHTML = "";
        } catch {
          /* ignore */
        }
      }
      setMapReady(false);
    };
  }, [mapInteractive]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) return;

    const map = mapRef.current;
    overlaysRef.current.forEach((o) => {
      try {
        o.setMap(null);
      } catch {
        /* ignore */
      }
    });
    overlaysRef.current = [];
    if (polylineRef.current) {
      try {
        polylineRef.current.setMap(null);
      } catch {
        /* ignore */
      }
      polylineRef.current = null;
    }

    const pts = model.points;
    const LatLng = window.kakao.maps.LatLng;
    const routePoints =
      Array.isArray(walkingPath) && walkingPath.length >= 2
        ? walkingPath
        : pts;
    const coursePath = routePoints.map((p) => new LatLng(p.lat, p.lng));

    pts.forEach((p) => {
      const el = document.createElement("div");
      el.textContent = String(p.order);
      el.style.cssText = [
        "width:28px",
        "height:28px",
        "border-radius:50%",
        "background:#3498DB",
        "color:#fff",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "font-weight:800",
        "font-size:12px",
        "border:2px solid rgba(255,255,255,0.95)",
        "box-shadow:0 2px 10px rgba(0,0,0,0.35)",
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
        "pointer-events:none",
      ].join(";");
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new LatLng(p.lat, p.lng),
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 4,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    if (coursePath.length >= 2) {
      polylineRef.current = new window.kakao.maps.Polyline({
        path: coursePath,
        strokeWeight: 4,
        strokeColor: walkingPath?.length >= 2 ? "#ea580c" : "#5DADE2",
        strokeOpacity: 0.92,
        strokeStyle: "solid",
      });
      polylineRef.current.setMap(map);
    }

    const searchList = (Array.isArray(searchHits) ? searchHits : []).filter(
      (h) =>
        h &&
        h.id &&
        Number.isFinite(Number(h.lat)) &&
        Number.isFinite(Number(h.lng))
    );

    const canPressSearch = typeof onSearchHitPress === "function";

    searchList.forEach((hit) => {
      const sel = selectedSearchId && String(hit.id) === String(selectedSearchId);
      const el = document.createElement("div");
      el.textContent = "＋";
      el.title = canPressSearch
        ? "탭하면 코스에 담기 (이미 담은 곳은 안내)"
        : "검색된 장소";
      el.style.cssText = [
        "width:26px",
        "height:26px",
        "border-radius:50%",
        sel ? "background:#f97316" : "background:#a855f7",
        "color:#fff",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "font-weight:900",
        "font-size:14px",
        "line-height:1",
        "border:2px solid rgba(255,255,255,0.95)",
        "box-shadow:0 2px 10px rgba(0,0,0,0.35)",
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
        canPressSearch ? "cursor:pointer" : "cursor:default",
        canPressSearch ? "pointer-events:auto" : "pointer-events:none",
      ].join(";");
      if (canPressSearch) {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            onSearchHitPressRef.current?.(hit);
          } catch {
            /* ignore */
          }
        });
      }
      const overlay = new window.kakao.maps.CustomOverlay({
        position: new LatLng(hit.lat, hit.lng),
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 6,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    const searchPath = searchList.map((h) => new LatLng(h.lat, h.lng));
    const allPoints = [...coursePath, ...searchPath];

    if (allPoints.length === 0) {
      map.setCenter(
        new LatLng(
          COURSE_MAP_PREVIEW_DEFAULT_CENTER.lat,
          COURSE_MAP_PREVIEW_DEFAULT_CENTER.lng
        )
      );
      map.setLevel(5);
    } else if (allPoints.length === 1) {
      map.setCenter(allPoints[0]);
      map.setLevel(4);
    } else {
      const bounds = new window.kakao.maps.LatLngBounds();
      allPoints.forEach((ll) => bounds.extend(ll));
      try {
        map.setBounds(bounds, 48, 48, 48, 48);
      } catch {
        map.setCenter(allPoints[0]);
        map.setLevel(5);
      }
    }

    try {
      map.relayout();
    } catch {
      /* ignore */
    }
  }, [
    mapReady,
    model.points,
    pathSignature,
    walkingPath,
    searchPinsSignature,
    searchHits,
    selectedSearchId,
    onSearchHitPress,
  ]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !containerRef.current) return;
    const map = mapRef.current;
    const el = containerRef.current.parentElement || containerRef.current;
    const ro = new ResizeObserver(() => {
      try {
        map.relayout();
      } catch {
        /* ignore */
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapReady, embedded]);

  useEffect(() => {
    if (!embedded || !mapReady || !mapRef.current || !containerRef.current) {
      return undefined;
    }
    const map = mapRef.current;
    const root = containerRef.current.parentElement || containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        requestAnimationFrame(() => {
          try {
            map.relayout();
          } catch {
            /* ignore */
          }
        });
      },
      { threshold: 0.08 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [embedded, mapReady]);

  if (embedded) {
    return (
      <div style={MAP_FILL} aria-label="코스 동선 미리보기 지도">
        <div ref={containerRef} style={MAP_FILL} />
        {mapError ? (
          <div style={MAP_ERROR_OVERLAY}>{mapError}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} style={mapShellStyle} aria-label="코스 동선 미리보기 지도" />
      {mapError ? (
        <div style={{ ...HINT, color: "#ffb4a8" }}>{mapError}</div>
      ) : null}
      {model.showEmptyCourseHint ? (
        <div style={HINT}>
          장소를 추가하면 지도에서 동선을 미리 볼 수 있어요.
        </div>
      ) : null}
      {Array.isArray(searchHits) &&
      searchHits.some(
        (h) =>
          h &&
          Number.isFinite(Number(h?.lat)) &&
          Number.isFinite(Number(h?.lng))
      ) &&
      typeof onSearchHitPress === "function" ? (
        <div style={HINT}>
          보라·주황 「＋」핀은 검색 결과입니다. 탭하면 코스에 담습니다. 파란 숫자는
          이미 담긴 순서예요.
        </div>
      ) : null}
      {model.showMissingCoordHint ? (
        <div style={HINT}>
          좌표가 없는 장소는 지도에 표시되지 않아요.
        </div>
      ) : null}
    </div>
  );
}
