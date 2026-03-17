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
  onCurrentLocationChange,
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const ignoreMapClickRef = useRef(false);

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
              window.kakao.maps.event.addListener(map, "click", () => {
                if (!ignoreMapClickRef.current) setSelectedPlace(null);
              });
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
    const nextMarkers = places.map(p => {
      const marker = createMarker({
        map: clustererRef.current ? null : mapRef.current,
        place: p,
        isSelected: selectedPlace?.id === p.id,
        savedColor: savedColorMap?.[p.id] || null,
        onClick: (cp) => {
          ignoreMapClickRef.current = true;
          setSelectedPlace(cp);
          setTimeout(() => { ignoreMapClickRef.current = false; }, 200);
        },
      });
      bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng));
      return marker;
    });

    markersRef.current = nextMarkers;
    if (clustererRef.current) clustererRef.current.addMarkers(nextMarkers);

    // [수정 포인트] 데이터(places)가 실제로 바뀌었을 때만 지도의 전체 범위를 다시 잡습니다.
    // selectedPlace가 변해서(카드 열기/닫기) 이 Effect가 돌 때는 지도를 움직이지 않습니다.
    const isPlacesChanged = JSON.stringify(prevPlacesRef.current) !== JSON.stringify(places);
    if (isPlacesChanged) {
      if (places.length === 1) {
        mapRef.current.setCenter(new window.kakao.maps.LatLng(places[0].lat, places[0].lng));
        mapRef.current.setLevel(4);
      } else {
        mapRef.current.setBounds(bounds);
      }
      prevPlacesRef.current = places;
    }
  }, [places, selectedPlace, mapReady, savedColorMap]);

  // 3. 선택된 장소로 부드럽게 이동
  useEffect(() => {
    if (mapReady && mapRef.current && selectedPlace) {
      // panTo를 사용하되, 터덕거림을 줄이기 위해 레벨 조정을 함께 원할 경우 아래 주석 해제
      // mapRef.current.setLevel(4, {animate: true}); 
      
      const moveLatLon = new window.kakao.maps.LatLng(selectedPlace.lat + 0.0008, selectedPlace.lng);
      mapRef.current.panTo(moveLatLon);
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