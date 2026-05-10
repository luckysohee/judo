import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/Toast/ToastProvider";
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
import { devLog } from "./studioHomeModule.js";
import { useStudioUnreadFollowerToast } from "./hooks/useStudioUnreadFollowerToast";
import { useStudioPlacePicks } from "./hooks/useStudioPlacePicks";
import { useStudioSavedFolders } from "./hooks/useStudioSavedFolders";
import { useStudioCuratorStats } from "./hooks/useStudioCuratorStats";
import { useStudioPlaceActions } from "./hooks/useStudioPlaceActions";
import { useStudioAddPlaceForm } from "./hooks/useStudioAddPlaceForm";
import { useStudioInitialLoad } from "./hooks/useStudioInitialLoad";
import { useStudioCuratorProfileEdit } from "./hooks/useStudioCuratorProfileEdit";
import { useStudioDraftActions } from "./hooks/useStudioDraftActions";
import { useStudioLiveToggle } from "./hooks/useStudioLiveToggle";

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

  useStudioInitialLoad({
    user,
    authLoading,
    setLoading,
    setMyPlaces,
    setDrafts,
    setIsCurator,
    setCuratorProfile,
  });

  const {
    handleEditProfile,
    handleSaveProfile,
    handleCancelEdit,
    handleUsernameChange,
    handleUpdateUsername,
    handleProfileEditAvatarFile,
  } = useStudioCuratorProfileEdit({
    user,
    showToast,
    curatorProfile,
    setCuratorProfile,
    editProfile,
    setEditProfile,
    setIsEditingProfile,
    setUsernameError,
  });

  const { handleEditDraft, handleDeleteDraft } = useStudioDraftActions({
    user,
    setMapCenter,
    setActiveSection,
    setEditingPlaceId,
    setEditingDraftId,
    setFormData,
    setDrafts,
  });

  const {
    stats,
    liveStartConfirmOpen,
    setLiveStartConfirmOpen,
    endLive,
    handleLiveStartWithNotification,
    handleLiveStartWithoutNotification,
  } = useStudioLiveToggle();

  useEffect(() => {
    if (location.state?.openStudioList) {
      setActiveSection("list");
      navigate("/studio", { replace: true, state: {} });
    }
  }, [location.state?.openStudioList, navigate]);


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
