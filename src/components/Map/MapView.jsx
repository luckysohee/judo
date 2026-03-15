import { useEffect, useRef, useState } from "react";
import createMarker from "../../utils/createMarker";

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

export default function MapView({
  places,
  selectedPlace,
  setSelectedPlace,
  curatorColorMap,
  savedColorMap,
  onCurrentLocationChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const ignoreMapClickRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let mounted = true;
    let retryTimer = null;
    let retryCount = 0;

    const initMap = () => {
      if (!mounted || mapRef.current || !mapContainerRef.current) return;

      if (!window.kakao || !window.kakao.maps) {
        retryCount += 1;

        if (retryCount > 40) {
          setMapError(
            "카카오 지도를 불러오지 못했습니다. index.html 스크립트와 API 키를 확인해 주세요."
          );
          return;
        }

        retryTimer = window.setTimeout(initMap, 300);
        return;
      }

      window.kakao.maps.load(() => {
        if (!mounted || mapRef.current || !mapContainerRef.current) return;

        try {
          const map = new window.kakao.maps.Map(mapContainerRef.current, {
            center: new window.kakao.maps.LatLng(
              SEOUL_CENTER.lat,
              SEOUL_CENTER.lng
            ),
            level: 6,
          });

          mapRef.current = map;
          map.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);

          window.kakao.maps.event.addListener(map, "click", () => {
            if (ignoreMapClickRef.current) return;
            setSelectedPlace(null);
          });

          if (window.kakao.maps.MarkerClusterer) {
            clustererRef.current = new window.kakao.maps.MarkerClusterer({
              map,
              averageCenter: true,
              minLevel: 6,
              disableClickZoom: false,
              gridSize: 60,
            });
          }

          setMapReady(true);
          setMapError("");
        } catch (error) {
          console.error("map init error:", error);
          setMapError("지도 초기화 중 오류가 발생했습니다.");
        }
      });
    };

    initMap();

    return () => {
      mounted = false;

      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }

      if (clustererRef.current) {
        clustererRef.current.clear();
      }

      markersRef.current.forEach((marker) => {
        try {
          marker.setMap(null);
        } catch {
          //
        }
      });
      markersRef.current = [];
    };
  }, [setSelectedPlace]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    markersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        //
      }
    });
    markersRef.current = [];

    if (clustererRef.current) {
      clustererRef.current.clear();
    }

    if (!Array.isArray(places) || places.length === 0) return;

    const bounds = new window.kakao.maps.LatLngBounds();

    const nextMarkers = places.map((place) => {
      const marker = createMarker({
        map: clustererRef.current ? null : mapRef.current,
        place,
        isSelected: selectedPlace?.id === place.id,
        savedColor: savedColorMap?.[place.id] || null,
        onClick: (clickedPlace) => {
          ignoreMapClickRef.current = true;
          setSelectedPlace(clickedPlace);

          window.setTimeout(() => {
            ignoreMapClickRef.current = false;
          }, 200);
        },
      });
      
      bounds.extend(new window.kakao.maps.LatLng(place.lat, place.lng));
      return marker;
    });

    markersRef.current = nextMarkers;

    if (clustererRef.current) {
      clustererRef.current.addMarkers(nextMarkers);
    }

    if (places.length === 1) {
      mapRef.current.setCenter(
        new window.kakao.maps.LatLng(places[0].lat, places[0].lng)
      );
      mapRef.current.setLevel(4);
    } else {
      mapRef.current.setBounds(bounds);
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clear();
      }

      nextMarkers.forEach((marker) => {
        try {
          marker.setMap(null);
        } catch {
          //
        }
      });
    };
  }, [
    places,
    selectedPlace,
    setSelectedPlace,
    mapReady,
    curatorColorMap,
    savedColorMap,
  ]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedPlace) return;

    // 카드가 하단에 뜨므로 마커가 카드에 안 가려지게 살짝 위로 이동
    const target = new window.kakao.maps.LatLng(
      selectedPlace.lat + 0.0007,
      selectedPlace.lng
    );

    mapRef.current.panTo(target);
  }, [selectedPlace, mapReady]);

  const moveToSeoulCenter = () => {
    if (!mapRef.current) return;

    const center = new window.kakao.maps.LatLng(
      SEOUL_CENTER.lat,
      SEOUL_CENTER.lng
    );

    mapRef.current.panTo(center);
    mapRef.current.setLevel(6);
  };

  const moveToCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 현재 위치를 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mapRef.current) return;

        const { latitude, longitude } = position.coords;
        const target = new window.kakao.maps.LatLng(latitude, longitude);

        mapRef.current.panTo(target);

        if (typeof onCurrentLocationChange === "function") {
          onCurrentLocationChange({
            lat: latitude,
            lng: longitude,
          });
        }
      },
      () => {
        alert("현재 위치를 가져오지 못했습니다.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <section style={styles.wrap}>
      <div style={styles.mapOuter}>
        {mapError ? (
          <div style={styles.errorBox}>{mapError}</div>
        ) : (
          <div ref={mapContainerRef} style={styles.mapInner} />
        )}
      </div>

      <div style={styles.mapControls}>
        <button
          type="button"
          style={styles.controlButton}
          onClick={moveToSeoulCenter}
        >
          서울 중심
        </button>
        <button
          type="button"
          style={styles.controlButton}
          onClick={moveToCurrentLocation}
        >
          내 위치
        </button>
      </div>
    </section>
  );
}

const styles = {
  wrap: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  mapOuter: {
    width: "100%",
    height: "100%",
    borderRadius: "22px",
    overflow: "hidden",
    border: "1px solid #2a2a2a",
    backgroundColor: "#1a1a1a",
  },
  mapInner: {
    width: "100%",
    height: "100%",
  },
  mapControls: {
    position: "absolute",
    right: "12px",
    bottom: "160px",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  controlButton: {
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(20,20,20,0.9)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "9px 12px",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    backdropFilter: "blur(10px)",
  },
  errorBox: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 1.6,
    fontSize: "14px",
  },
};