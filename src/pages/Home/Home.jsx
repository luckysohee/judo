import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const { user, loading: authLoading, signInWithProvider, signOut } = useAuth();

  const devAdminUserId = import.meta.env.VITE_ADMIN_USER_ID;

  const [isAdmin, setIsAdmin] = useState(false);
  const [isCurator, setIsCurator] = useState(false);
  const curatorWelcomeRef = useRef(false); // 큐레이터 상태 변화 감지용 ref
  const [curatorProfile, setCuratorProfile] = useState(null); // 큐레이터 프로필 정보
  const [dbCurators, setDbCurators] = useState([]); // DB에서 가져온 큐레이터 목록
  const [dbPlaces, setDbPlaces] = useState([]); // DB에서 가져온 장소 목록

  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [detailPlace, setDetailPlace] = useState(null);
  const [showFollowModal, setShowFollowModal] = useState(false); // 팔로우 모달 상태
  const [selectedCurator, setSelectedCurator] = useState(null); // 선택된 큐레이터 정보
  const [saveTargetPlace, setSaveTargetPlace] = useState(null);
  const [folders, setFolders] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [customPlaces, setCustomPlaces] = useState([]); // 더미 데이터 제거
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [selectedCurators, setSelectedCurators] = useState([]);
  const [showAll, setShowAll] = useState(true); // 기본값을 true로 변경

  const [aiSummary, setAiSummary] = useState("");
  const [aiReasons, setAiReasons] = useState([]);
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [loadingDots, setLoadingDots] = useState(".");

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
      } else {
        setCuratorProfile(null);
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
        console.log("✅ 큐레이터 목록 로드:", formattedCurators.length, "개");
        console.log("📝 큐레이터 데이터:", formattedCurators); // 추가
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
            places (*)
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
        
        data.forEach(curatorPlace => {
          const place = curatorPlace.places;
          if (!place) return;
          
          const key = `${place.lat}_${place.lng}`; // 위치 기반 중복 체크
          
          if (placeMap.has(key)) {
            // 중복 장소: 큐레이터 수 증가
            const existing = placeMap.get(key);
            existing.curatorCount = (existing.curatorCount || 0) + 1;
            existing.curators.push(curatorPlace.curator_id);
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
        const formattedPlaces = Array.from(placeMap.values()).map(place => ({
          id: place.id,
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          category: place.category || "미분류",
          curatorCount: place.curatorCount, // 큐레이터 수
          curators: place.curators, // 큐레이터 목록
          curatorPlaces: place.curatorPlaces, // 추천 정보
          comment: "",
          savedCount: 0,
          tags: [],
        }));
        
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

  // 페이지 로드 시 selectedCurators 초기화
  useEffect(() => {
    console.log("🔄 페이지 로드 - selectedCurators 초기화");
    setSelectedCurators([]);
    setShowAll(true);
    
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
      // 해당 장소를 추천한 큐레이터 목록 확인
      const placeCurators = place.curators || [];
      
      console.log("🔍 장소 필터링 확인:", { 
        placeName: place.name, 
        placeCurators, 
        selectedCurators 
      });
      
      // 선택된 큐레이터 중 한 명이라도 해당 장소를 추천했으면 표시
      const hasSelectedCurator = selectedCurators.some(selectedCurator => {
        // placeCurators 배열의 각 curatorId를 확인
        return placeCurators.some(curatorId => {
          // curatorId를 username으로 매핑
          let curatorUsername = null;
          
          // 기존 하드코딩 매핑 (user_id 기준)
          if (curatorId === '8cd3b6dd-42de-4bce-9867-0a395ddfd390') {
            curatorUsername = 'solodrinker';
          } else if (curatorId === '2fba03a4-5a6d-43e2-a7d8-7c78fa8df752') {
            curatorUsername = 'humblefetish';
          } else {
            // dbCurators에서 username으로 찾기
            const curator = dbCurators.find(c => c.id === curatorId);
            curatorUsername = curator ? curator.username : null;
          }
          
          console.log("🔍 큐레이터 매핑:", { 
            curatorId, 
            curatorUsername, 
            selectedCurator,
            match: curatorUsername === selectedCurator
          });
          
          return curatorUsername === selectedCurator;
        });
      });
      
      return hasSelectedCurator;
    });
    
    console.log("✅ 큐레이터 필터링 결과:", filtered.length, "개");
    return filtered;
  }, [showSavedOnly, showAll, selectedCurators, dbPlaces, user, isCurator]);

  const displayedPlaces = useMemo(() => {
    if (!query.trim()) return filteredByCuratorPlaces;
    if (aiRecommendedIds.length === 0) return filteredByCuratorPlaces;

    const idSet = new Set(aiRecommendedIds.map(String));
    const idOrderMap = new Map(
      aiRecommendedIds.map((id, index) => [String(id), index])
    );

    return filteredByCuratorPlaces
      .filter((place) => idSet.has(String(place.id)))
      .sort(
        (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
      );
  }, [filteredByCuratorPlaces, aiRecommendedIds, query]);

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
      return [...displayedPlaces]; // 모든 장소 표시
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
    
    const savedSet = new Set(
      Object.entries(savedMap)
        .filter(([, folderIds]) => Array.isArray(folderIds) && folderIds.length > 0)
        .map(([placeId]) => String(placeId))
    );

    const aiBasePlaces = (() => {
      if (!query.trim()) return allPlaces;
      if (aiRecommendedIds.length === 0) return allPlaces;

      const idSet = new Set(aiRecommendedIds.map(String));
      const idOrderMap = new Map(
        aiRecommendedIds.map((id, index) => [String(id), index])
      );

      return allPlaces
        .filter((place) => idSet.has(String(place.id)))
        .sort(
          (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
        );
    })();

    const baseBeforeLegend = legendCategory ? aiBasePlaces : displayedPlaces;

    const afterSavedOnly = showSavedOnly
      ? (baseBeforeLegend.length > 0 ? baseBeforeLegend : allPlaces).filter((p) =>
          savedSet.has(String(p.id))
        )
      : filtered; // 일반 모드에서는 비공개 필터링된 데이터 사용

    if (!legendCategory) return afterSavedOnly;

    if (legendCategory === "saved") {
      return (afterSavedOnly.length > 0 ? afterSavedOnly : allPlaces).filter((p) =>
        savedSet.has(String(p.id))
      );
    }

    return afterSavedOnly.filter((p) => {
      const count = Array.isArray(p?.curators) ? p.curators.length : 1;
      if (legendCategory === "premium") return count >= 3;
      if (legendCategory === "hot") return count === 2;
      return count <= 1;
    });
  }, [aiRecommendedIds, allPlaces, displayedPlaces, legendCategory, query, savedMap, showSavedOnly]);

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
    setDetailPlace(null);
    setAiError("");
    setAiSummary("");
    setAiReasons([]);
    setAiRecommendedIds([]);
    setAiSheetOpen(false);
    setIsAiSearching(false);
  };

  const handleSearchSubmit = async (value) => {
    const nextQuery = value.trim();

    setQuery(nextQuery);
    setSelectedPlace(null);
    setAiError("");
    setAiSummary("");
    setAiReasons([]);
    setAiRecommendedIds([]);
    setAiSheetOpen(false);

    if (!nextQuery) return;

    try {
      setIsAiSearching(true);

      const response = await fetch(`${AI_API_BASE_URL}/api/ai-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: nextQuery,
          places: filteredByCuratorPlaces.map((place) => ({
            ...place,
            aiText: [
              place.name,
              place.region,
              place.address,
              place.primaryCurator,
              ...(place.curators || []),
              ...(place.tags || []),
              place.comment,
              place.savedCount ? `저장 ${place.savedCount}` : "",
            ]
              .filter(Boolean)
              .join(" | "),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "AI 검색에 실패했습니다.");
      }

      setAiSummary(data.summary || "");
      setAiReasons(Array.isArray(data.reasons) ? data.reasons : []);
      setAiRecommendedIds(
        Array.isArray(data.recommendedPlaceIds) ? data.recommendedPlaceIds : []
      );
      setAiSheetOpen(true);
    } catch (error) {
      console.error(error);
      setAiError(error.message || "AI 검색 중 오류가 발생했습니다.");
    } finally {
      setIsAiSearching(false);
    }
  };

  console.log("🗺️ MapView에 전달되는 장소 데이터:", mapDisplayedPlacesWithLegend.length, mapDisplayedPlacesWithLegend);

  // 팔로우 모달 핸들러
  const handleFollow = (curatorName) => {
    // 자기 자신은 팔로우할 수 없음 (큐레이터인 경우만)
    const myUsername = curatorProfile?.username;
    if (myUsername && curatorName === myUsername) {
      alert("자기 자신은 팔로우할 수 없습니다.");
      return;
    }
    
    // TODO: 팔로우 기능 구현
    alert(`@${curatorName} 큐레이터를 팔로우했습니다!`);
    setShowFollowModal(false);
  };

  // 팔로우 모달에 표시할 큐레이터 정보
  const getModalCurator = () => {
    if (selectedCurator) {
      // 선택된 큐레이터 정보 사용
      return {
        username: selectedCurator.name,
        displayName: selectedCurator.displayName || selectedCurator.name,
        level: 2, // Local Curator (임시)
        saveCount: 60, // 임시 데이터
        placeCount: 9, // 임시 데이터
        followerCount: 123, // 임시 데이터
        bio: selectedCurator.bio || "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요.",
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
                  ⭐ 팔로우하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={styles.page}>
      <main style={styles.mainContainer}>
        <MapView
          ref={mapRef}
          places={mapDisplayedPlacesWithLegend}
          selectedPlace={selectedPlace}
          setSelectedPlace={setSelectedPlace}
          curatorColorMap={curatorColorMap}
          savedColorMap={savedColorMap}
          livePlaceIds={livePlaceIds}
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
                    setDetailPlace(null);
                  }
                }
                return next;
              });
            }}
            activeCategory={legendCategory}
            closeSignal={selectedPlace || detailPlace}
            onSelectCategory={(key) => {
              setLegendCategory((prev) => (prev === key ? null : key));
              if (selectedPlace) setSelectedPlace(null);
              if (detailPlace) setDetailPlace(null);
            }}
          />
        </div>

        {!selectedPlace && !detailPlace ? (
          <div style={styles.bottomBarContainer}>
            <div style={styles.searchWrapper}>
              <SearchBar
                query={query}
                setQuery={setQuery}
                onSubmit={handleSearchSubmit}
                onClear={handleClearSearch}
                onExampleClick={handleSearchSubmit}
                placeholder="AI에게 물어보세요. 예: 을지로 조용한 노포 2차"
                isLoading={isAiSearching}
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

        {(isAiSearching || aiError || aiSummary) && (
          <div style={styles.aiStatusBox}>
            <div style={styles.aiStatusInner}>
              {isAiSearching ? (
                <>
                  <div style={styles.aiSpinner} />
                  <div style={styles.aiStatusTextWrap}>
                    <div style={styles.aiStatusTitle}>
                      AI가 분위기 맞는 곳 찾는 중{loadingDots}
                    </div>
                    <div style={styles.aiStatusSubtext}>
                      지역, 분위기, 술 종류, 1차/2차 느낌까지 보고 있어요
                    </div>
                  </div>
                </>
              ) : aiError ? (
                <div style={styles.aiStatusTextWrap}>
                  <div style={styles.aiStatusTitle}>AI 검색 오류</div>
                  <div style={styles.aiStatusError}>{aiError}</div>
                </div>
              ) : (
                <div style={styles.aiStatusTextWrap}>
                  <div style={styles.aiStatusTitle}>AI 해석 완료</div>
                  <div style={styles.aiStatusSubtext}>{aiSummary}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            ...styles.mapCardOverlay,
            bottom: selectedPlace || detailPlace ? "18px" : styles.mapCardOverlay.bottom,
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
                onOpenDetail={setDetailPlace}
                onClose={() => setSelectedPlace(null)}
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
                onClick={() => setAiSheetOpen((prev) => !prev)}
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

                  <div style={styles.aiSheetHeader}>
                    <div>
                      <div style={styles.aiSheetTitle}>AI 추천 리스트</div>
                      <div style={styles.aiSheetDesc}>
                        {aiSummary || "분위기와 조건에 맞는 후보예요."}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={styles.aiSheetCloseBtn}
                      onClick={() => setAiSheetOpen(false)}
                    >
                      닫기
                    </button>
                  </div>

                  <div style={styles.aiSheetList}>
                    {displayedPlaces.map((place, index) => (
                      <button
                        key={place.id}
                        type="button"
                        style={styles.aiSheetItem}
                        onClick={() => {
                          setSelectedPlace(place);
                          setAiSheetOpen(false);
                        }}
                      >
                        <div style={styles.aiSheetItemTop}>
                          <div style={styles.aiSheetRank}>{index + 1}</div>

                          <div style={styles.aiSheetMain}>
                            <div style={styles.aiSheetNameRow}>
                              <span style={styles.aiSheetName}>{place.name}</span>
                              {savedColorMap[place.id] ? (
                                <span
                                  style={{
                                    ...styles.aiSavedDot,
                                    backgroundColor: savedColorMap[place.id],
                                  }}
                                />
                              ) : null}
                            </div>

                            <div style={styles.aiSheetMeta}>
                              {[place.region || place.area, place.address]
                                .filter(Boolean)
                                .join(" · ")}
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
            </>
          ) : null}
        </div>
      </main>

      <PlaceDetail
        place={detailPlace}
        isSaved={detailPlace ? isPlaceSaved(detailPlace.id) : false}
        onClose={() => setDetailPlace(null)}
        onSave={setSaveTargetPlace}
      />

      <SavedPlaces
        open={savedPlacesOpen}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onClose={() => setSavedPlacesOpen(false)}
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
        onClose={() => setSaveTargetPlace(null)}
        onFoldersUpdated={refreshStorage}
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
    left: "16px",
    right: "16px",
    bottom: "18px",
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
    bottom: "150px",
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
    fontSize: "18px",
    color: "#fff",
    flexShrink: 0,
  },

  aiBottomSheet: {
    marginTop: "10px",
    width: "100%",
    maxHeight: "48vh",
    borderRadius: "24px 24px 0 0",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    overflow: "hidden",
    pointerEvents: "auto",
  },

  aiSheetHandleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "10px",
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
    maxHeight: "36vh",
    overflowY: "auto",
    padding: "8px 12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  aiSheetItem: {
    width: "100%",
    border: "1px solid rgba(17,17,17,0.06)",
    borderRadius: "18px",
    background: "#fff",
    padding: "14px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
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