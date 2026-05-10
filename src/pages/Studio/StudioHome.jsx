import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadCuratorProfileAvatarFile } from "../../utils/curatorPlacePhotos";
import { isAcceptableRasterImageFile } from "../../utils/prepareImageFileForUpload";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/Toast/ToastProvider";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
import { isUsernameChangeCooldownError } from "../../utils/usernameCooldown";
import { normalizeStudioPlaceCategory } from "../../utils/placeTaxonomy.js";
import { fetchCuratorPlacesMergedWithPlaces } from "../../utils/supabasePlaces";
import { readStudioDrafts, writeStudioDrafts } from "../../utils/studioDraftsLocal";
import { placePickJoinRowToDetailPlace } from "../../utils/placePickRowDisplay";
import PlaceDetail from "../../components/PlaceDetail/PlaceDetail";
import StudioPicksSection from "./components/StudioPicksSection";
import StudioDraftsSection from "./components/StudioDraftsSection";
import StudioArchiveSection from "./components/StudioArchiveSection";
import StudioListSection from "./components/StudioListSection";
import StudioAddPlaceSection from "./components/StudioAddPlaceSection";
import StudioTopChrome from "./components/StudioTopChrome";
import LiveStartConfirmModal from "./components/LiveStartConfirmModal";
import { isPlaceSaved } from "../../utils/storage";
import {
  devLog,
  dedupeCuratorPlacesByPlaceId,
  mapCuratorJoinRowsToMyPlaces,
  persistCuratorProfileImageToSupabase,
} from "./studioHomeModule.js";
import { useStudioUnreadFollowerToast } from "./hooks/useStudioUnreadFollowerToast";
import { useStudioPlacePicks } from "./hooks/useStudioPlacePicks";
import { useStudioSavedFolders } from "./hooks/useStudioSavedFolders";
import { useStudioCuratorStats } from "./hooks/useStudioCuratorStats";
import { useStudioPlaceActions } from "./hooks/useStudioPlaceActions";
import { useStudioAddPlaceForm } from "./hooks/useStudioAddPlaceForm";

export default function StudioHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth(); // 인증된 사용자 정보 가져오기
  const { showToast } = useToast(); // Toast 훅 추가
  const mapRef = useRef(null); // 지도 ref 다시 추가
  /** 잔 리스트에서 「수정」으로 잔 올리기 탭에 올 때는 탭 전환 useEffect가 폼·editingPlaceId를 지우지 않도록 함 */
  const skipAddSectionResetRef = useRef(false);
  /** deleteOwnCustomSystemFolder 힌트용 curators PK — 프로필 state보다 위에서 폴더 훅을 두므로 매 렌더 동기화 */
  const curatorRowIdForFoldersRef = useRef(null);
  /** 잔 아카이브 프로필 박스 — 보기 모드에서 사진만 바로 저장 */
  /** 프로필 수정 모드에서만 사용 — 원 밖 「사진 올리기」 */
  const profileEditAvatarFileRef = useRef(null);

  // 상태 관리
  const [activeSection, setActiveSection] = useState("archive"); // archive, add, list, drafts, picks
  const [myPlaces, setMyPlaces] = useState([]); // 잔 리스트 상태 - 실제 데이터만 사용
  const [loading, setLoading] = useState(true);
  const [isCurator, setIsCurator] = useState(false); // 큐레이터 여부
  const [filterType, setFilterType] = useState("all"); // 잔 리스트: all | public | private
  const [listSearchQuery, setListSearchQuery] = useState(""); // 잔 리스트 탭 내 검색어

  /** 스튜디오「잔 픽」— `place_picks` 만 (curator_places 와 무관) */
  const [studioPickDetailPlace, setStudioPickDetailPlace] = useState(null);

  // 변경사항 감지 상태
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previousSection, setPreviousSection] = useState("archive");
  const [originalPlaceBeforeChange, setOriginalPlaceBeforeChange] = useState(null); // 변경 전 원본 데이터 저장
  
  // DB 저장 함수
  const saveToDatabase = async (updatedPlace) => {
    try {
      if (!user?.id) {
        alert("로그인이 필요합니다.");
        return;
      }
      devLog("💾 curator_places 테이블 업데이트 시도:", updatedPlace.id);
      
      // is_public을 is_archived로 변환 (true=공개=false=archived, false=비공개=true=archived)
      const isArchived = !updatedPlace.is_public;
      
      // curator_places: curator_id = curators.user_id (= auth uid) 만 본인 행 갱신
      const { error } = await supabase
        .from("curator_places")
        .update({ is_archived: isArchived })
        .eq("place_id", updatedPlace.id)
        .eq("curator_id", user.id);
      
      if (error) {
        console.error("❌ curator_places 저장 오류:", error);
        alert("저장에 실패했습니다: " + error.message);
      } else {
        devLog("✅ curator_places 저장 성공:", { placeId: updatedPlace.id, is_archived: isArchived });
        alert("공개/비공개 상태가 저장되었습니다!");
      }
    } catch (error) {
      console.error("❌ 저장 중 오류:", error);
      alert("저장에 실패했습니다: " + error.message);
    }
  };
  
  // 섹션 변경 감지 및 저장 확인
  useEffect(() => {
    const handleSectionChange = async () => {
      if (activeSection !== previousSection && hasUnsavedChanges) {
        const shouldSave = window.confirm("공개/비공개 상태 변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음");
        
        if (shouldSave) {
          devLog("✅ 저장 선택 - DB 저장 시작");
          // 실제 DB 저장 로직
          if (originalPlaceBeforeChange) {
            const updatedPlace = myPlaces.find(p => p.id === originalPlaceBeforeChange.id);
            if (updatedPlace) {
              await saveToDatabase(updatedPlace);
              devLog("✅ 저장 완료 - 상태 초기화");
            }
          }
        } else {
          devLog("❌ 저장 안 함 선택 - 원상복구");
          // 변경사항 취소하고 원래 상태로 복원
          if (originalPlaceBeforeChange) {
            setMyPlaces(prevPlaces => 
              prevPlaces.map(place => 
                place.id === originalPlaceBeforeChange.id 
                  ? { ...place, is_public: originalPlaceBeforeChange.is_public }
                  : place
              )
            );
            devLog("🔄 원상복구 완료:", originalPlaceBeforeChange);
          }
        }
        
        setHasUnsavedChanges(false);
        setOriginalPlaceBeforeChange(null);
      }
      
      setPreviousSection(activeSection);
    };
    
    handleSectionChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- myPlaces/saveToDatabase 넣으면 저장 플로우 중 무한 재실행 위험
  }, [activeSection, hasUnsavedChanges, previousSection, originalPlaceBeforeChange]);
  
  // 지도 크기 새로고침
  useEffect(() => {
    if (mapRef.current && activeSection === "add") {
      const timer = setTimeout(() => {
        if (mapRef.current) {
          // 카카오맵이 로드된 경우 강제로 리사이즈
          if (window.kakao && window.kakao.maps) {
            try {
              window.kakao.maps.event.trigger(mapRef.current, 'resize');
            } catch (error) {
              devLog("지도 리사이즈 실패:", error);
            }
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [activeSection]); // activeSection이 변경될 때만 실행

  // 잔 올리기 폼 상태
  const [formData, setFormData] = useState({
    name_address: "",
    category: "",
    alcohol_type: "",
    atmosphere: "",
    recommended_menu: "",
    menu_reason: "",
    tags: [],
    latitude: null,
    longitude: null,
    kakao_place_id: null,
    is_public: true
  });

  /** 잔 올리기: 저장 시 함께 올릴 사진 (큐레이터 전용 탭이라 동일 권한) */
  const [addPlacePhotoFiles, setAddPlacePhotoFiles] = useState([]);
  /** 잔 올리기: 내 저장 폴더 (카카오 저장과 동일 테이블 — 1개 이상 필수) */
  const [addPlaceSelectedFolders, setAddPlaceSelectedFolders] = useState([]);
  const [addPlaceShowNewFolder, setAddPlaceShowNewFolder] = useState(false);
  const [addPlaceNewFolderName, setAddPlaceNewFolderName] = useState("");
  const [addPlaceNewFolderSaving, setAddPlaceNewFolderSaving] = useState(false);

  // 수정 모드 상태
  const [editingPlaceId, setEditingPlaceId] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null); // 수정 중인 임시저장 ID

  const {
    savedByFolder,
    savedFoldersLoadError,
    savedFoldersLoading,
    savedFolderKey,
    setSavedFolderKey,
    savedShowNewFolder,
    setSavedShowNewFolder,
    savedNewFolderName,
    setSavedNewFolderName,
    savedFolderSaving,
    savedFoldersEditMode,
    setSavedFoldersEditMode,
    savedFolderMetaDeletingKey,
    savedFolderEditName,
    setSavedFolderEditName,
    savedFolderEditColor,
    setSavedFolderEditColor,
    savedFolderEditIcon,
    setSavedFolderEditIcon,
    savedFolderMetaSaving,
    savedFoldersListExpanded,
    setSavedFoldersListExpanded,
    loadSavedFolders,
    sortedSavedFolders,
    hasDeletableSavedFolders,
    handleDeleteSavedFolder,
    handleSaveSavedFolderMeta,
    savedFolderPlaceIdSet,
    insertCustomSystemFolderRow,
    persistUserSavedPlaceFolders,
    handleAddSavedFolder,
  } = useStudioSavedFolders({
    user,
    activeSection,
    setMyPlaces,
    setAddPlaceSelectedFolders,
    getCuratorRowId: () => curatorRowIdForFoldersRef.current,
  });

  const {
    searchSuggestions,
    setSearchSuggestions,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    tagInputValue,
    setTagInputValue,
    showAllTags,
    setShowAllTags,
    tagSuggestions,
    setTagSuggestions,
    frequentTags,
    allTags,
    allTagsList,
    fetchSuggestions,
    handleInputChange,
    handleSuggestionClick,
    handleKeyDown,
    handleSearch,
    removeTag,
    handleTagInputChange,
    handleTagSuggestionClick,
    toggleAddPlaceFolder,
    handleAddPlaceCustomFolder,
  } = useStudioAddPlaceForm({
    formData,
    setFormData,
    mapRef,
    setMapCenter,
    setSearchedPlaces,
    setAddPlaceSelectedFolders,
    addPlaceNewFolderName,
    setAddPlaceNewFolderName,
    setAddPlaceNewFolderSaving,
    setAddPlaceShowNewFolder,
    insertCustomSystemFolderRow,
  });

  // 탭 변경 시 폼 초기화 (잔 리스트→수정→잔 올리기 시에는 건너뜀 — 아니면 editingPlaceId가 지워져 신규 INSERT로 중복 저장됨)
  useEffect(() => {
    if (activeSection !== "add") return;
    if (skipAddSectionResetRef.current) {
      skipAddSectionResetRef.current = false;
      return;
    }
    if (editingPlaceId) return;
    setFormData({
      name_address: "",
      category: "",
      alcohol_type: "",
      atmosphere: "",
      recommended_menu: "",
      menu_reason: "",
      tags: [],
      latitude: null,
      longitude: null,
      kakao_place_id: null,
      is_public: true,
    });
    setAddPlacePhotoFiles([]);

    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setSearchedPlaces([]);
    setMapCenter({ lat: 37.5665, lng: 126.9780 });
    setEditingPlaceId(null);
    try {
      localStorage.removeItem("editing_place_id");
    } catch {
      /* ignore */
    }
  }, [
    activeSection,
    editingPlaceId,
    setSearchSuggestions,
    setShowSuggestions,
    setSelectedSuggestionIndex,
  ]);

  // 잔 채우기 (임시저장) 상태 - 실제 장소 데이터 사용
  const [drafts, setDrafts] = useState([]);

  // 검색 결과 상태
  const [searchedPlaces, setSearchedPlaces] = useState([]);

  // 지도 중심 상태
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 }); // 서울시청

  // 지도 기본 장소 (초기 표시용)
  const [defaultPlaces] = useState([
    {
      id: "default1",
      name: "서울시청",
      address: "서울특별시 중구 태평로1가",
      latitude: 37.5665,
      longitude: 126.9780,
      category: "관공서",
      is_public: true,
      created_at: new Date().toISOString().split('T')[0]
    }
  ]);


  // 잔 아카이브 상태
  const [stats, setStats] = useState({
    followerCount: 0,
    savedByFollowers: 0,
    totalPlaces: 0,
    overlappingPlaces: 0,
    isLive: false,
    notificationSent: false
  });
  /** 네이티브 confirm 대신 — ×·배경·Esc 로 취소 */
  const [liveStartConfirmOpen, setLiveStartConfirmOpen] = useState(false);

  // 큐레이터 프로필 수정 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfile, setEditProfile] = useState({
    name: "",
    username: "",
    displayName: "",
    bio: "",
    instagram: "",
    image: null
  });
  const [usernameError, setUsernameError] = useState("");

  // 큐레이터 프로필 상태
  const [curatorProfile, setCuratorProfile] = useState({
    name: "노포킬러", // 검색용 표시 이름
    username: "nopokiller", // @고유이름 (개인 주소)
    displayName: "노포킬러", // 홈에서 표시될 이름
    bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
    instagram: "", // 인스타그램 연동
    grade: "bronze", // 등급: bronze, silver, gold, platinum, diamond
    status: "active", // 상태: active, warning, suspended, inactive
    total_places: 0, // 등록 장소 수
    total_likes: 0, // 총 좋아요 수
    warning_count: 0, // 경고 횟수
    created_at: new Date().toISOString(), // 큐레이터 시작일
    username_changed_at: null,
  });
  curatorRowIdForFoldersRef.current = curatorProfile?.id ?? null;

  useStudioUnreadFollowerToast({ user, showToast });

  const {
    curatorStats,
    archiveExtInsights,
    archiveInsightsError,
    overlapSharedPlacesList,
    showOverlapPlacesList,
    setShowOverlapPlacesList,
    loadCuratorStats,
  } = useStudioCuratorStats({
    user,
    myPlacesLength: myPlaces.length,
    curatorProfileId: curatorProfile?.id ?? null,
    activeSection,
  });

  const {
    handleAddPlace,
    handleEditPlace,
    handleDeletePlace,
    handleTogglePublic,
  } = useStudioPlaceActions({
    user,
    showToast,
    formData,
    setFormData,
    editingDraftId,
    setEditingDraftId,
    editingPlaceId,
    setEditingPlaceId,
    skipAddSectionResetRef,
    myPlaces,
    setMyPlaces,
    setDrafts,
    addPlaceSelectedFolders,
    setAddPlaceSelectedFolders,
    addPlacePhotoFiles,
    setAddPlacePhotoFiles,
    setAddPlaceShowNewFolder,
    setAddPlaceNewFolderName,
    setSearchedPlaces,
    setMapCenter,
    setActiveSection,
    setHasUnsavedChanges,
    setOriginalPlaceBeforeChange,
    loadCuratorStats,
    loadSavedFolders,
    persistUserSavedPlaceFolders,
  });

  useEffect(() => {
    if (authLoading) return;
    loadStudioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auth/user만 반응, loadStudioData deps 넣으면 반복 호출
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (location.state?.openStudioList) {
      setActiveSection("list");
      navigate("/studio", { replace: true, state: {} });
    }
  }, [location.state?.openStudioList, navigate]);


  const loadCuratorActivity = async (userId) => {
    try {
      // 등록된 장소 수 (연결 테이블 통해 조회)
      const { data: placeCuratorsData, error: placesError } = await supabase
        .from("curator_places")
        .select("place_id")
        .eq("curator_id", userId);

      if (placesError) {
        console.error("places load error:", placesError);
        return;
      }
      
      const totalPlaces = placeCuratorsData?.length || 0;
      const totalLikes = 0; // likes 필드가 없으므로 0
      
      // 큐레이터 테이블 업데이트
      await supabase
        .from("curators")
        .update({ 
          total_places: totalPlaces,
          total_likes: totalLikes,
          last_activity_at: new Date().toISOString()
        })
        .eq("user_id", userId);
      
      // 로컬 상태 업데이트
      setCuratorProfile(prev => ({
        ...prev,
        total_places: totalPlaces,
        total_likes: totalLikes
      }));
    } catch (error) {
      console.error("activity load error:", error);
    }
  };

  const loadStudioData = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        devLog("인증된 사용자 없음, 기본 프로필 사용");
        // 인증되지 않은 경우 기본값 사용
        const defaultUser = {
          username: "nopokiller",
          display_name: "노포킬러",
          bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
          image: null
        };
        
        setCuratorProfile(prev => ({
          ...prev,
          username: defaultUser.username,
          displayName: defaultUser.display_name,
          bio: defaultUser.bio,
          image: defaultUser.image
        }));
      } else {
        devLog("✅ 인증된 사용자:", user.id);
        
        // 인증된 사용자의 프로필 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from("curators")
          .select("*")
          .eq("user_id", user.id) // user_id로 연결
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
          devLog("프로필 데이터 없음, 기본값 사용:", profileError);
        }
        
        // 큐레이터 여부 확인
        const isUserCurator = profileData && !profileError;
        setIsCurator(isUserCurator);
        devLog("🎭 큐레이터 여부:", isUserCurator);
        
        const currentUser = profileData || {
          user_id: user.id, // 인증된 사용자 ID 연결
          slug: user.user_metadata?.username || user.email?.split('@')[0],
          username: user.user_metadata?.username || user.email?.split('@')[0],
          name: user.user_metadata?.display_name || "큐레이터",
          display_name: user.user_metadata?.display_name || "큐레이터",
          bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
          image: null,
          grade: "bronze",
          status: "active",
          total_places: 0,
          total_likes: 0,
          warning_count: 0
        };

        devLog("📂 프로필 데이터 로드:", currentUser);
        
        setCuratorProfile(prev => ({
          ...prev,
          id: currentUser.id, // ID 필드 추가
          user_id: currentUser.user_id || user.id,
          username:
            String(currentUser.slug || currentUser.username || "").trim(),
          displayName:
            String(
              currentUser.name ||
                currentUser.display_name ||
                currentUser.slug ||
                currentUser.username ||
                ""
            ).trim() || "큐레이터",
          bio: currentUser.bio,
          image:
            currentUser.avatar_url ??
            currentUser.avatar ??
            currentUser.image ??
            null,
          grade: currentUser.grade || "bronze",
          status: currentUser.status || "active",
          total_places: currentUser.total_places || 0,
          total_likes: currentUser.total_likes || 0,
          warning_count: currentUser.warning_count || 0,
          created_at: currentUser.created_at || prev.created_at,
          username_changed_at: currentUser.username_changed_at ?? null,
        }));

        await loadCuratorActivity(user.id);
      }
      
      devLog("📂 스튜디오 데이터 로딩 시작...");
      devLog("🔍 현재 사용자 ID:", user?.id);

      if (!user?.id) {
        setMyPlaces([]);
        const savedDraftsGuest = readStudioDrafts(null);
        setDrafts(savedDraftsGuest);
        setLoading(false);
        return;
      }
      
      // curator_places.curator_id = auth.uid() (= curators.user_id)
      // 임베드 places(*) 대신 병합 로드 — jsonb tags 등으로 임베드가 비는 행이 있어도 리스트에 포함
      let curatorPlacesRaw = [];
      let placesError = null;
      try {
        curatorPlacesRaw = await fetchCuratorPlacesMergedWithPlaces(
          supabase,
          user.id
        );
      } catch (e) {
        placesError = e;
      }

      const curatorPlacesData = dedupeCuratorPlacesByPlaceId(
        curatorPlacesRaw
      );

      // 장소 데이터 추출
      const placesData = curatorPlacesData?.map(cp => cp.places).filter(Boolean) || [];

      devLog("🔍 큐레이터 추천 쿼리 결과:", { data: curatorPlacesData, error: placesError });

      // 만약 데이터가 없다면, 기존 방식으로도 확인
      if (!placesData || placesData.length === 0) {
        devLog("⚠️ 다대다 방식으로 장소 없음, 기존 방식으로 확인 중...");
        
        // 기존 방식으로도 확인 (user_id 필드가 아직 있는 경우)
        const { data: oldWayData, error: _oldWayError } = await supabase
          .from("places")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (oldWayData && oldWayData.length > 0) {
          devLog("✅ 기존 방식으로 장소 발견:", oldWayData.length, "개");
          
          // 기존 방식으로 데이터 변환
          const formattedPlaces = oldWayData.map((place) => ({
            id: place.id,
            name: place.name,
            address: place.address || place.name,
            latitude: place.lat,
            longitude: place.lng,
            category:
              normalizeStudioPlaceCategory(place.category || "") || "미분류",
            alcohol_type: place.alcohol_type || "",
            atmosphere: place.atmosphere || "",
            recommended_menu: place.recommended_menu || "",
            menu_reason: place.menu_reason || "",
            tags: place.tags || [],
            is_public: place.is_public,
            created_at: place.created_at ? new Date(place.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          }));
          
          setMyPlaces(formattedPlaces);
          devLog("✅ myPlaces 업데이트 완료 (기존 방식):", formattedPlaces);
          setLoading(false);
          return;
        }
        
        // 완전히 없는 경우
        devLog("🔍 모든 장소 확인 중...");
        const { data: allPlaces, error: _allPlacesError } = await supabase
          .from("places")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        
        devLog("🔍 모든 장소 데이터:", allPlaces);
        devLog("🔍 모든 장소 user_id:", allPlaces?.map(p => ({ id: p.id, name: p.name, user_id: p.user_id })));
      }

      if (placesError) {
        console.error("❌ 장소 로딩 오류:", placesError);
      } else {
        devLog("✅ 불러온 장소 데이터:", placesData);
        
        const formattedPlaces =
          mapCuratorJoinRowsToMyPlaces(curatorPlacesData);
        
        setMyPlaces(formattedPlaces);
        devLog("✅ myPlaces 업데이트 완료:", formattedPlaces);
        
        // drafts는 별도로 관리 (myPlaces와 동기화하지 않음)
        // 임시저장된 데이터만 drafts에 표시됨
        
        // localStorage에서 임시저장된 데이터 불러오기
        const savedDrafts = readStudioDrafts(user.id);
        setDrafts(savedDrafts);
        devLog("📝 localStorage에서 임시저장 데이터 불러옴:", savedDrafts.length, "개");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("❌ Studio data loading error:", error);
      setLoading(false);
    }
  };

  const { studioPlacePicks, studioPlacePicksLoading } = useStudioPlacePicks({
    user,
    activeSection,
  });

  useEffect(() => {
    if (!user?.id || !editingPlaceId) return;
    let cancelled = false;
    (async () => {
      const { data: curRow } = await supabase
        .from("curators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const curPk = curRow?.id ?? null;
      let req = supabase
        .from("user_saved_places")
        .select(`id, user_saved_place_folders ( folder_key )`)
        .eq("place_id", editingPlaceId);
      if (curPk && String(curPk) !== String(user.id)) {
        req = req.or(`user_id.eq.${user.id},user_id.eq.${curPk}`);
      } else {
        req = req.eq("user_id", user.id);
      }
      const { data: rows, error } = await req;
      if (cancelled) return;
      if (error || !rows?.length) {
        setAddPlaceSelectedFolders([]);
        return;
      }
      const keySet = new Set();
      for (const row of rows) {
        for (const l of row.user_saved_place_folders || []) {
          if (l.folder_key) keySet.add(l.folder_key);
        }
      }
      setAddPlaceSelectedFolders([...keySet]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, editingPlaceId]);

  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setEditProfile({
      name: curatorProfile.displayName || curatorProfile.username,
      username: curatorProfile.username,
      displayName: curatorProfile.displayName,
      bio: curatorProfile.bio || "",
      image: curatorProfile.image || ""
    });
    setUsernameError("");
  };

  const handleSaveProfile = async () => {
    try {
      if (!user?.id) {
        alert("로그인이 필요합니다.");
        return;
      }
      
      // username 중복 확인
      if (editProfile.username !== curatorProfile.username) {
        // 실제로는 서버 API 호출로 중복 확인
        devLog("username 중복 확인 필요:", editProfile.username);
      }
      
      // Supabase에 프로필 저장 (인증된 사용자와 연결)
      const profileData = {
        user_id: user.id, // 인증된 사용자 ID 연결
        username: editProfile.username,
        slug: editProfile.username, // slug 필드 추가
        name: editProfile.displayName || editProfile.username, // name 필드 추가 (displayName 우선)
        display_name: editProfile.displayName,
        bio: editProfile.bio,
        image: editProfile.image || null,
        updated_at: new Date().toISOString()
      };
      
      devLog("📝 프로필 DB 저장:", profileData);
      
      const { data, error } = await supabase
        .from("curators")
        .upsert([profileData], { onConflict: 'user_id' }) // user_id 기준으로 upsert
        .select("username_changed_at");
        
      if (error) {
        console.error("❌ 프로필 저장 오류:", error);
        if (isUsernameChangeCooldownError(error)) {
          alert(
            error.message ||
              "핸들(@고유이름)은 14일에 한 번만 바꿀 수 있습니다."
          );
        } else {
          alert("프로필 저장에 실패했습니다: " + error.message);
        }
        return;
      }
      
      devLog("✅ 프로필 DB 저장 성공:", data);
      
      // 로컬 상태 업데이트
      setCuratorProfile(prev => ({
        ...prev,
        name: editProfile.displayName || editProfile.username,
        username: editProfile.username,
        displayName: editProfile.displayName,
        bio: editProfile.bio,
        image: editProfile.image,
        username_changed_at:
          data?.[0]?.username_changed_at ?? prev.username_changed_at,
      }));
      
      setIsEditingProfile(false);
      setUsernameError("");
      devLog("프로필 업데이트 완료:", editProfile);
      alert("프로필이 성공적으로 저장되었습니다!");
      
    } catch (error) {
      console.error("❌ 프로필 저장 오류:", error);
      alert("프로필 저장에 실패했습니다: " + error.message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditProfile({
      name: "",
      username: "",
      displayName: "",
      bio: "",
      image: ""
    });
    setUsernameError("");
  };

  const validateUsername = (username) => {
    // 영문 소문자, 숫자, 언더스코어만 허용
    const usernameRegex = /^[a-z0-9_]+$/;
    return usernameRegex.test(username);
  };

  const handleUsernameChange = (value) => {
    const cleanUsername = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setEditProfile(prev => ({ ...prev, username: cleanUsername }));
    
    // 유효성 검사
    if (cleanUsername && !validateUsername(cleanUsername)) {
      setUsernameError("영문 소문자, 숫자, 언더스코어만 사용 가능합니다.");
    } else if (cleanUsername && cleanUsername.length < 3) {
      setUsernameError("최소 3자 이상 입력해주세요.");
    } else if (cleanUsername && cleanUsername.length > 20) {
      setUsernameError("최대 20자까지 가능합니다.");
    } else {
      setUsernameError("");
    }
  };

  const generateUsername = (name) => {
    // 이름에서 username 생성 (한글 제거, 영문만, 소문자, 언더스코어)
    const baseName = name.toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '') // 특수문자 제거
      .replace(/\s+/g, '_') // 공백을 언더스코어로
      .slice(0, 10); // 최대 10자
    
    // 랜덤 숫자 추가
    const randomNum = Math.floor(Math.random() * 1000);
    return `${baseName}_${randomNum}`;
  };

  const handleUpdateUsername = () => {
    // 자동으로 username 생성
    const base =
      curatorProfile.displayName ||
      curatorProfile.username ||
      curatorProfile.name ||
      "curator";
    const newUsername = generateUsername(base);
    setEditProfile(prev => ({ ...prev, username: newUsername }));
    setUsernameError("");
    devLog("자동 username 생성:", newUsername);
  };

  const handleProfileEditAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isAcceptableRasterImageFile(file)) {
      showToast("이미지 파일만 업로드할 수 있어요.", "info", 3200);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("파일은 5MB 이하 이미지만 업로드할 수 있어요.", "info", 3200);
      return;
    }
    try {
      if (!user?.id) {
        showToast("로그인이 필요합니다.", "info", 3000);
        return;
      }
      const publicUrl = await uploadCuratorProfileAvatarFile(file, user.id);
      const { ok, error: saveErr } = await persistCuratorProfileImageToSupabase(
        supabase,
        user.id,
        publicUrl
      );
      if (!ok) {
        console.error("프로필 사진 저장 오류:", saveErr);
        showToast(
          "사진 주소 저장에 실패했습니다: " + (saveErr?.message || "알 수 없는 오류"),
          "info",
          4000
        );
        return;
      }
      await supabase.auth
        .updateUser({
          data: {
            image: publicUrl,
            avatar_url: publicUrl,
            picture: publicUrl,
          },
        })
        .catch(() => {});
      setEditProfile((prev) => ({ ...prev, image: publicUrl }));
      setCuratorProfile((prev) => (prev ? { ...prev, image: publicUrl } : prev));
      showToast("프로필 사진을 저장했어요.", "success", 2500);
    } catch (err) {
      console.error(err);
      showToast(err?.message || "사진 저장 중 오류가 났어요.", "info", 4000);
    }
  };

  const handleEditDraft = (draft) => {
    // 초안 수정 로직
    devLog("Edit draft:", draft);
    devLog("🔍 임시저장된 데이터 상세:", {
      name_address: draft.basicInfo?.name_address,
      category: draft.basicInfo?.category,
      alcohol_type: draft.alcohol_type,
      atmosphere: draft.atmosphere,
      latitude: draft.latitude,
      longitude: draft.longitude,
      is_public: draft.publishInfo?.is_public
    });
    
    // 지도 중심 설정
    if (draft.latitude && draft.longitude) {
      setMapCenter({ lat: draft.latitude, lng: draft.longitude });
      devLog("🗺️ 지도 중심 설정:", { lat: draft.latitude, lng: draft.longitude });
    }
    
    // 잔 올리기 섹션으로 이동
    setActiveSection("add");

    // 잔 리스트에서 연 '장소 수정' 상태가 남아 있으면 임시저장 시 잘못된 행이 지워지거나 중복 저장될 수 있음
    setEditingPlaceId(null);
    try {
      localStorage.removeItem("editing_place_id");
    } catch {
      /* ignore */
    }

    // 수정 중인 임시저장 ID 설정
    setEditingDraftId(draft.id);
    
    // 섹션 이동 후 직접 폼 필드에 값 설정
    setTimeout(() => {
      // 직접 폼 필드에 값 설정
      const nameInput = document.querySelector('input[type="text"]');
      const categorySelect = document.querySelector('select');
      const alcoholSelect = document.querySelectorAll('select')[1];
      const atmosphereSelect = document.querySelectorAll('select')[2];
      const reasonTextarea = document.querySelector('textarea');
      
      if (nameInput) nameInput.value = draft.basicInfo?.name_address || "";
      if (categorySelect) categorySelect.value = draft.basicInfo?.category || "";
      if (alcoholSelect) alcoholSelect.value = draft.alcohol_type || "";
      if (atmosphereSelect) atmosphereSelect.value = draft.atmosphere || "";
      if (reasonTextarea) reasonTextarea.value = draft.menu_reason || "";
      
      // React 상태도 업데이트
      setFormData({
        name_address: draft.basicInfo?.name_address || "",
        category: draft.basicInfo?.category || "",
        alcohol_type: draft.alcohol_type || "",
        atmosphere: draft.atmosphere || "",
        recommended_menu: draft.recommended_menu || "",
        menu_reason: draft.menu_reason || "",
        tags: filterPlaceTagsForDisplay(draft.tags || []),
        latitude: draft.latitude || null,
        longitude: draft.longitude || null,
        is_public: draft.publishInfo?.is_public || true
      });
      
      devLog("✅ 직접 폼 필드에 값 설정 완료");
    }, 200);
  };

  const handleDeleteDraft = (draftId) => {
    // 초안 삭제 로직
    devLog("Delete draft:", draftId);
    
    // localStorage에서 삭제
    const draftOwnerId = user?.id ?? null;
    const existingDrafts = readStudioDrafts(draftOwnerId);
    const updatedDrafts = existingDrafts.filter(draft => draft.id !== draftId);
    writeStudioDrafts(draftOwnerId, updatedDrafts);
    
    // state에서도 삭제
    setDrafts(prev => prev.filter(draft => draft.id !== draftId));
    devLog("🗑️ 임시저장 삭제 완료 (localStorage):", draftId);
  };


  const endLive = () => {
    setStats((prev) => ({ ...prev, isLive: false, notificationSent: false }));
  };

  const handleLiveStartWithNotification = () => {
    devLog("알림 발송됨");
    setStats((prev) => ({ ...prev, isLive: true, notificationSent: true }));
    setLiveStartConfirmOpen(false);
  };

  const handleLiveStartWithoutNotification = () => {
    setStats((prev) => ({ ...prev, isLive: true, notificationSent: false }));
    setLiveStartConfirmOpen(false);
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        로딩 중...
      </div>
    );
  }

  // 일반 사용자는 스튜디오 접근 불가
  if (!isCurator) {
    return (
      <div style={{ padding: "20px", textAlign: "center", minHeight: "100vh", backgroundColor: "#111111", color: "#ffffff" }}>
        <div style={{ marginTop: "100px", maxWidth: "600px", margin: "100px auto 0" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "20px", color: "#e74c3c" }}>
            접근 불가
          </h1>
          
          <div style={{
            backgroundColor: "rgba(231, 76, 60, 0.1)",
            border: "1px solid rgba(231, 76, 60, 0.3)",
            borderRadius: "12px",
            padding: "30px",
            marginBottom: "30px"
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "15px", color: "#e74c3c" }}>
              🚫 큐레이터 전용 페이지
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#ccc", marginBottom: "20px" }}>
              스튜디오는 큐레이터만 접근할 수 있습니다.<br/>
              일반 사용자는 홈 화면에서 @아이디를 클릭하여<br/>
              저장한 장소와 팔로우한 큐레이터를 확인할 수 있습니다.
            </p>
            
            <button
              onClick={() => navigate("/")}
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: "#3498DB",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "background-color 0.2s ease"
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "#2980B9"}
              onMouseOut={(e) => e.target.style.backgroundColor = "#3498DB"}
            >
              🏠 홈으로 가기
            </button>
          </div>
          
          <div style={{ textAlign: "center", color: "#666", fontSize: "14px" }}>
            큐레이터가 되고 싶으신가요? <span style={{ color: "#3498DB", cursor: "pointer" }}>큐레이터 신청하기</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.studioShell}>
      <StudioTopChrome
        username={curatorProfile.username}
        activeSection={activeSection}
        chromeStyles={{
          topBarWrap: styles.topBarWrap,
          topBarButton: styles.topBarButton,
          topBarButtonActive: styles.topBarButtonActive,
        }}
        onSelectAdd={() => {
          setEditingDraftId(null);
          setEditingPlaceId(null);
          try {
            localStorage.removeItem("editing_place_id");
          } catch {
            /* ignore */
          }
          setActiveSection("add");
        }}
        onSelectList={() => setActiveSection("list")}
        onSelectDrafts={() => setActiveSection("drafts")}
        onSelectArchive={() => setActiveSection("archive")}
        onSelectPicks={() => {
          setStudioPickDetailPlace(null);
          setActiveSection("picks");
        }}
      />

      {/* 잔 올리기 섹션 */}
      {activeSection === "add" && (
        <StudioAddPlaceSection
          sectionInnerStyle={styles.studioSectionInner}
          mapRef={mapRef}
          activeSection={activeSection}
          defaultPlaces={defaultPlaces}
          place={{
            formData,
            setFormData,
            mapCenter,
            searchedPlaces,
          }}
          search={{
            searchSuggestions,
            showSuggestions,
            setShowSuggestions,
            selectedSuggestionIndex,
            setSelectedSuggestionIndex,
            setSearchSuggestions,
            handleInputChange,
            handleKeyDown,
            handleSearch,
            handleSuggestionClick,
            fetchSuggestions,
          }}
          tags={{
            frequentTags,
            allTags,
            allTagsList,
            removeTag,
            tagInputValue,
            setTagInputValue,
            tagSuggestions,
            setTagSuggestions,
            showAllTags,
            setShowAllTags,
            handleTagInputChange,
            handleTagSuggestionClick,
          }}
          folders={{
            savedFoldersLoading,
            savedFoldersLoadError,
            sortedSavedFolders,
            addPlaceSelectedFolders,
            toggleAddPlaceFolder,
            addPlaceShowNewFolder,
            setAddPlaceShowNewFolder,
            addPlaceNewFolderName,
            setAddPlaceNewFolderName,
            addPlaceNewFolderSaving,
            handleAddPlaceCustomFolder,
          }}
          photos={{
            addPlacePhotoFiles,
            setAddPlacePhotoFiles,
          }}
          onSubmit={handleAddPlace}
        />
      )}

      {/* 잔 리스트 섹션 */}
      {activeSection === "list" && (
        <StudioListSection
          sectionInnerStyle={styles.studioSectionInner}
          folders={{
            savedByFolder,
            savedFoldersLoadError,
            savedFoldersLoading,
            savedFolderKey,
            setSavedFolderKey,
            savedShowNewFolder,
            setSavedShowNewFolder,
            savedNewFolderName,
            setSavedNewFolderName,
            savedFolderSaving,
            savedFoldersEditMode,
            setSavedFoldersEditMode,
            savedFolderMetaDeletingKey,
            savedFolderEditName,
            setSavedFolderEditName,
            savedFolderEditColor,
            setSavedFolderEditColor,
            savedFolderEditIcon,
            setSavedFolderEditIcon,
            savedFolderMetaSaving,
            savedFoldersListExpanded,
            setSavedFoldersListExpanded,
            sortedSavedFolders,
            hasDeletableSavedFolders,
            handleDeleteSavedFolder,
            handleSaveSavedFolderMeta,
            savedFolderPlaceIdSet,
            handleAddSavedFolder,
          }}
          places={{
            myPlaces,
            listSearchQuery,
            setListSearchQuery,
            filterType,
            setFilterType,
            handleEditPlace,
            handleDeletePlace,
            handleTogglePublic,
          }}
        />
      )}

      {activeSection === "drafts" && (
        <StudioDraftsSection
          drafts={drafts}
          onEdit={handleEditDraft}
          onDelete={handleDeleteDraft}
        />
      )}

      {activeSection === "archive" && (
        <StudioArchiveSection
          sectionInnerStyle={styles.studioSectionInner}
          curatorProfile={curatorProfile}
          isEditingProfile={isEditingProfile}
          editProfile={editProfile}
          setEditProfile={setEditProfile}
          usernameError={usernameError}
          profileEditAvatarFileRef={profileEditAvatarFileRef}
          onProfileAvatarFileChange={handleProfileEditAvatarFile}
          onUsernameChange={handleUsernameChange}
          onUpdateUsername={handleUpdateUsername}
          onSaveProfile={handleSaveProfile}
          onCancelEdit={handleCancelEdit}
          onEditProfile={handleEditProfile}
          stats={stats}
          onEndLive={endLive}
          onOpenLiveConfirm={() => setLiveStartConfirmOpen(true)}
          myPlacesCount={myPlaces.length}
          curatorStats={curatorStats}
          showOverlapPlacesList={showOverlapPlacesList}
          setShowOverlapPlacesList={setShowOverlapPlacesList}
          overlapSharedPlacesList={overlapSharedPlacesList}
          archiveExtInsights={archiveExtInsights}
          archiveInsightsError={archiveInsightsError}
        />
      )}

      {activeSection === "picks" && (
        <StudioPicksSection
          rows={studioPlacePicks}
          loading={studioPlacePicksLoading}
          onRowClick={(row) => {
            const p = placePickJoinRowToDetailPlace(row);
            if (p) setStudioPickDetailPlace(p);
          }}
        />
      )}

      {studioPickDetailPlace ? (
        <PlaceDetail
          place={studioPickDetailPlace}
          isSaved={isPlaceSaved(studioPickDetailPlace.id)}
          onClose={() => setStudioPickDetailPlace(null)}
          onSave={() => {}}
        />
      ) : null}

      <LiveStartConfirmModal
        open={liveStartConfirmOpen}
        onClose={() => setLiveStartConfirmOpen(false)}
        onConfirmWithNotification={handleLiveStartWithNotification}
        onConfirmWithoutNotification={handleLiveStartWithoutNotification}
      />
    </div>
  );
}

const styles = {
  studioShell: {
    padding: "12px 12px 20px",
    textAlign: "center",
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    backgroundColor: "#111111",
    color: "#ffffff",
    boxSizing: "border-box",
    position: "relative",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  studioSectionInner: {
    textAlign: "left",
    margin: "0 auto",
    width: "min(920px, 100%)",
    maxWidth: "100%",
    minWidth: 0,
    padding: "0 4px",
    boxSizing: "border-box",
  },
  topBarWrap: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: "6px",
    padding: "8px 10px",
    margin: "0 auto 14px",
    width: "min(920px, 100%)",
    boxSizing: "border-box",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "10px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "thin",
    justifyContent: "stretch",
    alignItems: "stretch",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
  },
  page: {
    minHeight: "100vh",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  topBar: {
    display: "flex",
    gap: "8px",
    padding: "16px 24px",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "8px",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    justifyContent: "center",
    flexWrap: "wrap",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
    minHeight: "60px",
    alignItems: "center",
  },
  topBarButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.88)",
    borderRadius: "8px",
    padding: "8px 10px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flex: "1 1 0",
    minWidth: "min-content",
    transition: "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "none",
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
  },
  topBarButtonActive: {
    border: "1px solid rgba(46, 204, 113, 0.45)",
    backgroundColor: "rgba(46, 204, 113, 0.18)",
    color: "#ffffff",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  topBarButtonHover: {
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: "translateY(-2px)",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.18)"
  },
  header: {
    padding: "24px 20px",
    borderBottom: "1px solid #222222",
    textAlign: "center",
  },
  title: {
    fontSize: "24px",
    fontWeight: 800,
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "14px",
    color: "#bdbdbd",
    margin: 0,
  },
  content: {
    padding: "20px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  section: {
    marginBottom: "32px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
  },
  sectionActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  sortSelect: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "6px 12px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "12px",
  },
  viewAllButton: {
    border: "1px solid #444444",
    backgroundColor: "transparent",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  quickActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  quickActionsHorizontal: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  tertiaryButton: {
    border: "1px solid #666666",
    backgroundColor: "transparent",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  quickStats: {
    display: "flex",
    gap: "24px",
  },
  quickStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  quickStatNumber: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#2ECC71",
  },
  quickStatLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "16px",
    backgroundColor: "#1a1a1a",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  cardMeta: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginBottom: "8px",
  },
  cardDescription: {
    fontSize: "14px",
    color: "#ffffff",
    lineHeight: 1.4,
    marginBottom: "8px",
  },
  cardTags: {
    display: "flex",
    gap: "6px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#333333",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 600,
  },
  cardStats: {
    display: "flex",
    gap: "16px",
    marginBottom: "8px",
  },
  cardStat: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  editButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid #FF6B6B",
    backgroundColor: "transparent",
    color: "#FF6B6B",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  viewButton: {
    border: "1px solid #2ECC71",
    backgroundColor: "transparent",
    color: "#2ECC71",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: "#bdbdbd",
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  emptyText: {
    fontSize: "16px",
    marginBottom: "20px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  statCard: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    textAlign: "center",
  },
  statIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: 800,
    marginBottom: "4px",
    color: "#2ECC71",
  },
  statLabel: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  recentActivity: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
  },
  activityTitle: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  activityItem: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  activityIcon: {
    fontSize: "16px",
    flexShrink: 0,
  },
  activityText: {
    flex: 1,
    fontSize: "14px",
    lineHeight: 1.4,
  },
  activityTime: {
    fontSize: "12px",
    color: "#bdbdbd",
    flexShrink: 0,
  },
  stepGuide: {
    border: "1px solid #222222",
    borderRadius: "12px",
    padding: "20px",
    backgroundColor: "#1a1a1a",
    marginTop: "16px",
  },
  stepGuideTitle: {
    fontSize: "16px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  stepGuideSteps: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  stepGuideStep: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    border: "1px solid #333333",
    borderRadius: "12px",
    backgroundColor: "#222222",
  },
  stepNumber: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#2ECC71",
    fontSize: "16px",
    fontWeight: 700,
    marginBottom: "4px",
  },
  stepDescription: {
    fontSize: "14px",
    color: "#bdbdbd",
  },
  stepButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  "stepButton:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  welcomeSection: {
    textAlign: "center",
    padding: "60px 20px",
  },
  welcomeIcon: {
    fontSize: "64px",
    marginBottom: "16px",
  },
  welcomeTitle: {
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 0 8px 0",
  },
  welcomeText: {
    fontSize: "16px",
    color: "#bdbdbd",
    margin: 0,
  },
};
