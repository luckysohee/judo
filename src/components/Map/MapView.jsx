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
  const suppressMapClickRef = useRef(false);
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

        if (retryCount > 30) {
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
          if (suppressMapClickRef.current) return;
          setSelectedPlace(null);
        });

        if (window.kakao.maps.ZoomControl) {
          const zoomControl = new window.kakao.maps.ZoomControl();
          map.addControl(
            zoomControl,
            window.kakao.maps.ControlPosition.RIGHT
          );
        }

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
        color: curatorColorMap?.[place.primaryCurator] || "#2ECC71",
        isSelected: false,
        savedColor: savedColorMap?.[place.id] || null,
        onClick: (clickedPlace) => {
          suppressMapClickRef.current = true;
          setSelectedPlace(clickedPlace);

          window.setTimeout(() => {
            suppressMapClickRef.current = false;
          }, 180);
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
  }, [places, setSelectedPlace, mapReady, curatorColorMap, savedColorMap]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedPlace) return;

    mapRef.current.panTo(
      new window.kakao.maps.LatLng(
        selectedPlace.lat + 0.0007,
        selectedPlace.lng
      )
    );
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
        alert(
          "현재 위치를 가져오지 못했습니다. 브라우저 권한 또는 HTTPS 환경을 확인해 주세요."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <section>
      <div style={styles.mapHeaderRow}>
        <div style={styles.mapTitle}>서울 중심 지도</div>

        <div style={styles.buttonRow}>
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
      </div>

      <div style={styles.mapOuter}>
        {mapError ? (
          <div style={styles.errorBox}>{mapError}</div>
        ) : (
          <div ref={mapContainerRef} style={styles.mapInner} />
        )}
      </div>
    </section>
  );
}

const styles = {
  mapHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    gap: "12px",
  },
  mapTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#ffffff",
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
  },
  controlButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  mapOuter: {
    width: "100%",
    height: "560px",
    borderRadius: "22px",
    overflow: "hidden",
    border: "1px solid #2a2a2a",
    backgroundColor: "#1a1a1a",
  },
  mapInner: {
    width: "100%",
    height: "100%",
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