import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import createMarker from "../../utils/createMarker";
import { loadKakaoMapsSdk } from "../../utils/loadKakaoMapsSdk";
import {
  resolvePlaceWgs84,
  isLikelyKoreaWgs84,
} from "../../utils/placeCoords";
import { normalizeKakaoPlaceId } from "../../utils/mergePickedPlaceWithCuratorCatalog";

function isSameVenueOnMap(selected, place) {
  if (!selected || !place) return false;
  if (String(selected.id) === String(place.id)) return true;
  const a = normalizeKakaoPlaceId(selected);
  const b = normalizeKakaoPlaceId(place);
  return Boolean(a && b && a === b);
}
import KakaoPlaceOverlay from "./KakaoPlaceOverlay";

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

/** 클러스터 안 마커 개수 표기 (멀리서도 읽기 쉽게) */
function formatClusterMarkerCount(size) {
  const n = Math.max(0, Math.floor(Number(size) || 0));
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = n / 1000;
    const t = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${String(t).replace(/\.0$/, "")}k`;
  }
  return `${Math.round(n / 1000)}k`;
}

/**
 * Kakao MarkerClusterer: calculator 길이 N → 스타일은 N+1단계
 * @see https://apis.map.kakao.com/web/documentation/#MarkerClusterer
 */
const MAP_CLUSTER_CALCULATOR = [10, 40, 100, 200, 400, 800, 1600, 3200];

function mapClusterStyleAtIndex(index) {
  const i = Math.min(Math.max(0, index), MAP_CLUSTER_CALCULATOR.length);
  const px = 44 + i * 7;
  const fs = Math.min(17, 11 + Math.floor(i * 0.75));
  return {
    width: `${px}px`,
    height: `${px}px`,
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35) 0%, #fb7185 42%, #be123c 72%, #881337 100%)",
    color: "#fff",
    textAlign: "center",
    lineHeight: `${px}px`,
    fontSize: `${fs}px`,
    fontWeight: "800",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif',
    boxShadow: "0 4px 16px rgba(190,18,60,0.35), 0 1px 0 rgba(255,255,255,0.65) inset",
    border: "2px solid rgba(255,255,255,0.9)",
    opacity: "0.98",
  };
}

const MAP_CLUSTER_STYLES = Array.from(
  { length: MAP_CLUSTER_CALCULATOR.length + 1 },
  (_, idx) => mapClusterStyleAtIndex(idx)
);

function resolvePlaceCoords(place) {
  return resolvePlaceWgs84(place);
}

function placePassesMapMarkerGeo(p, skipKoreaBBoxForCuratorPins) {
  const c = resolvePlaceCoords(p);
  if (!c) return false;
  if (p.isKakaoTypingPreview) return true;
  if (
    skipKoreaBBoxForCuratorPins &&
    Array.isArray(p.curatorPlaces) &&
    p.curatorPlaces.length > 0
  ) {
    return Number.isFinite(c.lat) && Number.isFinite(c.lng);
  }
  return isLikelyKoreaWgs84(c.lat, c.lng);
}

/** JSON.stringify(places) 대신 뷰포트 재맞춤용 가벼운 시그니처 */
function placesViewportSignature(places) {
  if (!places?.length) return "0";
  const parts = [];
  for (const p of places) {
    const c = resolvePlaceCoords(p);
    const id = p?.id != null ? String(p.id) : "";
    parts.push(c ? `${id}:${c.lat},${c.lng}` : `${id}:none`);
  }
  return `${places.length}|${parts.join(";")}`;
}

/** 체크인 랭킹 TOP과 place.id / place_id 등 매칭 */
function markerCheckinMeta(place, checkinCountByPlaceId, hotRankTopPlaceIds) {
  const ids = [place?.id, place?.place_id, place?.kakao_place_id, place?.kakaoId]
    .filter((x) => x != null && x !== "")
    .map((x) => String(x));
  let checkinCount = 0;
  for (const id of ids) {
    const v = checkinCountByPlaceId?.[id];
    if (typeof v === "number" && v > checkinCount) checkinCount = v;
  }
  const showHotFlame =
    hotRankTopPlaceIds &&
    typeof hotRankTopPlaceIds.has === "function" &&
    ids.some((id) => hotRankTopPlaceIds.has(id));
  return { checkinCount, showHotFlame };
}

const MapView = forwardRef(({
  places,
  selectedPlace,
  setSelectedPlace,
  curatorColorMap,
  savedColorMap,
  livePlaceIds,
  onCurrentLocationChange,
  center,
  userFolders,
  onQuickSave,
  userRole,
  onSave,
  savedFolders,
  userSavedPlaces,
  onLocationButtonClick,
  onMapViewportChange,
  /** 장소 id → 한잔 누적 수(total_dedup, get_place_hanjan_stats 와 동일 기준) */
  checkinCountByPlaceId = {},
  /** Set<string> 랭킹 TOP place_id */
  hotRankTopPlaceIds = null,
  /** false면 지도 우하단 내 위치 FAB 숨김(부모에서 다른 위치에 배치할 때) */
  showFloatingLocationButton = true,
  onMyLocationLoadingChange,
  /**
   * true(기본): 지도 빈 곳 클릭 시 미리보기 카드 닫기(마커 클릭 직후 맵 click은 무시).
   * false: 지도 탭으로는 닫지 않음(X·스와이프 등만).
   */
  closePlacePreviewOnMapClick = true,
  /** 지도 빈 곳 클릭 시(미리보기 닫기와 동일 타이밍) — 마커 안내 패널 닫기 등 */
  onMapBackgroundClick,
  /**
   * 미리보기가 닫혀 있을 때만: 지도 클릭 좌표 { lat, lng } — 부모에서 Places/Geocoder 등으로 카드 오픈
   */
  onMapBlankClick,
  /**
   * true면 마커(places)가 바뀌어도 setBounds/setCenter로 줌·센터를 건드리지 않음 — 검색 결과만 그 위에 표시
   */
  preserveViewportOnPlacesChange = false,
  /**
   * 코스 1→2차 보행 경로 `{ polylinePath, legLabel?, labelPosition?, key }` — key는 effect 의존용
   */
  courseOverlay = null,
  /**
   * 코스 경로 setBounds 시 화면 하단 여백(px) — 바텀시트·피크에 가리지 않게 지도를 위로 맞춤
   */
  courseOverlayFitBottomPaddingPx = 0,
  /** 보라 경로 라벨 옆 × — 지도에서만 경로·라벨 제거 */
  onCourseOverlayDismiss = null,
  /** 2차 후보 펄스 중: 펄스 마커 탭 시 미리보기에 2차 확정 UI */
  courseSecondPickMode = false,
  /**
   * 마커 여러 개일 때 setBounds 패딩(px) — 코스 2차 후보처럼 살짝 줌아웃해 전부 보이게
   * `{ top, right, bottom, left }` 또는 네 면 동일한 숫자
   */
  placesFitBoundsPadding = null,
  /**
   * true: 큐레이터 칩만 켠 DB 추천 장소는 한국 bbox 밖이어도 핀 표시(해외·오타 좌표까지 보임).
   * 좌표가 아예 없는 행은 여전히 제외.
   */
  skipKoreaBBoxForCuratorPins = false,
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [overlayPlace, setOverlayPlace] = useState(null);
  const overlayRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const coursePolylineRef = useRef(null);
  const courseLegLabelOverlayRef = useRef(null);
  const ignoreMapClickRef = useRef(false);
  const closePlacePreviewOnMapClickRef = useRef(closePlacePreviewOnMapClick);
  useEffect(() => {
    closePlacePreviewOnMapClickRef.current = closePlacePreviewOnMapClick;
  }, [closePlacePreviewOnMapClick]);

  const userInteractedRef = useRef(false);
  const ignoreViewportEventRef = useRef(false);
  const viewportNotifyReadyRef = useRef(false);
  const onViewportChangeRef = useRef(onMapViewportChange);

  useEffect(() => {
    onViewportChangeRef.current = onMapViewportChange;
  }, [onMapViewportChange]);

  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  useEffect(() => {
    onMapBackgroundClickRef.current = onMapBackgroundClick;
  }, [onMapBackgroundClick]);

  const onMapBlankClickRef = useRef(onMapBlankClick);
  useEffect(() => {
    onMapBlankClickRef.current = onMapBlankClick;
  }, [onMapBlankClick]);

  const courseSecondPickModeRef = useRef(courseSecondPickMode);
  useEffect(() => {
    courseSecondPickModeRef.current = courseSecondPickMode;
  }, [courseSecondPickMode]);

  const onCourseOverlayDismissRef = useRef(onCourseOverlayDismiss);
  useEffect(() => {
    onCourseOverlayDismissRef.current = onCourseOverlayDismiss;
  }, [onCourseOverlayDismiss]);

  const selectedPlaceRef = useRef(selectedPlace);
  useEffect(() => {
    selectedPlaceRef.current = selectedPlace;
  }, [selectedPlace]);

  const setSelectedPlaceRef = useRef(setSelectedPlace);
  useEffect(() => {
    setSelectedPlaceRef.current = setSelectedPlace;
  }, [setSelectedPlace]);

  const runWithIgnoredViewportEvents = useCallback((fn, clearMs = 450) => {
    ignoreViewportEventRef.current = true;
    try {
      fn();
    } finally {
      setTimeout(() => {
        ignoreViewportEventRef.current = false;
      }, clearMs);
    }
  }, []);

  const notifyViewportCenterChanged = useCallback(() => {
    if (
      !viewportNotifyReadyRef.current ||
      ignoreViewportEventRef.current ||
      !mapRef.current
    ) {
      return;
    }
    const c = mapRef.current.getCenter();
    if (!c) return;
    const lat = c.getLat();
    const lng = c.getLng();
    let level;
    try {
      level = mapRef.current.getLevel?.();
    } catch {
      level = undefined;
    }
    onViewportChangeRef.current?.({
      lat,
      lng,
      level: typeof level === "number" && Number.isFinite(level) ? level : undefined,
    });
  }, []);

  const prevPlacesSigRef = useRef("");

  const [mapReady, setMapReady] = useState(false);
  
  // 현재 위치 마커 상태
  const [currentLocation, setCurrentLocation] = useState(null);
  const currentLocationMarkerRef = useRef(null);
  const [isLocating, setIsLocating] = useState(false);

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

      const kakaoNumericId = (() => {
        const cands = [
          place?.kakao_place_id,
          place?.place_id,
          place?.kakaoId,
          place?.id,
        ];
        for (const c of cands) {
          if (c == null || c === "") continue;
          const s = String(c).trim();
          if (/^\d+$/.test(s)) return s;
        }
        return null;
      })();

      if (!kakaoNumericId) {
        console.warn(
          "⚠️ 타겟 장소 자동 저장 생략: 카카오 숫자 place id 없음",
          place?.id,
          place?.name
        );
        return;
      }

      const lat = parseFloat(place?.y ?? place?.lat);
      const lng = parseFloat(place?.x ?? place?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn("⚠️ 타겟 장소 자동 저장 생략: 좌표 없음", place?.name);
        return;
      }

      // kakao_place_id에 DB UNIQUE가 없으면 upsert onConflict가 400 — 조회 후 update | insert
      const rowPayload = {
        kakao_place_id: kakaoNumericId,
        name: place.place_name || place.name || "",
        address:
          place.road_address_name ||
          place.address_name ||
          place.address ||
          "",
        category: place.category_name || place.category || "",
        lat,
        lng,
      };

      const { data: existingRows, error: selectError } = await supabase
        .from("places")
        .select("id")
        .eq("kakao_place_id", kakaoNumericId)
        .limit(1);

      if (selectError) {
        console.log("⚠️ 타겟 장소 조회 실패:", selectError.message);
        return;
      }

      const existingId = existingRows?.[0]?.id;
      const { data: savedPlace, error: placeError } = existingId
        ? await supabase
            .from("places")
            .update(rowPayload)
            .eq("id", existingId)
            .select()
            .single()
        : await supabase.from("places").insert(rowPayload).select().single();

      if (placeError) {
        console.log("⚠️ 타겟 장소 저장 실패:", placeError.message);
        return;
      }

      console.log("✅ 타겟 장소 자동 저장 성공:", savedPlace);
      
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

  // 현재 위치 마커 업데이트
  useEffect(() => {
    if (!mapReady || !mapRef.current || !currentLocation) return;

    // 기존 마커 제거
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setMap(null);
    }

    // 새 현재 위치 마커 생성 (파란색 점)
    const markerContent = document.createElement('div');
    markerContent.innerHTML = `
      <div style="
        width: 16px;
        height: 16px;
        background: #4285F4;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `;

    const position = new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
    
    const marker = new window.kakao.maps.CustomOverlay({
      position: position,
      content: markerContent,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 100
    });

    marker.setMap(mapRef.current);
    currentLocationMarkerRef.current = marker;

    // 위치 변경 콜백 호출
    if (onCurrentLocationChange) {
      onCurrentLocationChange(currentLocation);
    }
  }, [currentLocation, mapReady]);

  // 내 위치 버튼 핸들러
  const handleGetCurrentLocation = () => {
    console.log('📍 내 위치 버튼 클릭');
    
    // 부모 컴포넌트에서 로그인 체크 등을 처리할 수 있도록 콜백 호출
    if (onLocationButtonClick) {
      const prevented = onLocationButtonClick();
      console.log('📍 onLocationButtonClick 결과:', prevented);
      if (prevented) return;
    }

    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }

    setIsLocating(true);
    onMyLocationLoadingChange?.(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        
        console.log('📍 위치 가져오기 성공:', newLocation);
        console.log('📍 mapRef.current:', mapRef.current);
        console.log('📍 mapReady:', mapReady);
        
        setCurrentLocation(newLocation);
        
        // 지도 중심 이동
        if (mapRef.current && mapReady) {
          try {
            runWithIgnoredViewportEvents(() => {
              const target = new window.kakao.maps.LatLng(latitude, longitude);
              console.log("📍 지도 이동 시작:", target);
              mapRef.current.panTo(target);
              mapRef.current.setLevel(4);
              console.log("📍 지도 이동 완료");
            });
            setTimeout(() => {
              onViewportChangeRef.current?.({ lat: latitude, lng: longitude });
            }, 480);
          } catch (error) {
            console.error('📍 지도 이동 실패:', error);
          }
        } else {
          console.log('📍 mapRef 또는 mapReady 없음:', { mapRef: mapRef.current, mapReady });
        }
        
        setIsLocating(false);
        onMyLocationLoadingChange?.(false);
      },
      (error) => {
        console.error('위치 가져오기 실패:', error);
        setIsLocating(false);
        onMyLocationLoadingChange?.(false);
        
        let errorMsg = "위치 정보를 가져올 수 없습니다.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "위치 정보를 사용할 수 없습니다.";
            break;
          case error.TIMEOUT:
            errorMsg = "위치 요청 시간이 초과되었습니다.";
            break;
        }
        alert(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  const requestMyLocationRef = useRef(handleGetCurrentLocation);
  requestMyLocationRef.current = handleGetCurrentLocation;

  useImperativeHandle(
    ref,
    () => ({
      moveToSeoulCenter: () => {
        if (!mapRef.current) return;
        runWithIgnoredViewportEvents(() => {
          const moveLatLon = new window.kakao.maps.LatLng(
            SEOUL_CENTER.lat,
            SEOUL_CENTER.lng
          );
          mapRef.current.setCenter(moveLatLon);
        });
      },
      moveToLocation: (lat, lng) => {
        if (!mapRef.current) return;
        runWithIgnoredViewportEvents(() => {
          const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
          mapRef.current.setCenter(moveLatLon);
          mapRef.current.setLevel(4);
        });
      },
      setZoomLevel: (level) => {
        if (!mapRef.current) return;
        runWithIgnoredViewportEvents(() => {
          mapRef.current.setLevel(level);
        });
      },
      getCenter: () => {
        if (!mapRef.current) return null;
        const c = mapRef.current.getCenter();
        return c
          ? { lat: c.getLat(), lng: c.getLng() }
          : null;
      },
      panTo: (lat, lng) => {
        if (!mapRef.current) return;
        runWithIgnoredViewportEvents(() => {
          mapRef.current.panTo(
            new window.kakao.maps.LatLng(lat, lng)
          );
        });
      },
      setLevel: (level, opts) => {
        if (!mapRef.current) return;
        runWithIgnoredViewportEvents(() => {
          if (opts !== undefined) mapRef.current.setLevel(level, opts);
          else mapRef.current.setLevel(level);
        });
      },
      getBounds: () => {
        if (!mapRef.current) return null;
        return mapRef.current.getBounds();
      },
      getLevel: () => {
        if (!mapRef.current) return null;
        try {
          return mapRef.current.getLevel();
        } catch {
          return null;
        }
      },
      getCurrentLocation: () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              runWithIgnoredViewportEvents(() => {
                const target = new window.kakao.maps.LatLng(lat, lng);
                mapRef.current.panTo(target);
              });
              if (onCurrentLocationChange) {
                onCurrentLocationChange({ lat, lng });
              }
              setTimeout(() => {
                onViewportChangeRef.current?.({ lat, lng });
              }, 450);
            },
            () => alert("위치 정보를 가져올 수 없습니다.")
          );
        }
      },
      /** 로그인 체크·마커·지도 이동까지 포함한 홈 내 위치 버튼과 동일 동작 */
      requestMyLocation: () => {
        requestMyLocationRef.current?.();
      },
      /** 하단 시트·카드 열림 등 레이아웃 변화 후 타일 재계산 */
      relayout: () => {
        try {
          mapRef.current?.relayout?.();
        } catch {
          /* ignore */
        }
      },
      /** 후보 여러 곳이 보이도록 경계 맞춤 (타이핑 자동완성 등) */
      fitToPlaces: (placeList) => {
        if (!mapRef.current || !Array.isArray(placeList) || placeList.length === 0)
          return;
        runWithIgnoredViewportEvents(() => {
          const pts = [];
          for (const p of placeList) {
            const c = resolvePlaceCoords(p);
            if (c) pts.push(c);
          }
          if (pts.length === 0) return;
          if (pts.length === 1) {
            mapRef.current.setCenter(
              new window.kakao.maps.LatLng(pts[0].lat, pts[0].lng)
            );
            mapRef.current.setLevel(5);
          } else {
            const bounds = new window.kakao.maps.LatLngBounds();
            for (const { lat, lng } of pts) {
              bounds.extend(new window.kakao.maps.LatLng(lat, lng));
            }
            mapRef.current.setBounds(bounds);
          }
          try {
            mapRef.current.relayout?.();
          } catch {
            /* ignore */
          }
        }, 420);
      },
    }),
    [onCurrentLocationChange, runWithIgnoredViewportEvents]
  );

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
              if (import.meta.env.DEV) console.log("지도 초기화 시작...");
              const map = new window.kakao.maps.Map(mapContainerRef.current, {
                center: new window.kakao.maps.LatLng(
                  SEOUL_CENTER.lat,
                  SEOUL_CENTER.lng
                ),
                level: 6,
              });
              mapRef.current = map;
              if (import.meta.env.DEV) console.log("지도 생성 완료");

              // 지도 스타일 설정
              mapContainerRef.current.style.backgroundColor = "#ffffff";

              // 지도 강제 리사이즈
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.relayout(); // relayout()이 맞습니다
                }
              }, 100);

              const markUserInteracted = () => {
                if (ignoreViewportEventRef.current) return;
                userInteractedRef.current = true;
              };

              window.kakao.maps.event.addListener(map, "click", (mouseEvent) => {
                if (ignoreMapClickRef.current) return;
                try {
                  onMapBackgroundClickRef.current?.();
                } catch (e) {
                  console.error("onMapBackgroundClick:", e);
                }
                const latLng = mouseEvent?.latLng;
                const lat =
                  typeof latLng?.getLat === "function" ? latLng.getLat() : null;
                const lng =
                  typeof latLng?.getLng === "function" ? latLng.getLng() : null;

                if (closePlacePreviewOnMapClickRef.current) {
                  if (selectedPlaceRef.current) {
                    setSelectedPlaceRef.current?.(null);
                  } else if (
                    !courseSecondPickModeRef.current &&
                    onMapBlankClickRef.current &&
                    typeof lat === "number" &&
                    typeof lng === "number" &&
                    Number.isFinite(lat) &&
                    Number.isFinite(lng)
                  ) {
                    try {
                      onMapBlankClickRef.current({ lat, lng });
                    } catch (e) {
                      console.error("onMapBlankClick:", e);
                    }
                  }
                }
                closeOverlay(); // KakaoPlaceOverlay만 지도 탭으로 닫기
              });

              window.kakao.maps.event.addListener(map, "dragend", () => {
                markUserInteracted();
                notifyViewportCenterChanged();
              });
              window.kakao.maps.event.addListener(map, "zoom_changed", () => {
                markUserInteracted();
                notifyViewportCenterChanged();
              });

              if (window.kakao.maps.MarkerClusterer) {
                clustererRef.current = new window.kakao.maps.MarkerClusterer({
                  map,
                  averageCenter: true,
                  minLevel: 6,
                  gridSize: 64,
                  minClusterSize: 2,
                  calculator: MAP_CLUSTER_CALCULATOR,
                  styles: MAP_CLUSTER_STYLES,
                  texts: (size) => formatClusterMarkerCount(size),
                });
              }
              viewportNotifyReadyRef.current = false;
              setMapReady(true);
              setTimeout(() => {
                viewportNotifyReadyRef.current = true;
                notifyViewportCenterChanged();
              }, 650);
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
  }, [notifyViewportCenterChanged]);

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

    const validPlaces = places.filter((p) =>
      placePassesMapMarkerGeo(p, skipKoreaBBoxForCuratorPins)
    );

    const nextMarkers = validPlaces.map((p) => {
      const { lat, lng } = resolvePlaceCoords(p);

      const isLive = livePlaceIds instanceof Set ? livePlaceIds.has(String(p.id)) : false;
      const shouldCluster =
        Boolean(clustererRef.current) &&
        !isLive &&
        !p.isKakaoTypingPreview &&
        !p.isCoursePin;

      const checkinMeta = markerCheckinMeta(p, checkinCountByPlaceId, hotRankTopPlaceIds);

      const marker = createMarker({
        map: shouldCluster ? null : mapRef.current,
        place: { ...p, lat, lng }, // lat/lng 필드 추가
        isSelected:
          isSameVenueOnMap(selectedPlace, p) || Boolean(p.courseMarkerSolid),
        isLive,
        savedColor: savedColorMap?.[p.id] || null,
        userFolders: userFolders?.[p.id] || null, // 사용자 폴더 정보 전달
        checkinMeta,
        onClick: (cp) => {
          ignoreMapClickRef.current = true;

          const wgs = resolvePlaceCoords(cp);

          // API 결과를 PlacePreviewCard 형식으로 변환 (y/x만 있어도 lat·lng 채움)
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
            lat: wgs?.lat ?? cp.lat,
            lng: wgs?.lng ?? cp.lng,
            ...(wgs
              ? {
                  x: String(wgs.lng),
                  y: String(wgs.lat),
                }
              : {}),
            image: cp.image,
            curatorPlaces: cp.curatorPlaces || [],
            // 네이버/카카오 API 추가 필드
            source: cp.source || 'naver',
            link: cp.link || cp.place_url,
            place_url: cp.place_url || cp.link || '',
            phone: cp.phone || cp.telephone || '',
            place_id: cp.place_id || cp.kakao_place_id || cp.kakaoId || cp.id,
            kakao_place_id: cp.kakao_place_id || cp.place_id || cp.kakaoId || cp.id,
            isKakaoPlace: Boolean(cp.isKakaoPlace || cp.source === 'kakao' || cp.place_url),
            category_name: cp.category_name || cp.category || '',
            road_address_name: cp.road_address_name || '',
            address_name: cp.address_name || cp.address || '',
            distance: cp.distance,
            walkingTime: cp.walkingTime,
            blogInsight: cp.blogInsight,
          };

          if (courseSecondPickMode && cp.courseMarkerPulse) {
            formattedPlace.courseSecondCandidatePick = true;
          }
          
          if (import.meta.env.DEV) {
            console.log("🗺️ 마커 클릭:", formattedPlace?.name, formattedPlace?.id);
          }

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
    const sig = placesViewportSignature(places);
    const isPlacesChanged = prevPlacesSigRef.current !== sig;
    if (isPlacesChanged) {
      prevPlacesSigRef.current = sig;
      // 장소 미리보기 카드 열린 채 검색창 타이핑 → 자동완성 마커만 바뀌어도 setBounds로 줌아웃됨.
      // 후보가 전부 타이핑 미리보기일 때도 동일 — 마커만 갱신하고 뷰는 유지.
      const skipViewportAdjust =
        Boolean(selectedPlace) ||
        preserveViewportOnPlacesChange ||
        (validPlaces.length > 0 &&
          validPlaces.every((p) => p.isKakaoTypingPreview));
      const isStudioPage = window.location.pathname.includes('/studio');
      if (
        !skipViewportAdjust &&
        (!userInteractedRef.current || isStudioPage)
      ) {
        ignoreViewportEventRef.current = true;
        if (validPlaces.length === 1) {
          const c = resolvePlaceCoords(validPlaces[0]);
          if (c) {
            mapRef.current.setCenter(
              new window.kakao.maps.LatLng(c.lat, c.lng)
            );
            mapRef.current.setLevel(4);
          }
        } else if (validPlaces.length > 1) {
          const p = placesFitBoundsPadding;
          if (p != null && typeof p === "object") {
            const t = Math.round(Number(p.top) || 0);
            const r = Math.round(Number(p.right) || 0);
            const b = Math.round(Number(p.bottom) || 0);
            const l = Math.round(Number(p.left) || 0);
            if (t + r + b + l > 0) {
              mapRef.current.setBounds(bounds, t, r, b, l);
            } else {
              mapRef.current.setBounds(bounds);
            }
          } else if (typeof p === "number" && Number.isFinite(p) && p > 0) {
            const n = Math.round(p);
            mapRef.current.setBounds(bounds, n, n, n, n);
          } else {
            mapRef.current.setBounds(bounds);
          }
        }
        setTimeout(() => {
          ignoreViewportEventRef.current = false;
        }, 450);
      }
    }
  }, [
    places,
    selectedPlace,
    mapReady,
    savedColorMap,
    livePlaceIds,
    userFolders,
    checkinCountByPlaceId,
    hotRankTopPlaceIds,
    preserveViewportOnPlacesChange,
    placesFitBoundsPadding,
    skipKoreaBBoxForCuratorPins,
    courseSecondPickMode,
  ]);

  /** 코스 1차·2차 후보 마커(courseMarkerPulse) — opacity 토글로 후보 강조 */
  useEffect(() => {
    if (!mapReady || !markersRef.current?.length) return;

    const validPlaces = places.filter((p) =>
      placePassesMapMarkerGeo(p, skipKoreaBBoxForCuratorPins)
    );

    const intervals = [];
    markersRef.current.forEach((marker, idx) => {
      const p = validPlaces[idx];
      if (!p?.courseMarkerPulse) return;
      let bright = true;
      const id = window.setInterval(() => {
        bright = !bright;
        try {
          if (typeof marker.setOpacity === "function") {
            marker.setOpacity(bright ? 1 : 0.4);
          }
        } catch {
          /* ignore */
        }
      }, 520);
      intervals.push(id);
    });

    return () => {
      for (const id of intervals) window.clearInterval(id);
      markersRef.current.forEach((marker, idx) => {
        const p = validPlaces[idx];
        if (!p?.courseMarkerPulse) return;
        try {
          if (typeof marker.setOpacity === "function") marker.setOpacity(1);
        } catch {
          /* ignore */
        }
      });
    };
  }, [places, mapReady, skipKoreaBBoxForCuratorPins]);

  // 3. 선택된 장소로 부드럽게 이동 (검색 결과는 y/x만 있고 lat/lng 없는 경우 많음)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedPlace) return;

    const wgs = resolvePlaceCoords(selectedPlace);
    if (!wgs || !Number.isFinite(wgs.lat) || !Number.isFinite(wgs.lng)) return;

    ignoreViewportEventRef.current = true;
    const releaseIgnore = () => {
      setTimeout(() => {
        ignoreViewportEventRef.current = false;
      }, 520);
    };

    const desiredLevel = 4;
    const currentLevel = mapRef.current.getLevel?.();
    /** 하단 미리보기 카드에 핀이 가리지 않도록, 뷰포트 높이에 맞춰 위로 더 밀어 올림 */
    const panUpPx =
      typeof window !== "undefined"
        ? Math.min(
            320,
            Math.max(150, Math.round(window.innerHeight * 0.26) + 48)
          )
        : 180;
    const { lat, lng } = wgs;
    const targetLatLng = new window.kakao.maps.LatLng(lat, lng);

    const getOffsetLatLng = () => {
      try {
        const projection = mapRef.current?.getProjection?.();
        if (!projection?.pointFromCoords || !projection?.coordsFromPoint) {
          return new window.kakao.maps.LatLng(lat + 0.0008, lng);
        }
        const point = projection.pointFromCoords(targetLatLng);
        point.y += panUpPx;
        return projection.coordsFromPoint(point);
      } catch (e) {
        return new window.kakao.maps.LatLng(lat + 0.0008, lng);
      }
    };

    const moveToOffset = () => {
      const offsetLatLng = getOffsetLatLng();
      mapRef.current.panTo(offsetLatLng);
      try {
        mapRef.current.relayout?.();
      } catch {
        /* ignore */
      }
      releaseIgnore();
    };

    const needsZoomIn = typeof currentLevel === "number" && currentLevel > desiredLevel;
    if (needsZoomIn) {
      mapRef.current.setLevel(desiredLevel, { animate: true });
      setTimeout(moveToOffset, 180);
    } else {
      moveToOffset();
    }
    requestAnimationFrame(() => {
      try {
        mapRef.current?.relayout?.();
      } catch {
        /* ignore */
      }
    });
    setTimeout(() => {
      try {
        mapRef.current?.relayout?.();
      } catch {
        /* ignore */
      }
    }, 160);
  }, [selectedPlace, mapReady]);

  // 코스 1차–2차 폴리라인 + 거리 라벨 (클릭·드래그를 가로채지 않게)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) return;

    let releaseIgnoreTimer = null;

    if (courseLegLabelOverlayRef.current) {
      try {
        courseLegLabelOverlayRef.current.setMap(null);
      } catch {
        /* ignore */
      }
      courseLegLabelOverlayRef.current = null;
    }

    if (coursePolylineRef.current) {
      try {
        coursePolylineRef.current.setMap(null);
      } catch {
        /* ignore */
      }
      coursePolylineRef.current = null;
    }

    const rawPath = courseOverlay?.polylinePath;
    if (!Array.isArray(rawPath) || rawPath.length < 2) {
      return undefined;
    }

    const kakaoPath = rawPath
      .filter(
        (p) =>
          p &&
          Number.isFinite(Number(p.lat)) &&
          Number.isFinite(Number(p.lng))
      )
      .map(
        (p) =>
          new window.kakao.maps.LatLng(Number(p.lat), Number(p.lng))
      );

    if (kakaoPath.length < 2) return undefined;

    coursePolylineRef.current = new window.kakao.maps.Polyline({
      path: kakaoPath,
      strokeWeight: 4,
      strokeColor: "#7c3aed",
      strokeOpacity: 0.88,
      strokeStyle: "solid",
    });
    coursePolylineRef.current.setMap(mapRef.current);
    try {
      if (typeof coursePolylineRef.current.setClickable === "function") {
        coursePolylineRef.current.setClickable(false);
      }
    } catch {
      /* ignore */
    }

    const legLabel = String(courseOverlay?.legLabel || "").trim();
    const lp = courseOverlay?.labelPosition;
    let overlayLat = null;
    let overlayLng = null;
    if (
      lp &&
      Number.isFinite(Number(lp.lat)) &&
      Number.isFinite(Number(lp.lng))
    ) {
      overlayLat = Number(lp.lat);
      overlayLng = Number(lp.lng);
    } else if (kakaoPath.length) {
      const mid = kakaoPath[Math.floor(kakaoPath.length / 2)];
      overlayLat = mid.getLat();
      overlayLng = mid.getLng();
    }

    const canDismiss = typeof onCourseOverlayDismissRef.current === "function";
    if (
      overlayLat != null &&
      overlayLng != null &&
      typeof window.kakao.maps.CustomOverlay === "function" &&
      (legLabel || canDismiss)
    ) {
      const wrap = document.createElement("div");
      wrap.style.cssText = [
        "display:flex",
        "flex-direction:row",
        "align-items:flex-start",
        "gap:6px",
        "pointer-events:none",
      ].join(";");

      if (legLabel) {
        const labelEl = document.createElement("div");
        labelEl.textContent = legLabel;
        labelEl.style.cssText = [
          "padding:5px 10px",
          "background:rgba(255,255,255,0.96)",
          "border:1px solid rgba(124,58,237,0.45)",
          "border-radius:10px",
          "font-size:11px",
          "font-weight:700",
          "color:#5b21b6",
          "pointer-events:none",
          "white-space:nowrap",
          "box-shadow:0 2px 8px rgba(0,0,0,0.08)",
        ].join(";");
        wrap.appendChild(labelEl);
      }

      if (canDismiss) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", "경로 끄기");
        btn.title = "경로 숨기기";
        btn.textContent = "×";
        btn.style.cssText = [
          "flex-shrink:0",
          "width:28px",
          "height:28px",
          "min-width:28px",
          "padding:0",
          "margin:0",
          "border-radius:999px",
          "border:1px solid rgba(124,58,237,0.55)",
          "background:rgba(255,255,255,0.98)",
          "color:#5b21b6",
          "font-size:17px",
          "line-height:1",
          "font-weight:500",
          "cursor:pointer",
          "pointer-events:auto",
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "box-shadow:0 2px 10px rgba(0,0,0,0.12)",
          "-webkit-tap-highlight-color:transparent",
        ].join(";");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onCourseOverlayDismissRef.current?.();
        });
        wrap.appendChild(btn);
      }

      try {
        courseLegLabelOverlayRef.current = new window.kakao.maps.CustomOverlay({
          map: mapRef.current,
          position: new window.kakao.maps.LatLng(overlayLat, overlayLng),
          content: wrap,
          xAnchor: 0.5,
          yAnchor: legLabel ? 0.45 : 0.5,
          zIndex: 5,
          clickable: true,
        });
      } catch {
        courseLegLabelOverlayRef.current = null;
      }
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    kakaoPath.forEach((ll) => bounds.extend(ll));
    ignoreViewportEventRef.current = true;
    const padB = Math.round(Number(courseOverlayFitBottomPaddingPx) || 0);
    if (padB > 0) {
      const padT = 56;
      const padX = 44;
      mapRef.current.setBounds(bounds, padT, padX, padB, padX);
    } else {
      mapRef.current.setBounds(bounds);
    }
    releaseIgnoreTimer = setTimeout(() => {
      ignoreViewportEventRef.current = false;
    }, 480);

    return () => {
      if (releaseIgnoreTimer) {
        clearTimeout(releaseIgnoreTimer);
        releaseIgnoreTimer = null;
      }
      ignoreViewportEventRef.current = false;
      if (courseLegLabelOverlayRef.current) {
        try {
          courseLegLabelOverlayRef.current.setMap(null);
        } catch {
          /* ignore */
        }
        courseLegLabelOverlayRef.current = null;
      }
      if (coursePolylineRef.current) {
        try {
          coursePolylineRef.current.setMap(null);
        } catch {
          /* ignore */
        }
        coursePolylineRef.current = null;
      }
    };
  }, [mapReady, courseOverlay, courseOverlayFitBottomPaddingPx]);

  // center prop이 변경될 때 지도 중심 이동
  useEffect(() => {
    if (mapReady && mapRef.current && center) {
      console.log("🗺️ 지도 중심 이동:", center);
      runWithIgnoredViewportEvents(() => {
        mapRef.current.setCenter(
          new window.kakao.maps.LatLng(center.lat, center.lng)
        );
        mapRef.current.setLevel(4);
      });
    }
  }, [center, mapReady, runWithIgnoredViewportEvents]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={styles.mapOuter}>
        {mapError ? (
          <div style={styles.errorBox}>{mapError}</div>
        ) : (
          <div ref={mapContainerRef} style={styles.mapInner} />
        )}
      </div>
      
      {showFloatingLocationButton ? (
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          style={{
            ...styles.locationButton,
            opacity: isLocating ? 0.7 : 1,
          }}
          title="내 위치"
          aria-label="내 위치로 이동"
        >
          {isLocating ? (
            <div style={styles.spinner} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          )}
        </button>
      ) : null}
      
      {/* 커스텀 오버레이 */}
      {overlayPlace && (
        <div ref={overlayRef}>
          <KakaoPlaceOverlay
            place={overlayPlace}
            onClose={closeOverlay}
            onQuickSave={handleQuickSave}
            userRole={userRole}
            onSave={onSave}
            savedFolders={savedFolders}
            userSavedPlaces={userSavedPlaces}
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
  locationButton: {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    backgroundColor: "white",
    border: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    transition: "all 0.2s ease",
    color: "#333"
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #ddd",
    borderTopColor: "#4285F4",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  }
};

export default MapView;