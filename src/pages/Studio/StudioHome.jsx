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
import { useStudioUnsavedTogglePrompt } from "./hooks/useStudioUnsavedTogglePrompt";
import { studioHomeStyles as styles } from "./components/studioHomeStyles";

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

  const { setHasUnsavedChanges, setOriginalPlaceBeforeChange } =
    useStudioUnsavedTogglePrompt({
      user,
      activeSection,
      myPlaces,
      setMyPlaces,
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

  // 「잔 올리기」 섹션 prop 묶음 — 다른 섹션일 땐 만들지 않는다.
  const addPlaceSectionProps =
    activeSection === "add"
      ? {
          place: {
            formData,
            setFormData,
            mapCenter,
            searchedPlaces,
          },
          search: {
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
          },
          tags: {
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
          },
          folders: {
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
          },
          photos: {
            addPlacePhotoFiles,
            setAddPlacePhotoFiles,
          },
        }
      : null;

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
      {addPlaceSectionProps && (
        <StudioAddPlaceSection
          sectionInnerStyle={styles.studioSectionInner}
          mapRef={mapRef}
          activeSection={activeSection}
          defaultPlaces={defaultPlaces}
          {...addPlaceSectionProps}
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

