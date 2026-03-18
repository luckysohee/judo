import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import createMarker from "../../utils/createMarker";

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

function loadKakaoMapsSdk({ appKey }) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve();
      return;
    }

    if (!appKey) {
      reject(new Error("VITE_KAKAO_JAVASCRIPT_KEY is missing"));
      return;
    }

    const existing = document.querySelector('script[data-kakao-maps-sdk="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Kakao Maps SDK")));
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.setAttribute("data-kakao-maps-sdk", "true");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false&libraries=services,clusterer`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(script);
  });
}

const MapView = forwardRef(({
  places,
  selectedPlace,
  setSelectedPlace,
  curatorColorMap,
  savedColorMap,
  livePlaceIds,
  onCurrentLocationChange,
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const ignoreMapClickRef = useRef(false);

  const userInteractedRef = useRef(false);
  const ignoreViewportEventRef = useRef(false);

  // 이전 places 상태를 기억하여 데이터가 실제로 바뀔 때만 범위를 잡기 위함
  const prevPlacesRef = useRef([]);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useImperativeHandle(ref, () => ({
    moveToSeoulCenter: () => {
      if (!mapRef.current) return;
      mapRef.current.panTo(new window.kakao.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng));
      mapRef.current.setLevel(6);
    },
    moveToCurrentLocation: () => {
      if (!navigator.geolocation) {
        alert("현재 위치를 지원하지 않는 브라우저입니다.");
        return;
      }
      navigator.geolocation.getCurrentPosition((pos) => {
        const target = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        mapRef.current.panTo(target);
        if (onCurrentLocationChange) onCurrentLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => alert("위치 정보를 가져올 수 없습니다."));
    }
  }));

  // 1. 지도 초기화
  useEffect(() => {
    let mounted = true;
    let retryTimer = null;
    const initMap = () => {
      if (!mounted || mapRef.current || !mapContainerRef.current) return;

      const appKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
      loadKakaoMapsSdk({ appKey })
        .then(() => {
          if (!mounted) return;
          if (!window.kakao || !window.kakao.maps) {
            setMapError("카카오 지도 SDK 로딩에 실패했습니다.");
            return;
          }

          window.kakao.maps.load(() => {
            try {
              const map = new window.kakao.maps.Map(mapContainerRef.current, {
                center: new window.kakao.maps.LatLng(
                  SEOUL_CENTER.lat,
                  SEOUL_CENTER.lng
                ),
                level: 6,
              });
              mapRef.current = map;

              const markUserInteracted = () => {
                if (ignoreViewportEventRef.current) return;
                userInteractedRef.current = true;
              };

              window.kakao.maps.event.addListener(map, "click", () => {
                if (!ignoreMapClickRef.current) setSelectedPlace(null);
              });

              window.kakao.maps.event.addListener(map, "dragend", markUserInteracted);
              window.kakao.maps.event.addListener(map, "zoom_changed", markUserInteracted);

              if (window.kakao.maps.MarkerClusterer) {
                clustererRef.current = new window.kakao.maps.MarkerClusterer({
                  map,
                  averageCenter: true,
                  minLevel: 6,
                  gridSize: 60,
                });
              }
              setMapReady(true);
            } catch (e) {
              console.error("kakao map init error:", e);
              setMapError("지도 로딩 오류");
            }
          });
        })
        .catch((e) => {
          console.error("kakao sdk load error:", e);
          setMapError(
            e?.message === "VITE_KAKAO_JAVASCRIPT_KEY is missing"
              ? "VITE_KAKAO_JAVASCRIPT_KEY가 설정되지 않았습니다. .env에 키를 추가해주세요."
              : "카카오 지도 SDK를 불러오지 못했습니다."
          );
        });
    };
    initMap();
    return () => { mounted = false; clearTimeout(retryTimer); };
  }, [setSelectedPlace]);

  // 2. 마커 업데이트 (데이터 변경 시에만 범위 조정)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    // 마커 다시 그리기
    markersRef.current.forEach(m => m.setMap(null));
    if (clustererRef.current) clustererRef.current.clear();
    if (!places?.length) return;

    const bounds = new window.kakao.maps.LatLngBounds();
    const liveMarkers = [];
    const clusterMarkers = [];

    const nextMarkers = places.map((p) => {
      const isLive = livePlaceIds instanceof Set ? livePlaceIds.has(String(p.id)) : false;
      const shouldCluster = Boolean(clustererRef.current) && !isLive;

      const marker = createMarker({
        map: shouldCluster ? null : mapRef.current,
        place: p,
        isSelected: selectedPlace?.id === p.id,
        isLive,
        savedColor: savedColorMap?.[p.id] || null,
        onClick: (cp) => {
          ignoreMapClickRef.current = true;
          setSelectedPlace(cp);
          setTimeout(() => {
            ignoreMapClickRef.current = false;
          }, 200);
        },
      });

      if (isLive) {
        liveMarkers.push(marker);
      } else {
        clusterMarkers.push(marker);
      }

      bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng));
      return marker;
    });

    markersRef.current = nextMarkers;
    if (clustererRef.current) clustererRef.current.addMarkers(clusterMarkers);

    // [수정 포인트] 데이터(places)가 실제로 바뀌었을 때만 지도의 전체 범위를 다시 잡습니다.
    // selectedPlace가 변해서(카드 열기/닫기) 이 Effect가 돌 때는 지도를 움직이지 않습니다.
    const isPlacesChanged = JSON.stringify(prevPlacesRef.current) !== JSON.stringify(places);
    if (isPlacesChanged) {
      if (!userInteractedRef.current) {
        ignoreViewportEventRef.current = true;
        if (places.length === 1) {
          mapRef.current.setCenter(
            new window.kakao.maps.LatLng(places[0].lat, places[0].lng)
          );
          mapRef.current.setLevel(4);
        } else {
          mapRef.current.setBounds(bounds);
        }
        setTimeout(() => {
          ignoreViewportEventRef.current = false;
        }, 0);
      }
      prevPlacesRef.current = places;
    }
  }, [places, selectedPlace, mapReady, savedColorMap, livePlaceIds]);

  // 3. 선택된 장소로 부드럽게 이동
  useEffect(() => {
    if (mapReady && mapRef.current && selectedPlace) {
      const desiredLevel = 4;
      const currentLevel = mapRef.current.getLevel?.();
      const panUpPx = 220;
      const targetLatLng = new window.kakao.maps.LatLng(selectedPlace.lat, selectedPlace.lng);

      const getOffsetLatLng = () => {
        try {
          const projection = mapRef.current?.getProjection?.();
          if (!projection?.pointFromCoords || !projection?.coordsFromPoint) {
            return new window.kakao.maps.LatLng(selectedPlace.lat + 0.0008, selectedPlace.lng);
          }
          const point = projection.pointFromCoords(targetLatLng);
          point.y += panUpPx;
          return projection.coordsFromPoint(point);
        } catch (e) {
          return new window.kakao.maps.LatLng(selectedPlace.lat + 0.0008, selectedPlace.lng);
        }
      };

      const moveToOffset = () => {
        const offsetLatLng = getOffsetLatLng();
        mapRef.current.panTo(offsetLatLng);
      };

      const needsZoomIn = typeof currentLevel === "number" && currentLevel > desiredLevel;
      if (needsZoomIn) {
        mapRef.current.setLevel(desiredLevel, { animate: true });
        // 줌 애니메이션과 동시에 좌표 보정 이동을 하면 덜 자연스러울 수 있어 짧게만 대기합니다.
        setTimeout(moveToOffset, 180);
      } else {
        moveToOffset();
      }
    }
  }, [selectedPlace, mapReady]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={styles.mapOuter}>
        {mapError ? (
          <div style={styles.errorBox}>{mapError}</div>
        ) : (
          <div ref={mapContainerRef} style={styles.mapInner} />
        )}
      </div>
    </div>
  );
});

const styles = {
  mapOuter: { 
    width: "100%", 
    height: "100%", 
    borderRadius: "0px", 
    overflow: "hidden", 
    backgroundColor: "#1a1a1a" 
  },
  mapInner: { 
    width: "100%", 
    height: "100%" 
  },
  errorBox: { 
    width: "100%", 
    height: "100%", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    color: "#fff" 
  },
};

export default MapView;