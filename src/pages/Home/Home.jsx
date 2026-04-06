import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toast/ToastProvider";

import MarkerLegend from "../../components/Map/MarkerLegend";
import SearchBar from "../../components/SearchBar/SearchBar";
import CuratorFilterBar from "../../components/CuratorFilterBar/CuratorFilterBar";
import CuratorApplicationButton from "../../components/CuratorApplicationButton/CuratorApplicationButton";
import UserCard from "../../components/UserCard/UserCard";
import MapView from "../../components/Map/MapView";
import PlacePreviewCard from "../../components/PlaceCard/PlacePreviewCard";
import PlaceDetail from "../../components/PlaceDetail/PlaceDetail";
import SaveFolderModal from "../../components/SaveFolderModal/SaveFolderModal";
import SavedPlaces from "../../components/SavedPlaces/SavedPlaces";
import AddPlaceForm from "../../components/AddPlaceForm/AddPlaceForm";
import AnimatedToast from "../../components/AnimatedToast/AnimatedToast";
import CheckinRanking from "../../components/CheckinRanking/CheckinRanking";
import HotPlaceMarker from "../../components/HotPlaceMarker/HotPlaceMarker";
import CheckInToast from "../../components/CheckInToast/CheckInToast";

import { places as dummyPlaces } from "../../data/places";

import { useAuth } from "../../context/AuthContext";

import { supabase } from "../../lib/supabase";

import {
  getFolders,
  getSavedPlacesMap,
  getPlaceFolderIds,
  getPrimarySavedFolderColor,
  isPlaceSaved,
  savePlaceToFolder,
} from "../../utils/storage";

import { getCustomPlaces } from "../../utils/customPlacesStorage";

const AI_API_BASE_URL =
  import.meta.env.VITE_AI_API_BASE_URL || "http://localhost:4000";

export default function Home() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const { showToast } = useToast();

  const { user, loading: authLoading, signInWithProvider, signOut } = useAuth();

  const devAdminUserId = import.meta.env.VITE_ADMIN_USER_ID;

  // 팔로우 알림 확인 함수
  const checkUnreadFollowers = async (curatorId) => {
    // 테이블이 존재하지 않으므로 바로 종료
    console.log('ℹ️ follower_notifications 테이블이 존재하지 않아 팔로우 알림 확인을 건너뜁니다.');
    return;
    
    try {
      // 테이블이 존재하는지 확인 후 쿼리 실행
      const { data, error } = await supabase
        .from('follower_notifications')
        .select('*')
        .eq('curator_id', curatorId)
        .eq('is_read', false);

      if (error) {
        // 테이블이 없는 경우 에러를 무시하고 로그만 남김
        if (error.code === 'PGRST205') {
          console.log('ℹ️ follower_notifications 테이블이 존재하지 않습니다.');
          return;
        }
        console.error('팔로우 알림 확인 오류:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log(`🔔 새로운 팔로워 ${data.length}명이 있습니다!`);
        // 여기에 알림 표시 로직 추가
      }
    } catch (error) {
      console.error('팔로우 알림 확인 중 오류:', error);
    }
  };

  // 로컬 AI 검색 함수들
  const getCurrentUserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation이 지원되지 않습니다.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('위치 가져오기 실패:', error);
          // 기본 위치: 서울 시청
          resolve({ lat: 37.5665, lng: 126.9780 });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 300000 // 5분 캐시
        }
      );
    });
  };

  const searchNearbyBars = async (keyword, userLocation) => {
    return new Promise((resolve) => {
      if (!window.kakao?.maps?.services) {
        resolve([]);
        return;
      }

      const ps = new window.kakao.maps.services.Places();
      
      // 1. 지역명 추출 (강남역, 언주역, 명동 등)
      const locationPattern = /(\w+역|\w+동|\w+구|\w+대로|\w+로|\w+거리|\w+시장)/;
      const locationMatch = keyword.match(locationPattern);
      const locationName = locationMatch ? locationMatch[1] : null;
      
      // 2. 술집 키워드 추출
      const barKeywords = ['술집', '포차', '바', '펍', '주점', '호프'];
      const barKeyword = barKeywords.find(k => keyword.includes(k)) || '술집';
      
      let searchKeyword;
      let searchLocation;
      
      if (locationName) {
        // 지역명이 있으면 지역명으로 검색
        searchKeyword = locationName;
        searchLocation = null; // 지역명 검색이므로 위치 기반 검색 아님
        console.log('🔍 지역명 기반 검색:', locationName);
      } else {
        // 지역명이 없으면 술집 키워드로 현재 위치 기반 검색
        searchKeyword = barKeyword;
        searchLocation = userLocation;
        console.log('🔍 현재 위치 기반 검색:', barKeyword);
      }

      const searchOptions = {
        category_group_code: 'FD6', // 음식점
        sort: window.kakao.maps.services.SortBy.DISTANCE
      };

      if (searchLocation) {
        // 현재 위치 기반 검색
        searchOptions.location = new window.kakao.maps.LatLng(searchLocation.lat, searchLocation.lng);
        searchOptions.radius = 800;
      }

      ps.keywordSearch(
        searchKeyword,
        (data, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            let nearbyPlaces;
            
            if (locationName) {
              // 지역명 검색 결과는 그대로 사용
              nearbyPlaces = data.map(place => ({
                ...place,
                distance: 0 // 지역명 검색이므로 거리 정보 없음
              }));
              console.log(`🍺 ${locationName} 지역명 검색 결과:`, nearbyPlaces.length);
            } else {
              // 현재 위치 기반 검색은 800m 이내 필터링
              nearbyPlaces = data.filter(place => {
                const distance = calculateDistance(
                  userLocation.lat, 
                  userLocation.lng, 
                  place.y, 
                  place.x
                );
                return distance <= 800;
              }).map(place => ({
                ...place,
                distance: Math.round(calculateDistance(
                  userLocation.lat, 
                  userLocation.lng, 
                  place.y, 
                  place.x
                ))
              }));
              console.log(`🍺 ${barKeyword} 근처 검색 결과:`, nearbyPlaces.length);
            }
            
            resolve(nearbyPlaces);
          } else {
            console.log(`🍺 ${searchKeyword} 검색 결과 없음:`, status);
            resolve([]);
          }
        },
        searchOptions
      );
    });
  };

  // 카카오 API로 장소 추가 정보 가져오기
  const enrichPlaceWithKakaoInfo = async (place) => {
    if (!place.name || place.isKakaoEnriched) {
      return place; // 이미 카카오 정보가 있거나 이름이 없으면 패스
    }

    // 중복 호출 방지 - 이미 처리 중이면 패스
    if (place._isEnriching) {
      return place;
    }

    try {
      console.log('🔍 카카오 장소 정보 조회 시작:', place.name);
      
      // 처리 중 표시
      place._isEnriching = true;
      
      // CORS 문제로 detail.json 대신 keyword.json만 사용
      // place_id가 있어도 이름으로 검색 (CORS 회피)
      const searchQuery = place.name;
      const apiUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&size=5`; // size 5로 증가
      
      console.log('🔍 API 호출 URL:', apiUrl);
      console.log('🔍 검색어:', searchQuery);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `KakaoAK ${import.meta.env.VITE_KAKAO_REST_API_KEY}`
        }
      });

      console.log('🔍 API 응답 상태:', response.status);

      if (!response.ok) {
        console.log('⚠️ 카카오 API 호출 실패 - 상태:', response.status);
        delete place._isEnriching;
        return place;
      }

      const data = await response.json();
      console.log('🔍 카카오 API 응답 데이터:', data);
      console.log('🔍 검색 결과 수:', data.documents?.length || 0);
      
      const kakaoPlace = data.documents?.[0];

      if (kakaoPlace) {
        console.log('✅ 카카오 장소 정보 찾음:', kakaoPlace.place_name);
        console.log('📍 카카오 장소 상세:', {
          place_name: kakaoPlace.place_name,
          address_name: kakaoPlace.address_name,
          phone: kakaoPlace.phone,
          category_name: kakaoPlace.category_name
        });
        
        // 카카오 정보로 장소 업데이트
        const enrichedPlace = {
          ...place,
          category_name: kakaoPlace.category_name || place.category,
          phone: kakaoPlace.phone || place.phone,
          road_address_name: kakaoPlace.road_address_name || place.address,
          address: kakaoPlace.address_name || place.address,
          place_url: kakaoPlace.place_url,
          x: kakaoPlace.x,
          y: kakaoPlace.y,
          isKakaoEnriched: true,
          kakaoId: kakaoPlace.id
        };

        delete place._isEnriching;
        return enrichedPlace;
      }
      
      console.log('⚠️ 카카오 검색 결과 없음');
      console.log('🔍 다른 검색 결과들:', data.documents?.slice(0, 3));
      delete place._isEnriching;
      return place;
    } catch (error) {
      console.log('⚠️ 카카오 장소 정보 조회 오류:', error.message);
      delete place._isEnriching;
      return place;
    }
  };

  const searchBlogReviews = async (keyword) => {
    try {
      console.log('📝 네이버 블로그 검색 시작:', keyword);
      
      // 네이버 블로그 검색 API 호출 (실제 구현 필요)
      // 임시로 더미 데이터 반환
      const dummyReviews = [
        {
          title: `${keyword} 맛집 후기`,
          content: `${keyword}에 다녀왔습니다. 정말 맛있었습니다!`,
          author: 'food_lover',
          date: '2024-01-15'
        },
        {
          title: `${keyword} 재방문 의사 100%`,
          content: '분위기도 좋고 음식도 맛있어서 자주 가게 됩니다.',
          author: 'restaurant_critic',
          date: '2024-01-10'
        }
      ];
      
      console.log('📝 네이버 블로그 검색 결과:', dummyReviews.length);
      return dummyReviews;
    } catch (error) {
      console.error('📝 네이버 블로그 검색 오류:', error);
      return [];
    }
  };

  const searchMapBars = async (keyword) => {
    return new Promise((resolve) => {
      if (!window.kakao?.maps?.services || !mapRef.current) {
        console.error('❌ searchMapBars: 카카오 API 또는 맵 레퍼런스 없음');
        resolve([]);
        return;
      }

      const ps = new window.kakao.maps.services.Places();
      
      // 현재 지도 영역 가져오기
      const mapBounds = mapRef.current.getBounds();
      if (!mapBounds) {
        console.error('❌ searchMapBars: 지도 영역 없음');
        resolve([]);
        return;
      }

      console.log('🗺️ searchMapBars 호출:', keyword);
      console.log('🗺️ 카카오 API 상태:', !!window.kakao?.maps);
      console.log('🗺️ 맵 레퍼런스 상태:', !!mapRef.current);

      ps.keywordSearch(
        keyword, // 전달받은 키워드 그대로 사용
        (data, status) => {
          console.log('🗺️ 카카오 검색 응답:', { status, dataLength: data?.length });
          
          if (status === window.kakao.maps.services.Status.OK) {
            let mapPlaces;
            
            // 지역명이 포함된 검색어는 지도 영역 필터링 없음
            if (keyword.includes('역') || keyword.includes('동') || keyword.includes('구') || keyword.includes('대로') || keyword.includes('로') || keyword.includes('거리') || keyword.includes('시장')) {
              // 지역명 검색은 필터링 없음
              mapPlaces = data.map(place => ({
                ...place,
                distance: 0
              }));
              console.log(`🗺️ ${keyword} 지역명 검색 결과 (필터링 없음):`, mapPlaces.length);
            } else {
              // 일반 검색은 지도 영역 필터링
              mapPlaces = data.filter(place => {
                const placeLatLng = new window.kakao.maps.LatLng(place.y, place.x);
                return mapBounds.contain(placeLatLng);
              }).map(place => ({
                ...place,
                distance: 0 // 전체 검색이므로 거리 정보 없음
              }));
              console.log(`🗺️ ${keyword} 범용 검색 결과 (지도 영역 필터링 후):`, mapPlaces.length);
            }
            
            console.log('🗺️ 최종 mapPlaces:', mapPlaces);
            resolve(mapPlaces);
          } else {
            console.log(`🗺️ ${keyword} 검색 결과 없음:`, status);
            resolve([]);
          }
        },
        {
          category_group_code: 'FD6', // 음식점
          // 현재 지도 영역으로 검색 범위 제한
          bounds: mapBounds,
          sort: window.kakao.maps.services.SortBy.ACCURACY
        }
      );
    });
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // 미터로 변환
  };

  const calculateLocalAIScores = (places, keyword, userLocation = null) => {
    return places.map(place => {
      let score = 0;
      
      // 거리 점수 (위치기반 검색만 적용)
      if (userLocation && place.distance > 0) {
        score += Math.max(0, 50 - place.distance / 16);
      }
      
      // 카테고리 매칭 점수
      if (keyword.includes('술집') || keyword.includes('포차') || keyword.includes('바')) {
        score += 15;
      }
      
      // 분위기 매칭 점수 (키워드 기반)
      if (keyword.includes('조용') && place.category_name.includes('바')) score += 10;
      if (keyword.includes('활기') && place.category_name.includes('호프')) score += 10;
      if (keyword.includes('이국') && place.category_name.includes('펍')) score += 10;
      
      // 2차 술집 매칭
      if (keyword.includes('2차') || keyword.includes('이차')) {
        score += 20;
      }
      
      // 걸어갈 만한 거리 보너스 (위치기반 검색만 적용)
      if (userLocation && place.distance > 0 && place.distance <= 500) {
        score += 15;
      }

      // 장소 이름 기반 점수
      if (place.place_name.includes('포차') || place.place_name.includes('바')) {
        score += 5;
      }

      return {
        ...place,
        aiScore: Math.round(score),
        recommendation: getLocalRecommendationReason(score, keyword, place, userLocation),
        estimatedCapacity: 20,
        atmosphere: getAtmosphereFromCategory(place.category_name),
        id: `local_${place.id}`,
        isExternal: true
      };
    }).sort((a, b) => b.aiScore - a.aiScore).slice(0, 5);
  };

  const getAtmosphereFromCategory = (category) => {
    if (category.includes('바') || category.includes('펍')) return '조용한';
    if (category.includes('호프') || category.includes('주점')) return '활기찬';
    if (category.includes('포차') || category.includes('선술집')) return '전통적인';
    return '일반적인';
  };

  const getLocalRecommendationReason = (score, keyword, place, userLocation = null) => {
    const reasons = [];
    
    // 거리 기반 추천 (위치기반 검색만 적용)
    if (userLocation && place.distance > 0) {
      if (place.distance <= 300) reasons.push('도보 5분 거리');
      if (place.distance <= 500) reasons.push('도보 10분 거리');
    }
    
    // 카테고리 기반 추천
    if (place.category_name.includes('포차')) reasons.push('전통적인 분위기');
    if (place.category_name.includes('바')) reasons.push('조용한 분위기');
    if (place.category_name.includes('호프')) reasons.push('활기찬 분위기');
    
    // 키워드 기반 추천
    if (keyword.includes('2차') || keyword.includes('이차')) reasons.push('2차 술집 추천');
    
    // 전체 지도 검색의 경우
    if (!userLocation || place.distance === 0) {
      reasons.push('지도 전체 검색');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'AI 추천 장소';
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [showPlaceDetail, setShowPlaceDetail] = useState(false); // 장소 상세 표시 상태
  const [isCurator, setIsCurator] = useState(false);
  const curatorWelcomeRef = useRef(false); // 큐레이터 상태 변화 감지용 ref
  const [curatorProfile, setCuratorProfile] = useState(null); // 큐레이터 프로필 정보
  const [dbCurators, setDbCurators] = useState([]); // DB에서 가져온 큐레이터 목록
  const [dbPlaces, setDbPlaces] = useState([]); // DB에서 가져온 장소 목록

  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  
  // 장소 선택 핸들러 (모든 장소 일회성 정보)
  const handlePlaceSelect = async (place) => {
    // 장소 데이터 구조 통일
    const normalizedPlace = {
      ...place,
      name: place.name || place.places?.name || place.place_name || '알 수 없는 장소',
      place_id: place.place_id || place.places?.place_id || place.id,
      address: place.address || place.places?.address || '주소 정보 없음',
      phone: place.phone || place.places?.phone || '전화번호 정보 없음',
      category: place.category || place.places?.category || '미분류',
      // 큐레이터 정보도 복사
      curators: place.curators || [],
      curatorPlaces: place.curatorPlaces || [],
      curatorReasons: place.curatorReasons || {},
      curatorCount: place.curatorCount || 0
    };
    
    console.log('🔍 장소 선택:', normalizedPlace);
    console.log('🔍 place_id 확인:', normalizedPlace.place_id);
    console.log('🔍 큐레이터 정보:', place.curators, place.curatorPlaces);
    console.log('🔍 curatorPlaces 길이:', normalizedPlace.curatorPlaces?.length);
    
    // 1. 즉시 기본 정보 표시
    setSelectedPlace(normalizedPlace);
    
    // 2. 모든 장소 카카오 정보 가져오기 (일회성)
    if (!normalizedPlace.isKakaoEnriched && normalizedPlace.name) {
      try {
        console.log('🔍 장소 상세 정보 가져오기:', normalizedPlace.name);
        console.log('🔍 사용할 place_id:', normalizedPlace.place_id);
        
        const enrichedPlace = await enrichPlaceWithKakaoInfo(normalizedPlace);
        
        if (enrichedPlace.isKakaoEnriched) {
          console.log('✅ 카카오 정보 업데이트 성공:', enrichedPlace);
          // 큐레이터 정보 유지하면서 업데이트
          setSelectedPlace({
            ...enrichedPlace,
            curators: normalizedPlace.curators,
            curatorPlaces: normalizedPlace.curatorPlaces,
            curatorReasons: normalizedPlace.curatorReasons,
            curatorCount: normalizedPlace.curatorCount
          });
        } else {
          console.log('⚠️ 카카오 정보 업데이트 실패');
        }
      } catch (error) {
        console.log('⚠️ 카카오 정보 가져오기 실패:', error.message);
      }
    }
  };
  const [showFollowModal, setShowFollowModal] = useState(false); // 팔로우 모달 상태
  const [selectedCurator, setSelectedCurator] = useState(null); // 선택된 큐레이터 정보
  const [saveTargetPlace, setSaveTargetPlace] = useState(null);
  const [folders, setFolders] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [kakaoPlaces, setKakaoPlaces] = useState([]); // 카카오 장소들을 위한 state
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [blogReviews, setBlogReviews] = useState([]); // 네이버 블로그 리뷰 상태
  const [customPlaces, setCustomPlaces] = useState([]); // 더미 데이터 제거
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [selectedCurators, setSelectedCurators] = useState([]);
  const [showAll, setShowAll] = useState(true); // 기본값을 true로 변경
  const [userSavedPlaces, setUserSavedPlaces] = useState({}); // 사용자 저장 장소 폴더 정보

  const [aiSummary, setAiSummary] = useState("");
  const [aiReasons, setAiReasons] = useState([]);
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [loadingDots, setLoadingDots] = useState(".");
  const [isLocationBasedSearch, setIsLocationBasedSearch] = useState(false); // 위치기반 검색 여부

  const [legendCategory, setLegendCategory] = useState(null);

  const [livePlaceIds, setLivePlaceIds] = useState(() => new Set());
const [showUserCard, setShowUserCard] = useState(false); // UserCard 표시 상태

  const livePlaceIdsText = useMemo(() => {
    try {
      return Array.from(livePlaceIds || []).join(", ");
    } catch {
      return "";
    }
  }, [livePlaceIds]);

  useEffect(() => {
    let mounted = true;
    let cleanup = null;

    const reset = () => {
      if (!mounted) return;
      setLivePlaceIds(new Set());
    };

    const init = async () => {
      if (!user) {
        reset();
        return;
      }

      const { data, error } = await supabase
        .from("curator_live_sessions")
        .select("place_id")
        .eq("is_live", true);

      if (!mounted) return;

      if (error) {
        console.error("Failed to fetch curator_live_sessions:", error);
        reset();
      } else {
        const next = new Set(
          (Array.isArray(data) ? data : []).map((row) => String(row.place_id))
        );
        setLivePlaceIds(next);
      }

      const channel = supabase
        .channel("curator_live_sessions:live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "curator_live_sessions" },
          (payload) => {
            const newRow = payload?.new || null;
            const oldRow = payload?.old || null;
            const newPlaceId = newRow?.place_id != null ? String(newRow.place_id) : null;
            const oldPlaceId = oldRow?.place_id != null ? String(oldRow.place_id) : null;
            const newIsLive = Boolean(newRow?.is_live);

            setLivePlaceIds((prev) => {
              const next = new Set(prev);

              // If the old row was live, remove it first (handles updates or deletes)
              if (oldPlaceId && Boolean(oldRow?.is_live)) {
                next.delete(oldPlaceId);
              }

              // Add the new row if it's live
              if (newPlaceId && newIsLive) {
                next.add(newPlaceId);
              }

              return next;
            });
          }
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    };

    init();

    return () => {
      mounted = false;
      if (typeof cleanup === "function") cleanup();
    };
  }, [user]);

  useEffect(() => {
    if (!query.trim()) {
      setSelectedPlace(null);
      setAiError("");
      setAiSummary("");
      setAiReasons([]);
      setAiRecommendedIds([]);
      setAiSheetOpen(false);
    }
  }, [query]);

  useEffect(() => {
    refreshStorage();
    refreshCustomPlaces();
  }, []);

  useEffect(() => {
    const refresh = () => refreshStorage();
    window.addEventListener("judo_storage_updated", refresh);
    return () => window.removeEventListener("judo_storage_updated", refresh);
  }, []);

  useEffect(() => {
    if (!isAiSearching) {
      setLoadingDots(".");
      return;
    }

    const frames = [".", "..", "..."];
    let index = 0;

    const timer = setInterval(() => {
      index = (index + 1) % frames.length;
      setLoadingDots(frames[index]);
    }, 350);

    return () => clearInterval(timer);
  }, [isAiSearching]);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      if (authLoading) return;
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      // 개발 환경에서는 VITE_ADMIN_USER_ID로 바로 admin 인식
      if (import.meta.env.DEV && import.meta.env.VITE_ADMIN_USER_ID === user.id) {
        console.log("🔧 개발 환경: Admin 계정 자동 인식");
        setIsAdmin(true);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("admin check error:", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === "admin");
      console.log("👑 Admin check 결과:", { userId: user.id, isAdmin: data?.role === "admin" });
    };

    const checkCurator = async () => {
      if (authLoading) return;
      if (!user?.id) {
        setIsCurator(false);
        setCuratorProfile(null);
        return;
      }

      console.log("Checking curator for user ID:", user.id); // 디버깅용

      const { data, error } = await supabase
        .from("curators")
        .select("*") // 모든 필드 가져오기
        .eq("user_id", user.id) // user_id로 조회
        .maybeSingle();

      console.log("Curator check result:", { data, error }); // 디버깅용

      if (cancelled) return;
      if (error) {
        console.error("curator check error:", error);
        setIsCurator(false);
        setCuratorProfile(null);
        return;
      }

      const isUserCurator = !!data;
      const wasCuratorBefore = curatorWelcomeRef.current;

      setIsCurator(isUserCurator);
      curatorWelcomeRef.current = isUserCurator;

      if (isUserCurator && !wasCuratorBefore) {
        console.log("🎉 새로운 큐레이터 환영 메시지 표시");

        const welcomeKey = `curator_welcome_${user.id}`;
        const hasShownWelcome = localStorage.getItem(welcomeKey);

        if (!hasShownWelcome) {
          setTimeout(() => {
            const emailPrefix = user?.email ? user.email.split('@')[0] : 'user';
            alert(`🎉 큐레이터가 되신 것을 환영합니다!\n\n이제 스튜디오에서 장소를 등록하고\n팔로워들과 멋진 장소를 공유할 수 있어요!\n\n스튜디오 입장 → @${emailPrefix} 버튼을 눌러서 입장하세요!`);
            localStorage.setItem(welcomeKey, 'shown');
          }, 1000);
        }

        setCuratorProfile({
          username: data.username,
          displayName: data.display_name,
          bio: data.bio,
          image: data.image
        });
        console.log("✅ 큐레이터 프로필 로드됨:", data.username);

        // 큐레이터 로그인 시 팔로우 알림 확인
        setTimeout(() => {
          checkUnreadFollowers(data.id);
        }, 1500);
      } else if (isUserCurator) {
        // 기존 큐레이터도 팔로우 알림 확인
        setCuratorProfile({
          username: data.username,
          displayName: data.display_name,
          bio: data.bio,
          image: data.image
        });

        setTimeout(() => {
          checkUnreadFollowers(data.id);
        }, 1500);
      }

      // 반려된 신청 확인 로직
      const checkRejectedApplication = async () => {
        try {
          const { data: rejectedApp, error } = await supabase
            .from("curator_applications")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "rejected")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error("반려 신청 확인 오류:", error);
            return;
          }

          if (rejectedApp) {
            const rejectKey = `curator_rejected_${user.id}_${rejectedApp.id}`;
            const hasShownRejectAlert = localStorage.getItem(rejectKey);

            if (!hasShownRejectAlert) {
              setTimeout(() => {
                alert(`😔 큐레이터 신청이 반려되었습니다.\n\n신청자: ${rejectedApp.name}\n반려 사유: 검토 후 부적합하다고 판단되었습니다.\n\n다시 신청하실 수 있습니다.`);
                localStorage.setItem(rejectKey, 'shown');
              }, 1500);
            }
          }
        } catch (error) {
          console.error("반려 확인 중 오류:", error);
        }
      };

      checkRejectedApplication();
    };

    checkAdmin();
    checkCurator();
    
    // 모든 큐레이터 데이터 가져오기
    const loadCurators = async () => {
      try {
        const { data, error } = await supabase
          .from("curators")
          .select("username, display_name, bio, image")
          .order("created_at", { ascending: false });
          
        if (error) {
          console.error("큐레이터 로드 오류:", error);
          setDbCurators([]);
          return;
        }
        
        // CuratorFilterBar에 맞는 형식으로 변환
        const formattedCurators = data.map(curator => ({
          id: curator.username,
          name: curator.username,
          displayName: curator.display_name,
          bio: curator.bio,
          avatar: curator.image,
          color: "#2ECC71" // 기본 색상
        }));
        
        setDbCurators(formattedCurators);
        console.log(`✅ 큐레이터 목록 로드: ${formattedCurators.length}개`);
        // console.log("📝 큐레이터 데이터:", formattedCurators); // 전체 데이터 출력 제거 
      } catch (error) {
        console.error("큐레이터 로드 실패:", error);
        setDbCurators([]);
      }
    };
    
    loadCurators();
    
    // 모든 장소 데이터 가져오기 (공개 추천만)
    const loadPlaces = async () => {
      try {
        const { data, error } = await supabase
          .from("curator_places")
          .select(`
            *,
            places (id, name, lat, lng, place_id, category, created_at),
            curators!curator_places_curator_id_fkey (username, display_name)
          `)
          .eq("is_archived", false) // 비공개 추천 제외
          .order("created_at", { ascending: false });
        
        console.log("📋 curator_places 데이터:", { data, error, length: data?.length });
          
        if (error) {
          console.error("❌ 추천 로드 오류:", error);
          setDbPlaces([]);
          return;
        }
        
        // 장소별로 큐레이터 수 집계
        const placeMap = new Map();
        
        // 각 장소에 카카오 정보 추가 (병렬 처리)
        const enrichedPlaces = await Promise.all(
          data.map(async (curatorPlace) => {
            const place = curatorPlace.places;
            if (!place) return curatorPlace;
            
            // 카카오 정보 확장 제거 - 지연 로딩으로 변경
            return {
              ...curatorPlace,
              places: place,
              kakaoEnriched: false // 지연 로딩을 위해 false로 설정
            };
          })
        );
        
        enrichedPlaces.forEach(curatorPlace => {
          const place = curatorPlace.places;
          if (!place) return;
          
          const key = `${place.lat}_${place.lng}`; // 위치 기반 중복 체크
          
          if (placeMap.has(key)) {
            // 중복 장소: 큐레이터 수 증가
            const existing = placeMap.get(key);
            existing.curatorCount = (existing.curatorCount || 0) + 1;
            existing.curators.push(curatorPlace.curator_id);
            existing.curatorPlaces.push(curatorPlace); // curatorPlaces에도 추가!
          } else {
            // 새 장소: 초기화
            placeMap.set(key, {
              ...place,
              curatorCount: 1,
              curators: [curatorPlace.curator_id],
              curatorPlaces: [curatorPlace] // 추천 정보 저장
            });
          }
        });
        
        // MapView에 맞는 형식으로 변환
        const formattedPlaces = Array.from(placeMap.values()).map(place => {
          // 큐레이터별 한 줄 평 맵 생성
          const curatorReasons = {};
          const curatorNames = [];
          
          place.curatorPlaces.forEach(curatorPlace => {
            // JOIN된 curators 테이블에서 display_name 가져오기
            const curatorName = curatorPlace.curators?.display_name || curatorPlace.display_name || curatorPlace.curator_id;
            // CuratorFilterBar와 통일하기 위해 username도 같이 저장
            const curatorUsername = curatorPlace.curators?.username || curatorPlace.curator_id;
            
            curatorNames.push(curatorName);
            curatorReasons[curatorName] = curatorPlace.one_line_reason || "";
            
            console.log(`🔍 큐레이터 데이터 처리:`, {
              curatorName,
              curatorUsername,
              one_line_reason: curatorPlace.one_line_reason,
              curators_display_name: curatorPlace.curators?.display_name,
              curators_username: curatorPlace.curators?.username
            });
          });
          
          return {
            id: place.id,
            name: place.name,
            lat: place.lat,
            lng: place.lng,
            category: place.category || "미분류",
            curatorCount: place.curatorCount, // 큐레이터 수
            curators: curatorNames, // 큐레이터 이름 목록 (display_name)
            curatorUsernames: place.curatorPlaces?.map(cp => cp.curators?.username || cp.curator_id), // username 목록 추가
            curatorReasons, // 큐레이터별 한 줄 평
            curatorPlaces: place.curatorPlaces, // 추천 정보
            comment: "",
            savedCount: 0,
            tags: [],
          };
        });
        
        console.log("🔍 중복 처리된 장소 (새 구조):", formattedPlaces.map(p => ({
          name: p.name,
          curatorCount: p.curatorCount,
          curators: p.curators
        })));
        
        setDbPlaces(formattedPlaces);
        console.log("✅ 추천 목록 로드:", formattedPlaces.length, "개 (중복 처리됨)");
      } catch (error) {
        console.error("❌ 추천 로드 실패:", error);
        setDbPlaces([]);
      }
    };
    
    checkAdmin();
    checkCurator();
    loadPlaces();
    
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  // 큐레이터 프로필 로드
  useEffect(() => {
    if (user && isCurator) {
      // 큐레이터 프로필 로드 (Supabase DB에서 직접)
      const loadCuratorProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('curators')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error("큐레이터 프로필 조회 실패:", error);
            return;
          }
          
          if (data) {
            const profile = {
              username: data.username,
              displayName: data.display_name,
              bio: data.bio,
              image: data.avatar
            };
            
            setCuratorProfile(profile);
            console.log("🎭 큐레이터 프로필 로드:", profile);
          }
        } catch (error) {
          console.error("큐레이터 프로필 로드 실패:", error);
        }
      };
      
      loadCuratorProfile();
    }
  }, [user, isCurator]);

  // Admin/큐레이터/일반 사용자에 따른 표시 로직
  const getDisplayUsername = () => {
    if (isAdmin) {
      return "admin"; // Admin은 항상 admin으로 표시
    }
    if (isCurator && curatorProfile?.username) {
      return curatorProfile.username; // 큐레이터는 큐레이터 이름으로 표시
    }
    // 일반 사용자: 이메일 앞자리 우선, 없으면 user_metadata, 없으면 "user"
    if (user?.email) {
      return user.email.split('@')[0]; // 이메일 앞자리로 표시
    }
    return user?.user_metadata?.username || "user"; // fallback
  };

  const getUserRole = () => {
    if (isAdmin) return "admin";
    if (isCurator) return "curator";
    return "user";
  };
  useEffect(() => {
    localStorage.removeItem("judo_custom_places");
    setCustomPlaces([]);
    
    // 임시로 큐레이터 데이터 직접 설정 (테스트용)
    const testCurator = {
      id: 'nopokiller',
      name: 'nopokiller',
      displayName: '노포킬러',
      bio: '안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.',
      avatar: null,
      color: '#2ECC71'
    };
    setDbCurators([testCurator]);
    console.log("🧪 테스트: 큐레이터 데이터 직접 설정:", testCurator);
    
    // 최초 방문 확인
    const hasVisitedBefore = localStorage.getItem("judo_has_visited");
    const isFirstVisit = !hasVisitedBefore;
    
    if (isFirstVisit) {
      // 최초 방문이면 전체 선택
      setShowAll(true);
      setSelectedCurators([]);
      localStorage.setItem("judo_has_visited", "true");
      console.log("🎯 최초 방문: 전체 선택");
    } else {
      // 재방문이면 전체 선택 상태로 시작
      setShowAll(true);
      setSelectedCurators([]);
      console.log("🎯 재방문: 전체 선택 상태로 시작");
    }
  }, []);

  // 사용자 저장 장소 폴더 정보 로드
  const loadUserSavedPlaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUserSavedPlaces({});
        return;
      }

      // 임시: RPC 함수 없이 직접 쿼리
      const { data, error } = await supabase
        .from('user_saved_places')
        .select(`
          place_id,
          user_saved_place_folders(
            folder_key,
            system_folders(
              name,
              color,
              icon
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ 사용자 저장 장소 로드 실패:', error);
        setUserSavedPlaces({});
        return;
      }

      // place_id 기반으로 폴더 정보 맵핑
      const folderMap = {};
      data?.forEach(item => {
        const folders = item.user_saved_place_folders?.map(upf => ({
          key: upf.folder_key,
          name: upf.system_folders?.name,
          color: upf.system_folders?.color,
          icon: upf.system_folders?.icon
        })) || [];
        folderMap[item.place_id] = folders;
      });

      setUserSavedPlaces(folderMap);
      console.log('✅ 사용자 저장 장소 로드:', folderMap);
    } catch (error) {
      console.error('❌ 사용자 저장 장소 로드 중 오류:', error);
      setUserSavedPlaces({});
    }
  };

  // 페이지 로드 시 데이터 로드
  useEffect(() => {
    console.log("🔄 페이지 로드 - 데이터 초기화");
    setSelectedCurators([]);
    setShowAll(true); // 항상 전체 선택으로 시작
    
    // 사용자 저장 장소 로드
    loadUserSavedPlaces();
    
    // 큐레이터 데이터 확인
    setTimeout(() => {
      console.log("🔍 dbCurators 데이터:", dbCurators.map(c => ({ id: c.id, name: c.name })));
    }, 1000);
  }, []);

  // 상태 변화 감지
  useEffect(() => {
    console.log("🔄 상태 변화:", { showAll, selectedCurators, dbCuratorsLength: dbCurators.length });
    console.log("📋 dbCurators 상세:", dbCurators);
  }, [showAll, selectedCurators, dbCurators]);

  const refreshStorage = () => {
    setFolders(getFolders());
    setSavedMap(getSavedPlacesMap());
  };

  const refreshCustomPlaces = () => {
    // localStorage에 저장된 더미 데이터 정리
    localStorage.removeItem("judo_custom_places");
    setCustomPlaces([]); // 빈 배열로 설정
  };

  const allPlaces = useMemo(() => {
  const result = [...customPlaces, ...dbPlaces];
  console.log("📦 allPlaces 상태:", { 
    customPlacesLength: customPlaces.length, 
    dbPlacesLength: dbPlaces.length, 
    totalLength: result.length 
  });
  return result;
}, [customPlaces, dbPlaces]);

  const savedPlacesByFolder = useMemo(() => {
    const result = {};
    folders.forEach((folder) => {
      result[folder.id] = allPlaces.filter((place) => {
        const ids = savedMap[place.id] || [];
        return Array.isArray(ids) && ids.includes(folder.id);
      });
    });
    return result;
  }, [allPlaces, folders, savedMap]);

  const curatorColorMap = useMemo(() => {
    const map = {};
    dbCurators.forEach((c) => {
      map[c.name] = c.color;
    });
    return map;
  }, [dbCurators]);

  const savedColorMap = useMemo(() => {
    const map = {};
    allPlaces.forEach((p) => {
      map[p.id] = getPrimarySavedFolderColor(p.id, folders);
    });
    return map;
  }, [allPlaces, folders]);

  const filteredByCuratorPlaces = useMemo(() => {
    // 노란별 버튼(showSavedOnly)이 켜져 있으면 본인이 저장한 장소만 표시
    if (showSavedOnly) {
      console.log("⭐ showSavedOnly 상태 - 본인 저장 장소만 표시:", dbPlaces.length);
      
      if (!user || !isCurator) {
        console.log("🔍 비큐레이터 또는 로그인 안됨 - 빈 배열 반환");
        return []; // 큐레이터가 아니거나 로그인 안했으면 빈 배열
      }
      
      // 본인(user.id)가 추천한 장소만 필터링
      const myPlaces = dbPlaces.filter(place => {
        const placeCurators = place.curators || [];
        return placeCurators.includes(user.id);
      });
      
      console.log("✅ 본인 저장 장소 필터링 결과:", myPlaces.length, "개");
      return myPlaces;
    }
    
    if (showAll) {
      // 일반 모드에서는 공개 추천만 표시
      const filtered = dbPlaces.filter(place => {
        // curatorCount가 1 이상인 장소만 표시 (적어도 한 명의 큐레이터가 추천)
        return place.curatorCount && place.curatorCount > 0;
      });
      console.log("🌍 일반 모드 - 공개 추천 필터링 적용:", filtered.length);
      return filtered;
    }
    
    // 큐레이터가 선택되지 않았으면
    if (selectedCurators.length === 0) {
      if (showAll) {
        // showAll이 true일 때만 모든 장소 표시
        console.log("🔍 선택된 큐레이터 없음 - showAll: true, 모든 장소 표시");
        return dbPlaces.filter(place => {
          // curatorCount가 1 이상인 장소만 표시 (적어도 한 명의 큐레이터가 추천)
          return place.curatorCount && place.curatorCount > 0;
        });
      } else {
        // showAll이 false이면 아무것도 표시 안함
        console.log("🔍 선택된 큐레이터 없음 - showAll: false, 아무것도 표시 안함");
        return [];
      }
    }
    
    // 선택된 큐레이터에 따라 필터링
    const filtered = dbPlaces.filter((place) => {
      // 해당 장소를 추천한 큐레이터 목록 확인 (username으로 필터링)
      const placeCuratorUsernames = place.curatorUsernames || [];
      
      console.log("🔍 장소 필터링 확인:", { 
        placeName: place.name, 
        placeCuratorUsernames, 
        selectedCurators,
        placeCurators: place.curators
      });
      
      // 선택된 큐레이터 중 한 명이라도 해당 장소를 추천했으면 표시
      const hasSelectedCurator = selectedCurators.some(selectedCurator => {
        return placeCuratorUsernames.some(curatorUsername => {
          console.log(`🔍 큐레이터 매칭 확인: ${selectedCurator} vs ${curatorUsername}`);
          return selectedCurator === curatorUsername;
        });
      });
      
      return hasSelectedCurator;
    });
    
    console.log("✅ 큐레이터 필터링 결과:", filtered.length, "개");
    return filtered;
  }, [showSavedOnly, showAll, selectedCurators, dbPlaces, user, isCurator]);

  // 외부 데이터를 저장할 상태 추가
  const [externalPlaces, setExternalPlaces] = useState([]);

  const displayedPlaces = useMemo(() => {
    if (!query.trim()) return filteredByCuratorPlaces;
    if (aiRecommendedIds.length === 0) return filteredByCuratorPlaces;

    const idSet = new Set(aiRecommendedIds.map(String));
    const idOrderMap = new Map(
      aiRecommendedIds.map((id, index) => [String(id), index])
    );

    // 외부 데이터에서 AI 추천 장소 찾기
    const externalRecommendedPlaces = externalPlaces
      .filter((place) => idSet.has(String(place.id)))
      .sort(
        (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
      );

    // 내부 데이터에서 AI 추천 장소 찾기
    const internalRecommendedPlaces = filteredByCuratorPlaces
      .filter((place) => idSet.has(String(place.id)))
      .sort(
        (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
      );

    // 네이버 장소는 AI 추천 ID가 없어도 무조건 표시 (ID가 'naver_'로 시작하는 경우)
    const naverPlaces = externalPlaces.filter((place) => 
      String(place.id).startsWith('naver_')
    );

    // 외부 데이터 우선, 내부 데이터 보조, 네이버 장소 추가
    const finalPlaces = [...externalRecommendedPlaces, ...internalRecommendedPlaces, ...naverPlaces];
    
    console.log("🔍 displayedPlaces 최종:", finalPlaces.length, finalPlaces);
    return finalPlaces;
  }, [filteredByCuratorPlaces, aiRecommendedIds, query, externalPlaces]);

  const mapDisplayedPlaces = useMemo(() => {
    if (!showSavedOnly) return displayedPlaces;

    // 별표 버튼을 누르면 모든 장소 표시 (큐레이터 기능)
    if (isCurator) {
      console.log("⭐ 큐레이터 저장 장소 모두 표시");
      return displayedPlaces.length > 0 ? displayedPlaces : allPlaces;
    }

    // 일반 유저: localStorage 저장 장소만 표시
    const savedSet = new Set(
      Object.entries(savedMap)
        .filter(([, folderIds]) => Array.isArray(folderIds) && folderIds.length > 0)
        .map(([placeId]) => String(placeId))
    );

    const base = displayedPlaces.length > 0 ? displayedPlaces : allPlaces;
    return base.filter((p) => savedSet.has(String(p.id)));
  }, [displayedPlaces, savedMap, showSavedOnly, isCurator, allPlaces]);

  const mapDisplayedPlacesWithLegend = useMemo(() => {
    // 별표 버튼(showSavedOnly)이 켜져 있으면 모든 장소 표시 (큐레이터 기능)
    if (showSavedOnly) {
      console.log("⭐ mapDisplayedPlacesWithLegend - 모든 장소 표시 (큐레이터용):", displayedPlaces.length);
      return [...displayedPlaces, ...kakaoPlaces]; // 카카오 장소 추가
    }
    
    // AI 검색 결과가 있을 때는 kakaoPlaces만 표시 (빨강 핀 마커만)
    if (aiRecommendedIds.length > 0 || query) {
      console.log("🔍 AI 검색 결과 - kakaoPlaces만 표시 (빨강 핀 마커만):", kakaoPlaces.length);
      return kakaoPlaces;
    }
    
    // 일반 모드에서는 비공개 필터링 적용
    const filtered = displayedPlaces.filter(place => {
      // 큐레이터는 자신의 장소와 공개 장소만 볼 수 있음
      if (isCurator) {
        return place.is_public !== false; // false가 아닌 것만 (공개 + undefined)
      }
      // 일반 사용자는 공개 장소만 볼 수 있음
      return place.is_public !== false;
    });
    console.log("🗺️ 일반 모드 - 지도에 표시될 장소 (비공개 필터링):", filtered.length);
    
    const result = [...filtered, ...kakaoPlaces]; // 카카오 장소 추가
    console.log("🗺️ mapDisplayedPlacesWithLegend 최종:", result.length, result);
    
    return result;
  }, [displayedPlaces, showSavedOnly, isCurator, kakaoPlaces, aiRecommendedIds, query]);

const topReasonMap = useMemo(() => {
  const map = {};
  aiReasons.forEach((item) => {
    if (item?.placeId && item?.reason) {
      map[item.placeId] = item.reason;
    }
  });
  return map;
}, [aiReasons]);

const handleClearSearch = () => {
  setQuery("");
  setSelectedPlace(null);
  setKakaoPlaces([]); // 카카오 장소들도 정리
  setAiError("");
  setAiSummary("");
  setAiReasons([]);
  setAiRecommendedIds([]);
  setAiSheetOpen(false);
  setIsAiSearching(false);
};

  // 카카오 장소 선택 핸들러 (마커 생성용)
  const handleKakaoPlaceSelect = (kakaoPlace) => {
    console.log('📍 카카오 장소 선택:', kakaoPlace);
    
    // 카카오 장소 데이터 형식 변환
    const formattedPlace = {
      id: `kakao_${kakaoPlace.id}`,
      name: kakaoPlace.place_name,
      address: kakaoPlace.road_address_name || kakaoPlace.address_name,
      lat: parseFloat(kakaoPlace.y),
      lng: parseFloat(kakaoPlace.x),
      category: kakaoPlace.category_name,
      phone: kakaoPlace.phone,
      kakao_place_id: kakaoPlace.id,
      isKakaoPlace: true,
      isLive: true,
      place_url: kakaoPlace.place_url, // 카카오맵 상세보기 URL
      category_name: kakaoPlace.category_name, // 커스텀 오버레이용
      road_address_name: kakaoPlace.road_address_name, // 커스텀 오버레이용
    };
    
    console.log('📍 마커 데이터:', formattedPlace);
    
    // kakaoPlaces에 추가
    setKakaoPlaces(prev => {
      const exists = prev.some(p => p.id === formattedPlace.id);
      if (!exists) {
        const newPlaces = [...prev, formattedPlace];
        console.log('📍 카카오 장소 추가 후:', newPlaces.length);
        
        // 마커 생성 후 해당 장소를 선택하여 카드 표시
        setTimeout(() => {
          if (mapRef.current && mapRef.current.zoomToPlaces) {
            mapRef.current.zoomToPlaces(allRecommendedPlaces);
          }
          setShowPlaceDetail(true);
        }, 500); // 마커가 생성될 시간을 주기 위해 약간의 지연
        
        return newPlaces;
      }
      return prev;
    });
  };

  // 쾌속 잔 채우기 핸들러 (커스텀 오버레이에서 호출)
  const handleQuickSave = (place) => {
    console.log('📍 쾌속 잔 채우기 요청:', place);
    
    // PlacePreviewCard의 로직과 동일하게 처리
    // localStorage에 저장하는 로직을 구현해야 함
    // 임시로 alert로 처리
    alert('쾌속 잔 채우기 기능은 개발 중입니다.');
  };

  const handleSearchSubmit = async (value) => {
    const nextQuery = value.trim();

    setQuery(nextQuery);
    
    // 검색 시작 시 모든 상태 초기화
    setIsLocationBasedSearch(false);
    setSelectedPlace(null);
    setAiError("");
    setAiSummary("");
    setAiReasons([]);
    setAiRecommendedIds([]);
    setAiSheetOpen(false);
    
    // 이전 검색 결과 강제 초기화
    setExternalPlaces([]);
    setKakaoPlaces([]);
    setBlogReviews([]);
    
    console.log('🧹 모든 검색 상태 초기화 완료');

    if (!nextQuery) return;

    try {
      setIsAiSearching(true);

      // 검색 모드에 따라 다르게 처리
      if (isLocationBasedSearch) {
        // 내 위치 중심 검색 (빨강 핀 클릭 후) - 위치 기반 검색
        console.log("🔍 내 위치 중심 검색 시작:", nextQuery);
        
        // 1. 현재 위치 파악
        const userLocation = await getCurrentUserLocation();
        console.log('📍 사용자 현재 위치:', userLocation);

        // 2. 카카오 지도에서 800m 이내 장소 검색 (위치 기반)
        const nearbyPlaces = await searchNearbyBars(nextQuery, userLocation);
        console.log('🍺 위치 기반 검색 결과:', nearbyPlaces);

        // 3. AI 스코어링 (모든 검색에 동일하게 적용)
        const scoredPlaces = calculateLocalAIScores(nearbyPlaces, nextQuery, userLocation);
        console.log('🎯 AI 최종 추천:', scoredPlaces);

        // 결과 설정
        setExternalPlaces(scoredPlaces);
        setAiSummary("주변 술집 AI 추천 목록");
        setAiReasons(["거리 기반 추천", "카테고리 매칭", "사용자 키워드 분석"]);
        setAiRecommendedIds(scoredPlaces.map(p => p.id));
        setBlogReviews([]);
        setAiSheetOpen(false); // 리스트 없이 바로 마커

        // 지도에 바로 마커 표시
        const kakaoFormattedPlaces = scoredPlaces.map(place => ({
          ...place,
          lat: parseFloat(place.y),
          lng: parseFloat(place.x),
          name: place.place_name,
          place_name: place.place_name,
          address_name: place.address_name || place.road_address_name,
          category_name: place.category_name,
          phone: place.phone || '',
          id: place.id,
          isExternal: true,
          isLive: true,
          kakao_place_id: place.id
        }));
        
        setKakaoPlaces(kakaoFormattedPlaces);
        
      } else {
        // 전체 지도 범용 검색 (바로 검색) - 미리보기 리스트 후 마커
        console.log("🔍 전체 지도 범용 검색 시작:", nextQuery);

        // 1. 키워드에서 지역명 추출 (언주역, 강남역, 동대문, 서울역, 삼성역, 성수역, 을지로 등)
        const locationPattern = /(\w+역|\w+동|\w+구|\w+대로|\w+로|\w+거리|\w+시장)/;
        const match = nextQuery.match(locationPattern);
        let locationName = match ? match[1] : null;
        
        // 특별 지역명 처리
        if (nextQuery.includes('동대문')) {
          locationName = '동대문';
        } else if (nextQuery.includes('성수')) {
          locationName = '성수';
        } else if (nextQuery.includes('강남')) {
          locationName = '강남';
        } else if (nextQuery.includes('삼성')) {
          locationName = '삼성';
        } else if (nextQuery.includes('서울')) {
          locationName = '서울';
        }
        
        console.log('🔍 추출된 지역명:', locationName);
        console.log('🔍 원본 검색어:', nextQuery);
        
        // 2. 검색어에서 실제 키워드 추출 (해장국, 카페, 식당 등)
        const businessPattern = /(\w+집|\w+당|\w+관|\w+점|\w+식|\w+당|\w+국|\w+면|\w+밥|\w+찌개|\w+탕|\w+전골|\w+카페|\w+빵|\w+케이크|\w+피자|\w+햄버거|\w+치킨|\w+파스타|\w+스테이크|\w+초밥|\w+돈까스|\w+라면|\w+김밥|\w+떡볶이|\w+순대|\w호떡|\w붕어빵|\w+타코|\w+샐러드|\w+스프|\w+커리|\w+짜장|\w+짬뽕|\w+볶음밥|\w+fried rice|\w+noodle|\w+soup|\w+cafe|\w+restaurant|\w+food|해장국|해장|순대국|부대찌개|김치찌개|된장찌개|갈비탕|삼계탕|뼈해장국|순두부|고등어|조개|꽁치|장어|회|초밥|돈까스|우동|라멘|국수|냉면|비빔국수|칼국수|잔치국수|만두|군만두|물만두|고기|불고기|갈비|삼겹살|목살|닭갈비|소갈비|돼지갈비|소고기|돼지고기|닭고기|생선|게|새우|게장|새우볶음|낙지|오징어|문어|전복|조개구이|고등어구이|갈치구이|꽁치구이|장어구이|닭구이|치킨|후라이드치킨|양념치킨|간장치킨|피자|파스타|스파게티|알리오올리오|봉골레|까르보나라|로제|토마토|크림|뇨끼|볶음밥|김치볶음밥|새우볶음밥|제육볶음|오징어볶음|낙지볶음|해물볶음|야채볶음|비빔밥|돌솥비빔밥|산채비빔밥|냉면|물냉면|비빔냉면|막국수|쫄면|칼국수|잔치국수|만두|군만두|물만두|고기|불고기|갈비|삼겹살|목살|닭갈비|소갈비|돼지갈비|소고기|돼지고기|닭고기|생선|게|새우|게장|새우볶음|낙지|오징어|문어|전복|조개구이|고등어구이|갈치구이|꽁치구이|장어구이|닭구이|치킨|후라이드치킨|양념치킨|간장치킨)/;
        const businessMatch = nextQuery.match(businessPattern);
        const businessKeyword = businessMatch ? businessMatch[1] : nextQuery.includes('해장') ? '해장국' : nextQuery.includes('술') || nextQuery.includes('바') || nextQuery.includes('포차') ? '술집' : '음식점';
        
        // 검색 키워드 결정
        let searchKeyword;
        if (locationName && businessKeyword) {
          searchKeyword = `${locationName} ${businessKeyword}`;
        } else if (locationName) {
          searchKeyword = locationName;
        } else if (businessKeyword) {
          searchKeyword = businessKeyword;
        } else {
          searchKeyword = nextQuery;
        }
        
        console.log('🔍 추출된 지역명:', locationName);
        console.log('🔍 추출된 업종 키워드:', businessKeyword);
        console.log('🔍 최종 검색 키워드:', searchKeyword);

        // 2. 지역명으로 지도 이동 및 줌인
        if (match && mapRef.current) {
          try {
            // 카카오 장소 검색으로 지역명 좌표 찾기
            const ps = new window.kakao.maps.services.Places();
            
            await new Promise((resolve) => {
              ps.keywordSearch(searchKeyword, (data, status) => {
                if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
                  const firstResult = data[0];
                  const targetLocation = new window.kakao.maps.LatLng(firstResult.y, firstResult.x);
                  
                  // 지도 이동 및 줌인
                  mapRef.current.moveToLocation(firstResult.y, firstResult.x);
                  mapRef.current.setZoomLevel(5); // 지역명 검색 시 더 좁은 범위
                  
                  console.log(`🗺️ ${searchKeyword}으로 지도 이동 및 줌인 완료`);
                }
                resolve(); // 항상 resolve 호출
              });
            });
            
            // 지도 이동 후 약간의 딜레이
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error('지역명 검색 실패:', error);
          }
        }

        // 3. 카카오 키워드 검색 (줌인된 지도 영역 기반)
        // 타이핑 시 자동완성과 동일한 검색어 사용
        const mapPlaces = await searchMapBars(nextQuery);
        console.log('🗺️ 전체 지도 검색 결과:', mapPlaces);

        // 4. AI 스코어링 (모든 검색에 동일하게 적용)
        const scoredPlaces = calculateLocalAIScores(mapPlaces, nextQuery, null);
        console.log('🎯 AI 최종 추천:', scoredPlaces);

        // 결과 설정 (미리보기 리스트 + 실시간 마커)
        setExternalPlaces(scoredPlaces);
        setAiSummary(`${searchKeyword} 검색 결과`);
        setAiReasons([`${searchKeyword} 지역 검색`, `지도 이동 및 줌인`]);
        setAiRecommendedIds([]); // AI 추천 결과 카드 없음
        setAiSheetOpen(false); // 엔터키 시 추천 목록 카드 사라짐

        // 네이버 블로그 검색
        const blogReviews = await searchBlogReviews(nextQuery);
        setBlogReviews(blogReviews);

        // 지도에도 실시간 마커 표시 + 지도 이동
        const kakaoFormattedPlaces = scoredPlaces.map(place => ({
          ...place,
          lat: parseFloat(place.y),
          lng: parseFloat(place.x),
          name: place.place_name,
          place_name: place.place_name,
          address_name: place.address_name || place.road_address_name,
          category_name: place.category_name,
          phone: place.phone || '',
          id: place.id,
          isExternal: true,
          isLive: true,
          isKakaoPlace: true, // 카카오 기본 빨간 핀 마커 사용
          kakao_place_id: place.id
        }));
        
        setKakaoPlaces(kakaoFormattedPlaces);
        
        // 검색 결과가 있으면 지도 이동
        if (kakaoFormattedPlaces.length > 0 && mapRef.current) {
          const firstPlace = kakaoFormattedPlaces[0];
          
          // 카카오 API 확인
          if (!window.kakao || !window.kakao.maps) {
            console.error('❌ 카카오 맵 API가 로드되지 않았습니다!');
            return;
          }
          
          console.log('✅ 카카오 맵 API 확인:', window.kakao.maps);
          console.log('🗺️ 지도 이동 시도:', firstPlace.name, firstPlace.lat, firstPlace.lng);
          console.log('🔍 네이버 연결 상태: 끊김 (블로그 리뷰 없음)');
          
          try {
            // 직접 좌표로 이동 테스트
            const targetPosition = new window.kakao.maps.LatLng(firstPlace.lat, firstPlace.lng);
            mapRef.current.panTo(targetPosition);
            
            // 지도 레벨 설정 (setLevel 사용)
            if (mapRef.current.setLevel) {
              mapRef.current.setLevel(1); // 모든 핀이 다 보이게 더 멀리서 보기
            }
            console.log(`🗺️ 검색 결과로 지도 이동 성공: ${firstPlace.name}`);
          } catch (error) {
            console.error('❌ 지도 이동 실패:', error);
            console.log('🔄 대체 시도: moveToLocation 사용');
            try {
              mapRef.current.moveToLocation(firstPlace.lat, firstPlace.lng);
              
              // 지도 레벨 설정 (setLevel 사용)
              if (mapRef.current.setLevel) {
                mapRef.current.setLevel(1); // 모든 핀이 다 보이게 더 멀리서 보기
              }
              console.log(`🗺️ 대체 이동 성공: ${firstPlace.name}`);
            } catch (error2) {
              console.error('❌ 대체 이동도 실패:', error2);
            }
          }
        } else {
          console.log('⚠️ 검색 결과가 없거나 맵 레퍼런스가 없습니다:', {
            hasPlaces: kakaoFormattedPlaces.length > 0,
            hasMapRef: !!mapRef.current,
            kakaoApi: !!window.kakao?.maps,
            firstPlace: kakaoFormattedPlaces.length > 0 ? kakaoFormattedPlaces[0] : null
          });
        }
      }

    } catch (error) {
      console.error("AI 검색 오류:", error);
      alert(error?.message || "AI 검색에 실패했습니다.");
    } finally {
      setIsAiSearching(false);
    }
  };

  console.log("🗺️ MapView에 전달되는 장소 데이터:", mapDisplayedPlacesWithLegend.length, mapDisplayedPlacesWithLegend);

  // 팔로우 모달 핸들러
  const handleFollow = async (curatorName) => {
    // 로그인 체크
    if (!user) {
      showToast("로그인이 필요합니다. 로그인 후 팔로우할 수 있습니다.", "error", 3000);
      return;
    }
    
    // 자기 자신은 팔로우할 수 없음 (큐레이터인 경우만)
    const myUsername = curatorProfile?.username;
    if (myUsername && curatorName === myUsername) {
      showToast("자기 자신은 팔로우할 수 없습니다.", "error", 3000);
      return;
    }
    
    try {
      // 큐레이터 정보 조회 (UUID ID를 얻기 위해)
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('id, username')
        .eq('username', curatorName)
        .single();
      
      if (curatorError || !curatorData) {
        console.error('큐레이터 정보 조회 실패:', curatorError);
        showToast('큐레이터 정보를 찾을 수 없습니다.', 'error', 3000);
        return;
      }
      
      // 팔로우 추가 (UUID ID로 저장)
      const { error: followError } = await supabase
        .from('user_follows')
        .insert({
          user_id: user.id,
          curator_id: curatorData.id, // UUID ID 저장
          created_at: new Date().toISOString()
        });
      
      if (followError) {
        console.error('팔로우 실패:', followError);
        
        // 23505 에러 (중복 팔로우) 처리
        if (followError.code === '23505' || followError.message?.includes('duplicate')) {
          showToast('이미 팔로우한 큐레이터입니다.', 'info', 3000);
        } else {
          showToast('팔로우에 실패했습니다.', 'error', 3000);
        }
        return;
      }
      
      showToast(`@${curatorName} 큐레이터를 팔로우했습니다!`, 'success', 3000);
      setShowFollowModal(false);
      
    } catch (error) {
      console.error('팔로우 처리 오류:', error);
      showToast('팔로우에 실패했습니다.', 'error', 3000);
    }
  };

  // 큐레이터 상세 정보 가져오기
  const fetchCuratorDetails = async (curatorName) => {
    try {
      console.log("🔍 큐레이터 상세 정보 조회:", curatorName);
      
      // curators 테이블에서 상세 정보 조회
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('*')
        .eq('username', curatorName)
        .maybeSingle(); // .single() 대신 .maybeSingle() 사용
      
      if (curatorError) {
        console.log("❌ 큐레이터 정보 조회 실패:", curatorError);
        return null;
      }
      
      if (!curatorData) {
        console.log("❌ 큐레이터 정보 없음:", curatorName);
        return null;
      }
      
      console.log("✅ 큐레이터 상세 정보:", curatorData);
      
      // curator_places 테이블에서 장소 수 조회
      const { data: placesData, error: placesError } = await supabase
        .from('curator_places')
        .select('id')
        .eq('curator_id', curatorData.id)
        .eq('is_archived', false);
      
      const placeCount = placesError ? 0 : (placesData?.length || 0);
      
      // user_follows 테이블에서 팔로워 수 조회
      const { data: followersData, error: followersError } = await supabase
        .from('user_follows')
        .select('id')
        .eq('curator_id', curatorData.id);
      
      const followerCount = followersError ? 0 : (followersData?.length || 0);
      
      return {
        ...curatorData,
        placeCount,
        followerCount,
        saveCount: 0 // 저장 수는 다른 테이블에서 조회 필요
      };
      
    } catch (error) {
      console.error("❌ 큐레이터 상세 정보 로드 실패:", error);
      return null;
    }
  };

  // 선택된 큐레이터 정보 업데이트
  useEffect(() => {
    if (selectedCurator && !selectedCurator.placeCount) {
      // 상세 정보가 없으면 가져오기
      const loadDetails = async () => {
        try {
          const details = await fetchCuratorDetails(selectedCurator.name);
          if (details) {
            setSelectedCurator(prev => ({
              ...prev,
              ...details
            }));
          }
        } catch (error) {
          console.error("❌ 큐레이터 상세 정보 로드 실패:", error);
        }
      };
      
      loadDetails();
    }
  }, [selectedCurator]);

  // 팔로우 모달에 표시할 큐레이터 정보
  const getModalCurator = () => {
    if (selectedCurator) {
      // 선택된 큐레이터 정보 사용 (실제 데이터)
      return {
        username: selectedCurator.username || selectedCurator.name,
        displayName: selectedCurator.displayName || selectedCurator.name,
        level: selectedCurator.grade || 2, // 실제 등급 또는 기본값
        saveCount: selectedCurator.saveCount || 0, // 실제 저장 수
        placeCount: selectedCurator.placeCount || 0, // 실제 장소 수
        followerCount: selectedCurator.followerCount || 0, // 실제 팔로워 수
        bio: selectedCurator.bio || "소개가 없습니다.",
        avatar: selectedCurator.avatar
      };
    }
    
    // 일반 사용자인 경우: 첫번째 큐레이터 표시
    if (!curatorProfile && dbCurators.length > 0) {
      const firstCurator = dbCurators[0];
      return {
        username: firstCurator.name,
        displayName: firstCurator.displayName || firstCurator.name,
        level: 2, // Local Curator
        saveCount: 60,
        placeCount: 9,
        followerCount: 123,
        bio: "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요."
      };
    }
    
    // 큐레이터인 경우: 자기 자신 표시 (팔로우 불가)
    return {
      username: curatorProfile?.username || "nopokiller",
      displayName: curatorProfile?.displayName || "노포킬러",
      level: 2, // Local Curator
      saveCount: 60,
      placeCount: 9,
      followerCount: 123,
      bio: curatorProfile?.bio || "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요."
    };
  };

  const testCurator = getModalCurator();

  return (
    <>
      {/* 실시간 Toast 알림 */}
      <AnimatedToast position="top-right" />
      
      {/* 실시간 체크인 랭킹 */}
      <CheckinRanking position="sidebar" />
      
      {/* 팔로우 모달 */}
      {showFollowModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowFollowModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "25px",
              minWidth: "300px",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 큐레이터 프로필 정보 */}
            <div style={{ marginBottom: "20px" }}>
              {/* 프로필 이미지와 이름 */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                {testCurator.avatar ? (
                  <img
                    src={testCurator.avatar}
                    alt={testCurator.displayName}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #2ECC71"
                    }}
                  />
                ) : (
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: "#2ECC71",
                    color: "white",
                    fontSize: "18px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #2ECC71"
                  }}>
                    {testCurator.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "#333", fontWeight: "bold" }}>
                    @{testCurator.username}
                  </h3>
                  <div style={{ 
                    fontSize: "14px", 
                    color: "666",
                    fontWeight: "500"
                  }}>
                    {testCurator.level >= 4 ? "👑 Top Curator" : 
                     testCurator.level >= 3 ? "🏆 Trusted Curator" : 
                     testCurator.level >= 2 ? "⭐ Local Curator" : "🌱 New Drinker"}
                  </div>
                </div>
              </div>
              
              {/* 자기 소개글 */}
              <div style={{ 
                fontSize: "14px", 
                color: "#555",
                lineHeight: "1.5",
                marginBottom: "16px",
                padding: "12px",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
              }}>
                "{testCurator.bio}"
              </div>
              
              {/* 통계 정보 */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)", 
                gap: "12px",
                marginBottom: "20px"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#E74C3C" }}>
                    {testCurator.saveCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    저장수
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#F39C12" }}>
                    {testCurator.placeCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    추천 장소
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#9B59B6" }}>
                    {testCurator.followerCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    팔로워
                  </div>
                </div>
              </div>
            </div>
            
            {/* 팔로우 버튼 */}
            <div>
              {testCurator.username === curatorProfile?.username ? (
                <div
                  style={{
                    width: "100%",
                    padding: "16px",
                    backgroundColor: "#e9ecef",
                    color: "#6c757d",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    textAlign: "center",
                    cursor: "not-allowed"
                  }}
                >
                  자기 자신은 팔로우할 수 없습니다
                </div>
              ) : (
                <button
                  style={{
                    width: "100%",
                    padding: "16px",
                    backgroundColor: "#2ECC71",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 12px rgba(46, 204, 113, 0.3)"
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#27AE60";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(46, 204, 113, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#2ECC71";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(46, 204, 113, 0.3)";
                  }}
                  onClick={() => handleFollow(testCurator.username)}
                >
                  팔로우하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={styles.page}>
      <main style={styles.mainContainer}>
        {/* 실시간 체크인 토스트 - 지도 좌측 */}
        <div style={{ 
          position: 'absolute', 
          top: '80px', // 헤더 높이만큼 아래로
          left: '20px', // 좌측에 붙임
          transform: 'none', // 중앙 정렬 제거
          zIndex: 1000, // 헤더보다 낮게
          pointerEvents: 'none'
        }}>
          <CheckInToast />
        </div>

        <MapView
          ref={mapRef}
          places={mapDisplayedPlacesWithLegend}
          selectedPlace={selectedPlace}
          setSelectedPlace={handlePlaceSelect} // 지연 로딩 핸들러로 변경
          curatorColorMap={curatorColorMap}
          savedColorMap={savedColorMap}
          livePlaceIds={livePlaceIds}
          userFolders={userSavedPlaces} // 사용자 폴더 정보 전달
          onQuickSave={handleQuickSave} // 쾌속 잔 채우기 핸들러 전달
          userRole={getUserRole?.()} // 사용자 역할 전달
          onSave={setSaveTargetPlace} // 일반 사용자 저장 핸들러 전달
          savedFolders={savedColorMap} // 저장된 폴더 정보 전달
          userSavedPlaces={userSavedPlaces} // 사용자 저장 장소 정보 전달
        />

        <div style={styles.headerOverlay}>
          <div style={styles.logoStack}>
            <h1 style={styles.logo}>JUDO</h1>
          </div>

          <div style={styles.filterWrapper}>
            <CuratorFilterBar
              curators={dbCurators}
              selectedCurators={selectedCurators}
              allActive={showAll}
              onToggle={(name) => {
                console.log("🔘 CuratorFilterBar onToggle 호출:", name);
                console.log("🔍 현재 selectedCurators:", selectedCurators);
                console.log("🔍 prev.includes(name):", selectedCurators.includes(name));
                
                setShowSavedOnly(false);
                setSelectedCurators((prev) => {
                  // undefined 제거
                  const cleanPrev = prev.filter(item => item !== undefined);
                  const next = cleanPrev.includes(name)
                    ? cleanPrev.filter((c) => c !== name)
                    : [...cleanPrev, name];
                  console.log("🔄 selectedCurators 변경:", { prev: cleanPrev, next });

                  // 큐레이터를 선택하면 showAll을 false로 설정
                  if (next.length > 0) {
                    console.log("🎯 showAll을 false로 설정");
                    setShowAll(false);
                  } else {
                    // 모든 큐레이터가 해제되면 showAll도 false로 설정 (아무것도 선택되지 않은 상태)
                    console.log("🎯 showAll을 false로 설정 (모두 해제 - 아무것도 선택되지 않음)");
                    setShowAll(false);
                  }
                  return next;
                });
              }}
              onSelectAll={() => {
                setShowSavedOnly(false);
                setSelectedCurators([]);
                setShowAll(prev => !prev); // 토글 기능
                console.log("🌍 전체 선택 버튼 토글 - showAll:", !showAll);
              }}
              onProfileClick={(curator) => {
                console.log("👤 큐레이터 프로필 클릭:", curator);
                // 선택된 큐레이터 정보 설정하고 모달 표시
                setSelectedCurator(curator);
                setShowFollowModal(true);
              }}
            />
          </div>
        </div>

        <div style={styles.legendOverlay}>
          <MarkerLegend
            savedOnly={showSavedOnly}
            onToggleSavedOnly={() => {
              setShowSavedOnly((prev) => {
                const next = !prev;
                if (next) {
                  if (selectedPlace && !isPlaceSaved(selectedPlace.id)) {
                    setSelectedPlace(null);
                  }
                }
                return next;
              });
            }}
            activeCategory={legendCategory}
            closeSignal={selectedPlace}
            onSelectCategory={(key) => {
              setLegendCategory((prev) => (prev === key ? null : key));
              if (selectedPlace) setSelectedPlace(null);
            }}
          />
        </div>

        {!selectedPlace ? (
          <div style={styles.bottomBarContainer}>
            <div style={styles.searchWrapper}>
              <SearchBar
                query={query}
                setQuery={setQuery}
                onSubmit={handleSearchSubmit}
                onClear={handleClearSearch}
                onExampleClick={handleSearchSubmit}
                placeholder="AI 검색: 동대문 근처 고기 먹고 해산물 포차 갈까? 3명이야..."
                isLoading={isAiSearching}
                mapRef={mapRef}
                showKakaoSearch={true}
                onKakaoPlaceSelect={handleKakaoPlaceSelect}
                onRealTimeSearch={(value) => {
                  // AI 실시간 검색 기능 추가
                  if (value.trim()) {
                    console.log('🤖 AI 실시간 검색:', value);
                    // 여기에 AI 검색 로직 추가
                  }
                }}
                onLocationModeChange={(isLocationBased) => {
                  setIsLocationBasedSearch(isLocationBased);
                  console.log('🔍 위치기반 검색 모드:', isLocationBased);
                }}
                rightActions={
                  <div style={styles.authRowInline}>
                    {/* 모든 사용자 @아이디 버튼 */}
                    {!authLoading && user && (
                      <button
                        style={
                          getUserRole() === "admin" 
                            ? styles.adminInlineButton 
                            : getUserRole() === "curator"
                              ? styles.curatorInlineButton 
                              : styles.userInlineButton
                        }
                        onClick={() => {
                          const userRole = getUserRole();
                          console.log(" @아이디 버튼 클릭:", { userRole, isAdmin, isCurator, username: getDisplayUsername() });
                          
                          if (userRole === "admin") {
                            // Admin은 큐레이터 신청내역 페이지로 이동
                            navigate("/admin/applications");
                          } else if (userRole === "curator") {
                            // 큐레이터는 스튜디오 페이지로 이동
                            navigate("/studio");
                          } else {
                            // 일반 사용자는 UserCard 표시
                            setShowUserCard(true);
                          }
                        }}
                        type="button"
                      >
                        @{getDisplayUsername()}
                      </button>
                    )}
                    
                    {/* 일반 유저에게만 큐레이터 신청 버튼 표시 */}
                    {!authLoading && user && getUserRole() === "user" && (
                      <CuratorApplicationButton />
                    )}
                    
                    {authLoading ? null : user ? (
                      <button
                        type="button"
                        style={styles.authInlineButton}
                        onClick={() => {
                          signOut().catch((error) => {
                            console.error("signOut error:", error);
                            alert(error?.message || "로그아웃에 실패했습니다.");
                          });
                        }}
                      >
                        로그아웃
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          style={{
                            ...styles.authIconButton,
                            ...styles.googleButton,
                          }}
                          onClick={() => {
                            signInWithProvider("google").catch((error) => {
                              console.error("google login error:", error);
                              alert(error?.message || "구글 로그인에 실패했습니다.");
                            });
                          }}
                          aria-label="Google 로그인"
                          title="Google 로그인"
                        >
                          <span style={styles.googleG}>G</span>
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.authIconButton,
                            ...styles.kakaoButton,
                          }}
                          onClick={() => {
                            signInWithProvider("kakao").catch((error) => {
                              console.error("kakao login error:", error);
                              alert(error?.message || "카카오 로그인에 실패했습니다.");
                            });
                          }}
                          aria-label="Kakao 로그인"
                          title="Kakao 로그인"
                        >
                          <span style={styles.kakaoK}>K</span>
                        </button>
                      </>
                    )}
                  </div>
                }
              />
            </div>
          </div>
        ) : null}

        <div
          style={{
            ...styles.mapCardOverlay,
            bottom: selectedPlace ? "18px" : styles.mapCardOverlay.bottom,
          }}
        >
          {selectedPlace ? (
            <div style={styles.previewStack}>
              {topReasonMap[selectedPlace.id] ? (
                <div style={styles.reasonChip}>
                  AI 추천 이유 · {topReasonMap[selectedPlace.id]}
                </div>
              ) : null}

              <PlacePreviewCard
                place={selectedPlace}
                isSaved={isPlaceSaved(selectedPlace.id)}
                savedFolderColor={savedColorMap[selectedPlace.id]}
                onSave={setSaveTargetPlace}
                onClose={() => setSelectedPlace(null)}
                getUserRole={getUserRole}
              />
            </div>
          ) : aiRecommendedIds.length > 0 ? (
            <>
              <button
                type="button"
                style={{
                  ...styles.aiPeekBar,
                  opacity: isAiSearching ? 0.92 : 1,
                }}
                onClick={() => {
  // 카드는 닫지 않고 지도에 마커만 추가
  // 현재 displayedPlaces를 지도 마커로 변환
  if (displayedPlaces.length > 0) {
    const kakaoFormattedPlaces = displayedPlaces.map(place => ({
      ...place,
      lat: parseFloat(place.y || place.lat),
      lng: parseFloat(place.x || place.lng),
      name: place.name || place.place_name,
      place_name: place.place_name,
      address_name: place.address_name || place.road_address_name,
      category_name: place.category_name,
      phone: place.phone || '',
      id: place.id,
      isExternal: true,
      isLive: true,
      kakao_place_id: place.id
    }));
    
    console.log('🗺️ 카드 결과를 지도 마커로 변환:', kakaoFormattedPlaces);
    setKakaoPlaces(kakaoFormattedPlaces);
  }
}}
              >
                <div style={styles.aiPeekLeft}>
                  <span style={styles.aiPeekBadge}>AI</span>

                  <div style={styles.aiPeekTextWrap}>
                    <div style={styles.aiPeekTitle}>
                      {isAiSearching
                        ? "추천 리스트 준비 중"
                        : aiError
                        ? "추천 결과를 불러오지 못했어요"
                        : `추천 결과 ${displayedPlaces.length}곳`}
                    </div>

                    <div
                      style={{
                        ...styles.aiPeekSubtitle,
                        ...(aiError ? styles.aiPeekSubtitleError : {}),
                      }}
                    >
                      {isAiSearching
                        ? `AI가 후보를 정리하고 있어요${loadingDots}`
                        : aiError
                        ? "잠시 후 다시 시도해 주세요"
                        : aiSummary || "눌러서 리스트 보기"}
                    </div>
                  </div>
                </div>

                <span style={styles.aiPeekArrow}>{aiSheetOpen ? "▾" : "▴"}</span>
              </button>

              {aiSheetOpen ? (
                <div style={styles.aiBottomSheet}>
                  <div style={styles.aiSheetHandleWrap}>
                    <div style={styles.aiSheetHandle} />
                  </div>

                  <div style={styles.aiSheetList}>
                    {displayedPlaces.map((place, index) => (
                      <button
                        key={place.id}
                        type="button"
                        style={styles.aiSheetItem}
                        onClick={() => {
                          handlePlaceSelect(place);
                          setAiSheetOpen(false);
                        }}
                      >
                        <div style={styles.aiSheetItemTop}>
                          <div style={styles.aiSheetRank}>{index + 1}</div>

                          <div style={styles.aiSheetMain}>
                            <div style={styles.aiSheetNameRow}>
                              <span style={styles.aiSheetName}>{place.name || place.place_name || '알 수 없는 장소'}</span>
                            </div>

                            <div style={styles.aiSheetMeta}>
                              {place.address || place.address_name || '주소 정보 없음'}
                            </div>

                            {topReasonMap[place.id] ? (
                              <div style={styles.aiSheetReason}>
                                {topReasonMap[place.id]}
                              </div>
                            ) : null}

                            <div style={styles.aiSheetTags}>
                              {(place.tags || []).slice(0, 4).map((tag) => (
                                <span key={tag} style={styles.aiSheetTag}>
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 네이버 블로그 리뷰 섹션 */}
              {blogReviews.length > 0 && (
                <div style={{
                  marginTop: "16px",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "12px",
                  borderTop: "1px solid #e9ecef"
                }}>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#495057",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span>📝</span>
                    네이버 블로그 실제 리뷰 ({blogReviews.length}개)
                  </div>
                  <div style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    {blogReviews.slice(0, 3).map((review, index) => (
                      <div key={index} style={{
                        padding: "8px",
                        backgroundColor: "white",
                        borderRadius: "8px",
                        border: "1px solid #e9ecef"
                      }}>
                        <div style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color: "#e74c3c",
                          marginBottom: "4px"
                        }}>
                          {review.place_name}
                        </div>
                        <div style={{
                          fontSize: "11px",
                          color: "#666",
                          lineHeight: "1.4",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}>
                          {review.content && review.content !== "내용 추출 실패" 
                            ? review.content.length > 100 
                              ? review.content.substring(0, 100) + "..."
                              : review.content
                            : "리뷰 내용을 불러오지 못했습니다."
                          }
                        </div>
                        {review.publish_date && review.publish_date !== "작성일 없음" && (
                          <div style={{
                            fontSize: "10px",
                            color: "#999",
                            marginTop: "4px"
                          }}>
                            {review.publish_date}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {blogReviews.length > 3 && (
                    <div style={{
                      fontSize: "11px",
                      color: "#999",
                      textAlign: "center",
                      marginTop: "8px"
                    }}>
                      외 {blogReviews.length - 3}개의 리뷰 더보기
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>


      <SavedPlaces
        open={savedPlacesOpen}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onClose={() => setSavedPlacesOpen(false)}
        getUserRole={getUserRole}
      />

      <AddPlaceForm
        open={addPlaceOpen}
        curators={dbCurators}
        onClose={() => setAddPlaceOpen(false)}
        onAdded={refreshCustomPlaces}
      />

      <SaveFolderModal
        open={!!saveTargetPlace}
        place={saveTargetPlace}
        folders={folders}
        savedFolderIds={
          saveTargetPlace ? getPlaceFolderIds(saveTargetPlace.id) : []
        }
        onClose={() => {
          setSaveTargetPlace(null);
          // 저장 완료 후 폴더 정보 다시 로드
          loadUserSavedPlaces();
        }}
        onFoldersUpdated={() => {
          refreshStorage();
          // 폴더 업데이트 후 폴더 정보 다시 로드
          loadUserSavedPlaces();
        }}
        onSaveToFolder={(pId, fId) => {
          savePlaceToFolder(pId, fId);
          refreshStorage();
        }}
      />

      {/* UserCard - 일반 사용자용 */}
      <UserCard
        user={user}
        isVisible={showUserCard}
        onClose={() => setShowUserCard(false)}
      />

    </div>
      </>
  );
}

const glassWhiteStrong = "rgba(255, 255, 255, 0.9)";
const glassBorder = "1px solid rgba(255, 255, 255, 0.55)";
const floatingShadow = "0 10px 30px rgba(0, 0, 0, 0.16)";

const styles = {
  page: {
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "#000",
  },

  mainContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
  },

  headerOverlay: {
    position: "absolute",
    top: "16px",
    left: "16px",
    right: "16px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    zIndex: 50,
  },

  logoStack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    flexShrink: 0,
  },

  logo: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 900,
    letterSpacing: "-1.5px",
    color: "#111",
    lineHeight: 1,
    flexShrink: 0,
  },

  filterWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    overflowX: "auto",
    msOverflowStyle: "none",
    scrollbarWidth: "none",
    WebkitMaskImage:
      "linear-gradient(to right, transparent, black 0%, black 95%, transparent)",
  },

  legendOverlay: {
    position: "absolute",
    top: "64px",
    right: "16px",
    zIndex: 45,
  },

  bottomBarContainer: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "18px",
    width: "90%",
    maxWidth: "600px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    zIndex: 100,
  },

  searchWrapper: {
    flex: 1,
    minHeight: "54px",
    borderRadius: "18px",
    background: "transparent",
    overflow: "visible",
  },

  authRowInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  authInlineButton: {
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(17, 17, 17, 0.74)",
    color: "#ffffff",
    borderRadius: "999px",
    height: "34px",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    pointerEvents: "auto",
  },

  authIconButton: {
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "none",
    fontSize: "14px",
    fontWeight: 1000,
    padding: 0,
  },

  googleButton: {
    backgroundColor: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(0,0,0,0.12)",
  },

  kakaoButton: {
    backgroundColor: "#FEE500",
    border: "1px solid rgba(0,0,0,0.12)",
  },

  googleG: {
    color: "#4285F4",
    fontWeight: 1000,
    lineHeight: 1,
  },

  kakaoK: {
    color: "#111111",
    fontWeight: 1000,
    lineHeight: 1,
  },

  curatorFloatingWrap: {
    position: "absolute",
    right: "16px",
    bottom: "200px", // 내 위치 아이콘보다 아래
    zIndex: 10050,
  },

  curatorFloatingBtn: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "20px",
    border: glassBorder,
    background: "rgba(46, 204, 113, 0.9)", // 초록색
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "0 12px",
    transition: "all 0.2s ease",
  },

  curatorFloatingText: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "11px",
  },

  curatorApplyBtn: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "20px",
    border: glassBorder,
    background: "rgba(46, 204, 113, 0.9)", // 초록색
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "0 12px",
    transition: "all 0.2s ease",
  },

  locationBtn: {
    width: "54px",
    height: "54px",
    flexShrink: 0,
    borderRadius: "18px",
    border: glassBorder,
    background: glassWhiteStrong,
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  userInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(52, 152, 219, 0.3)",
    background: "rgba(52, 152, 219, 0.15)",
    color: "#3498DB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  curatorInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(46, 204, 113, 0.3)",
    background: "rgba(46, 204, 113, 0.15)",
    color: "#2ECC71",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  adminInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(255, 107, 107, 0.3)",
    background: "rgba(255, 107, 107, 0.15)",
    color: "#FF6B6B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  sideFabContainer: {
    position: "absolute",
    right: "16px",
    bottom: "88px",
    zIndex: 95,
  },

  fabAdd: {
    height: "46px",
    padding: "0 16px",
    borderRadius: "23px",
    border: "1px solid rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.88)",
    color: "#111",
    fontWeight: 700,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  fabPlus: {
    fontSize: "18px",
    lineHeight: 1,
    marginTop: "-1px",
  },

  aiStatusBox: {
    position: "absolute",
    left: "16px",
    right: "16px",
    bottom: "82px",
    zIndex: 72,
    padding: "12px 14px",
    borderRadius: "18px",
    background: "rgba(17,17,17,0.82)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  aiStatusInner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  aiSpinner: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    border: "2px solid rgba(255,255,255,0.24)",
    borderTop: "2px solid #34D17A",
    flexShrink: 0,
    animation: "judoSpin 0.9s linear infinite",
  },

  aiStatusTextWrap: {
    minWidth: 0,
    flex: 1,
  },

  aiStatusTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#fff",
  },

  aiStatusSubtext: {
    marginTop: "3px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 1.4,
  },

  aiStatusError: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#ffb4b4",
    lineHeight: 1.4,
  },

  mapCardOverlay: {
    position: "absolute",
    left: "16px",
    right: "16px",
    bottom: "100px", 
    zIndex: 40,
    pointerEvents: "none",
  },

  previewStack: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    pointerEvents: "none",
  },

  reasonChip: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(17,17,17,0.78)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
  },

  aiPeekBar: {
    width: "100%",
    border: "none",
    borderRadius: "18px",
    padding: "14px 16px",
    background: "rgba(17,17,17,0.82)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    pointerEvents: "auto",
    cursor: "pointer",
  },

  aiPeekLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },

  aiPeekBadge: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#34D17A",
    color: "#111",
    fontWeight: 900,
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  aiPeekTextWrap: {
    minWidth: 0,
    textAlign: "left",
  },

  aiPeekTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#fff",
  },

  aiPeekSubtitle: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.78)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "220px",
  },

  aiPeekSubtitleError: {
    color: "#ffb4b4",
  },

  aiPeekArrow: {

aiBottomSheet: {
    marginTop: "10px",
    width: "100%",
    maxHeight: "24vh",
    borderRadius: "24px 24px 0 0",
    background: "rgba(255,255,255,0.85)",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    overflow: "hidden",
    pointerEvents: "auto", 
    position: "relative", 
    zIndex: 100, 
  },

aiSheetHandleWrap: {
display: "flex",
justifyContent: "center",
paddingTop: "10px",
},
  },

  aiSheetHandle: {
    width: "42px",
    height: "5px",
    borderRadius: "999px",
    background: "rgba(17,17,17,0.18)",
  },

  aiSheetHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 16px 12px",
    borderBottom: "1px solid rgba(17,17,17,0.06)",
  },

  aiSheetTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#111",
  },

  aiSheetDesc: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#666",
    lineHeight: 1.4,
  },

  aiSheetCloseBtn: {
    border: "none",
    background: "rgba(17,17,17,0.06)",
    color: "#111",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  aiSheetCloseBtadminChip: {
    border: "1px solid rgba(0,0,0,0.10)",
    backgroundColor: "rgba(255,255,255,0.86)",
    color: "#111",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  studioChip: {
    border: "1px solid rgba(255,107,107,0.30)",
    backgroundColor: "rgba(255,107,107,0.15)",
    color: "#FF6B6B",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  aiSheetList: {
    maxHeight: "28vh", 
    overflowY: "auto",
    padding: "8px 12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    pointerEvents: "auto", 
  },

  aiSheetItem: {
    width: "100%",
    border: "1px solid rgba(17,17,17,0.06)",
    borderRadius: "24px", 
    background: "rgba(255,255,255,0.9)",
    padding: "8px 12px", 
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)", 
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },

  aiSheetItemTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },

  aiSheetRank: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#111",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  aiSheetMain: {
    minWidth: 0,
    flex: 1,
  },

  aiSheetNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  aiSheetName: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#111",
  },

  aiSavedDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    flexShrink: 0,
  },

  aiSheetMeta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#777",
  },

  aiSheetReason: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#222",
    lineHeight: 1.45,
  },

  aiSheetTags: {
    marginTop: "10px",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },

  aiSheetTag: {
    fontSize: "11px",
    color: "#555",
    background: "rgba(17,17,17,0.05)",
    borderRadius: "999px",
    padding: "6px 9px",
  },
};