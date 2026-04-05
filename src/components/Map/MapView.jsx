import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import createMarker from "../../utils/createMarker";
import KakaoPlaceOverlay from "./KakaoPlaceOverlay";

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
  center, // center prop 추가
  userFolders, // 사용자 폴더 정보 추가
  onQuickSave, // 쾌속 잔 채우기 핸들러 추가
  userRole, // 사용자 역할 추가
  onSave, // 일반 사용자 저장 핸들러 추가
  savedFolders, // 저장된 폴더 정보 추가
  userSavedPlaces, // 사용자 저장 장소 정보 추가
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [overlayPlace, setOverlayPlace] = useState(null); // 커스텀 오버레이에 표시할 장소
  const overlayRef = useRef(null); // 커스텀 오버레이 DOM 참조
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const ignoreMapClickRef = useRef(false);

  const userInteractedRef = useRef(false);
  const ignoreViewportEventRef = useRef(false);

  const prevPlacesRef = useRef([]);

  const [mapReady, setMapReady] = useState(false);

  // 특정 키워드가 포함된 카테고리 확인
  const isTargetCategory = (categoryName) => {
    if (!categoryName) return false;
    const targetKeywords = ['술집', '호프', '포장마차', '민속주점', '해산물', '주점', '바', '선술집'];
    return targetKeywords.some(keyword => categoryName.includes(keyword));
  };

  // 타겟 장소를 Supabase에 자동 저장
  const saveTargetPlaceToSupabase = async (place) => {
    try {
      const { supabase } = await import("../../lib/supabase");
      
      // places 테이블에 upsert
      const { data: savedPlace, error: placeError } = await supabase
        .from('places')
        .upsert({
          kakao_place_id: place.id,
          name: place.place_name,
          address: place.road_address_name || place.address_name,
          category: place.category_name,
          phone: place.phone,
          lat: place.y,
          lng: place.x,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'kakao_place_id'
        })
        .select()
        .single();

      if (placeError) {
        console.log('⚠️ 타겟 장소 저장 실패:', placeError.message);
        return;
      }

      console.log('✅ 타겟 장소 자동 저장 성공:', savedPlace);
      
      // AI 학습을 위한 태그 추가 (나중에 활용)
      // 여기에 추가적인 AI 학습 데이터 로직을 구현할 수 있음
      
    } catch (error) {
      console.error('타겟 장소 저장 오류:', error);
    }
  };

  // 커스텀 오버레이 닫기
  const closeOverlay = () => {
    setOverlayPlace(null);
  };

  // 쾌속 잔 채우기 핸들러
  const handleQuickSave = (place) => {
    // 부모 컴포넌트의 쾌속 잔 채우기 로직 호출
    if (onQuickSave) {
      onQuickSave(place);
    }
  };
  const [mapError, setMapError] = useState("");

  useImperativeHandle(ref, () => ({
    moveToSeoulCenter: () => {
      if (!mapRef.current) return;
      const moveLatLon = new window.kakao.maps.LatLng(
        SEOUL_CENTER.lat,
        SEOUL_CENTER.lng
      );
      mapRef.current.setCenter(moveLatLon);
    },
    moveToLocation: (lat, lng) => {
      if (!mapRef.current) return;
      const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
      mapRef.current.setCenter(moveLatLon);
      mapRef.current.setLevel(4); // zoom in to level 4
    },
    setZoomLevel: (level) => {
      if (!mapRef.current) return;
      mapRef.current.setLevel(level);
    },
    getBounds: () => {
      if (!mapRef.current) return null;
      return mapRef.current.getBounds();
    },
    getCurrentLocation: () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const target = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
          mapRef.current.panTo(target);
          if (onCurrentLocationChange) onCurrentLocationChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }, () => alert("위치 정보를 가져올 수 없습니다."));
      }
    },
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
              console.log("지도 초기화 시작...");
              const map = new window.kakao.maps.Map(mapContainerRef.current, {
                center: new window.kakao.maps.LatLng(
                  SEOUL_CENTER.lat,
                  SEOUL_CENTER.lng
                ),
                level: 6,
              });
              mapRef.current = map;
              console.log("지도 생성 완료:", map);

              // 지도 스타일 설정
              mapContainerRef.current.style.backgroundColor = "#ffffff";
              console.log("지도 스타일 설정 완료");

              // 지도 강제 리사이즈
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.relayout(); // relayout()이 맞습니다
                  console.log("지도 리사이즈 완료");
                }
              }, 100);

              const markUserInteracted = () => {
                if (ignoreViewportEventRef.current) return;
                userInteractedRef.current = true;
              };

              window.kakao.maps.event.addListener(map, "click", () => {
                if (!ignoreMapClickRef.current) {
                  setSelectedPlace(null);
                  closeOverlay(); // 커스텀 오버레이도 닫기
                }
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
    
    console.log("🗺️ MapView places 데이터:", places);
    console.log("🗺️ places.length:", places?.length);
    
    if (!places?.length) return;

    const bounds = new window.kakao.maps.LatLngBounds();
    const liveMarkers = [];
    const clusterMarkers = [];

    const validPlaces = places.filter(p => {
      const lat = p.lat || p.latitude;
      const lng = p.lng || p.longitude;
      // 유효한 좌표만 필터링 (서울 지역 범위)
      return lat && lng && lat >= 37.4 && lat <= 37.7 && lng >= 126.8 && lng <= 127.2;
    });

    console.log("🗺️ 유효한 장소 수:", validPlaces.length, "/", places.length);

    const nextMarkers = validPlaces.map((p) => {
      // lat/lng 필드가 없으면 latitude/longitude 사용
      const lat = p.lat || p.latitude;
      const lng = p.lng || p.longitude;
      
      console.log("📍 마커 데이터:", { id: p.id, name: p.name, lat, lng });
      
      const isLive = livePlaceIds instanceof Set ? livePlaceIds.has(String(p.id)) : false;
      const shouldCluster = Boolean(clustererRef.current) && !isLive;

      const marker = createMarker({
        map: shouldCluster ? null : mapRef.current,
        place: { ...p, lat, lng }, // lat/lng 필드 추가
        isSelected: selectedPlace?.id === p.id,
        isLive,
        savedColor: savedColorMap?.[p.id] || null,
        userFolders: userFolders?.[p.id] || null, // 사용자 폴더 정보 전달
        onClick: (cp) => {
          ignoreMapClickRef.current = true;
          
          // API 결과를 PlacePreviewCard 형식으로 변환
          const formattedPlace = {
            id: cp.id || `api_${cp.name?.replace(/\s+/g, '_')}`,
            name: cp.name || cp.title || cp.place_name,
            address: cp.address || cp.road_address_name || cp.address_name,
            region: cp.address || '',
            category: cp.category || cp.category_name || '',
            primaryCurator: cp.source === 'kakao' ? '카카오 지도' : '네이버 지도',
            curators: cp.source === 'kakao' ? ['카카오 지도'] : ['네이버 지도'],
            tags: cp.category ? [cp.category] : [],
            comment: '',
            savedCount: 0,
            lat: cp.lat,
            lng: cp.lng,
            // 네이버/카카오 API 추가 필드
            source: cp.source || 'naver',
            link: cp.link || cp.place_url,
            phone: cp.phone || cp.telephone || '',
            distance: cp.distance,
            walkingTime: cp.walkingTime
          };
          
          console.log('🗺️ 마커 클릭 - 장소 데이터:', formattedPlace);
          
          // 모든 장소를 PlacePreviewCard로 표시
          setSelectedPlace(formattedPlace);
          
          // 타겟 카테고리이면 자동으로 Supabase에 저장
          if (cp.isKakaoPlace && isTargetCategory(cp.category_name)) {
            saveTargetPlaceToSupabase(cp);
          }
          
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

      bounds.extend(new window.kakao.maps.LatLng(lat, lng));
      return marker;
    });

    markersRef.current = nextMarkers;
    if (clustererRef.current) clustererRef.current.addMarkers(clusterMarkers);

    // [수정 포인트] 데이터(places)가 실제로 바뀌었을 때만 지도의 전체 범위를 다시 잡습니다.
    // selectedPlace가 변해서(카드 열기/닫기) 이 Effect가 돌 때는 지도를 움직이지 않습니다.
    const isPlacesChanged = JSON.stringify(prevPlacesRef.current) !== JSON.stringify(places);
    if (isPlacesChanged) {
      // 스튜디오 페이지에서는 무조건 중심 이동 (사용자 상호작용 무시)
      const isStudioPage = window.location.pathname.includes('/studio');
      if (!userInteractedRef.current || isStudioPage) {
        ignoreViewportEventRef.current = true;
        if (places.length === 1) {
          const place = places[0];
          const lat = place.lat || place.latitude;
          const lng = place.lng || place.longitude;
          
          console.log("단일 마커 중심 이동:", lat, lng); // 디버깅
          if (lat && lng) {
            mapRef.current.setCenter(
              new window.kakao.maps.LatLng(lat, lng)
            );
            mapRef.current.setLevel(4);
          }
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

  // center prop이 변경될 때 지도 중심 이동
  useEffect(() => {
    if (mapReady && mapRef.current && center) {
      console.log("🗺️ 지도 중심 이동:", center);
      mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
      mapRef.current.setLevel(4);
    }
  }, [center, mapReady]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={styles.mapOuter}>
        {mapError ? (
          <div style={styles.errorBox}>{mapError}</div>
        ) : (
          <div ref={mapContainerRef} style={styles.mapInner} />
        )}
      </div>
      
      {/* 커스텀 오버레이 */}
      {overlayPlace && (
        <div ref={overlayRef}>
          <KakaoPlaceOverlay
            place={overlayPlace}
            onClose={closeOverlay}
            onQuickSave={handleQuickSave}
            userRole={userRole} // 사용자 역할 전달
            onSave={onSave} // 일반 사용자 저장 핸들러
            savedFolders={savedFolders} // 저장된 폴더 정보
            userSavedPlaces={userSavedPlaces} // 사용자 저장 장소 정보
          />
        </div>
      )}
    </div>
  );
});

const styles = {
  mapOuter: { 
    width: "100%", 
    height: "100%", 
    borderRadius: "0px", 
    overflow: "hidden", 
    backgroundColor: "#f0f0f0", 
    position: "relative",
    zIndex: 1
  },
  mapInner: { 
    width: "100%", 
    height: "100%",
    backgroundColor: "#f0f0f0", 
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2
  },
  errorBox: { 
    width: "100%", 
    height: "100%", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    color: "#333",
    zIndex: 3
  },
};

export default MapView;