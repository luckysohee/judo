import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from '../../lib/supabase';

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

/**
 * 유리 느낌은 블러 없이 (지도 선명 유지) — 블랙 베이스 + 상단 광택 + 얇은 테두리.
 */
const userCardGlass = {
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    background:
      "linear-gradient(175deg, rgba(52,54,68,0.96) 0%, rgba(22,24,32,0.98) 32%, rgba(6,7,11,0.99) 100%)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    boxShadow:
      "0 -18px 56px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.45)",
  },
  hairline: {
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  panel: {
    background:
      "linear-gradient(150deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.2) 100%)",
    border: "1px solid rgba(255, 255, 255, 0.11)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.3)",
  },
};

// 팔로우 큐레이터 컴팩트 스타일
const curatorCardStyles = {
  card: {
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    borderRadius: "8px",
    padding: "6px 8px",
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#3498DB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: 'white',
    flexShrink: 0
  },
  details: {
    flex: 1,
    minWidth: 0
  },
  name: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  meta: {
    fontSize: '10px',
    color: '#999',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  unfollowButton: {
    padding: "4px 8px",
    backgroundColor: "rgba(231, 76, 60, 0.5)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    fontSize: "10px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
};

// SaveModal 스타일 동일하게 적용
const modalStyles = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  folderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    justifyContent: 'center'
  },
  folderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '5px 3px',
    border: '2px solid',
    borderRadius: '8px',
    background:
      "linear-gradient(160deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '36px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    zIndex: 10
  },
  addFolderButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '5px 3px',
    border: '2px dashed rgba(255, 255, 255, 0.28)',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: '36px',
    color: 'rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    zIndex: 10
  }
};

/** Supabase `places (*)` 조인은 `places`, 스튜디오 드래프트 형태는 `place` */
function getSavedPlaceDisplayFields(item) {
  if (!item || typeof item !== "object") {
    return { name: "", address: "" };
  }
  const row = item.places ?? item.place;
  const name =
    row?.name ??
    row?.place_name ??
    row?.title ??
    item.place_name ??
    item.name ??
    "";
  const address =
    row?.address ??
    row?.road_address ??
    row?.road_address_name ??
    row?.address_name ??
    item.address ??
    "";
  return {
    name: String(name || "").trim() || "이름 없음",
    address: String(address || "").trim(),
  };
}

const SWIPE_CLOSE_PX = 88;
const SWIPE_MAX_DRAG_PX = 280;

const UserCard = ({
  user,
  onClose,
  isVisible,
  onFolderSelect,
  /** 관리자: RPC `usercard_saved_rows` — RLS로 타인 저장을 못 읽을 때 주입 */
  embeddedSavedRows = null,
  /** 관리자: RPC `following_curators` — 팔로우 탭 주입 */
  embeddedFollowingCurators = null,
  embeddedAdminReadOnly = false,
  hideFollowingTab = false,
  adminRecommends = null,
  adminSavedUnassigned = null,
  adminEmbedBanner = null,
  adminTallSheet = false,
  layerZIndex = 1000,
}) => {
  const [activeTab, setActiveTab] = useState('saved');
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [followingCurators, setFollowingCurators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCurator, setSelectedCurator] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null); // 선택된 폴더 상태
  const [showFolderEditModal, setShowFolderEditModal] = useState(false); // 폴더 수정 모달 상태
  const [editingPlace, setEditingPlace] = useState(null); // 수정 중인 장소
  const [selectedFolders, setSelectedFolders] = useState([]); // 선택된 폴더들

  const swipeHeaderRef = useRef(null);
  const tabScrollRef = useRef(null);
  const sheetDragYRef = useRef(0);
  const [sheetDragY, setSheetDragY] = useState(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isVisible) {
      sheetDragYRef.current = 0;
      setSheetDragY(0);
    }
  }, [isVisible]);

  const attachSwipeDownClose = useCallback((touchEl, scrollContainer) => {
    if (!touchEl) return () => {};
    let startY = null;
    let pulling = false;
    let scrollTopAtStart = 0;

    const touchStart = (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = false;
      scrollTopAtStart = scrollContainer?.scrollTop ?? 0;
    };

    const touchMove = (e) => {
      if (startY == null || e.touches.length !== 1) return;
      if (
        scrollContainer != null &&
        (scrollTopAtStart > 0 || scrollContainer.scrollTop > 0)
      ) {
        return;
      }
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (dy > 12) {
        pulling = true;
        e.preventDefault();
        const next = Math.min(dy, SWIPE_MAX_DRAG_PX);
        sheetDragYRef.current = next;
        setSheetDragY(next);
      }
    };

    const touchEnd = () => {
      if (pulling && sheetDragYRef.current >= SWIPE_CLOSE_PX) {
        onCloseRef.current?.();
      }
      sheetDragYRef.current = 0;
      setSheetDragY(0);
      startY = null;
      pulling = false;
    };

    touchEl.addEventListener("touchstart", touchStart, { passive: true });
    touchEl.addEventListener("touchmove", touchMove, { passive: false });
    touchEl.addEventListener("touchend", touchEnd);
    touchEl.addEventListener("touchcancel", touchEnd);

    return () => {
      touchEl.removeEventListener("touchstart", touchStart);
      touchEl.removeEventListener("touchmove", touchMove);
      touchEl.removeEventListener("touchend", touchEnd);
      touchEl.removeEventListener("touchcancel", touchEnd);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return undefined;
    const header = swipeHeaderRef.current;
    const scroll = tabScrollRef.current;
    const unbindHeader = attachSwipeDownClose(header, null);
    const unbindScroll = attachSwipeDownClose(scroll, scroll);
    return () => {
      unbindHeader();
      unbindScroll();
    };
  }, [isVisible, attachSwipeDownClose]);

  useEffect(() => {
    if (hideFollowingTab && activeTab === "following") {
      setActiveTab("saved");
    }
  }, [hideFollowingTab, activeTab]);

  useEffect(() => {
    console.log('🔄 UserCard useEffect 호출:', { isVisible, user });
    if (isVisible && user) {
      console.log('✅ loadUserData 시작');
      loadUserData();
    }
  }, [isVisible, user, embeddedSavedRows, embeddedFollowingCurators]);

  // 실제 장소 수를 계산하는 함수
  const getTotalPlacesCount = () => {
    return Object.values(savedPlaces).reduce((total, folder) => total + folder.places.length, 0);
  };
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedFolder(null);
  };

  // 폴더 클릭 핸들러
  const handleFolderClick = (folderKey, folderData) => {
    // 뒤로 가기 버튼 클릭 시
    if (!folderData) {
      setSelectedFolder(null);
      return;
    }

    console.log('폴더 클릭:', folderData.folderInfo?.name);
    
    // 1. 모달 내부에 상세 리스트를 보여주기 위한 상태 업데이트
    setSelectedFolder({
      key: folderKey,
      info: folderData.folderInfo,
      places: folderData.places
    });

    // 2. 상위 컴포넌트에 알림 -> 지도에 마커 표시 요청
    if (onFolderSelect) {
      onFolderSelect(folderData);
    }
  };

  // 장소 삭제 핸들러
  const handleDeletePlace = async (placeItem) => {
    const delName = getSavedPlaceDisplayFields(placeItem).name;
    if (!window.confirm(`${delName}을(를) 삭제하시겠습니까?`)) {
      return;
    }

    try {
      // localStorage 데이터인지 Supabase 데이터인지 확인
      if (placeItem.isKakaoPlace || placeItem.isDbPlace || placeItem.id?.startsWith('kakao_') || placeItem.id?.startsWith('local_')) {
        // localStorage 데이터 삭제
        const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
        let updatedDrafts;
        
        if (placeItem.id?.startsWith('kakao_')) {
          const kakaoPlaceId = placeItem.id.replace('kakao_', '');
          updatedDrafts = existingDrafts.filter(draft => draft.kakao_place_id !== kakaoPlaceId);
        } else if (placeItem.kakao_place_id) {
          // kakao_place_id가 있는 경우
          updatedDrafts = existingDrafts.filter(draft => draft.kakao_place_id !== placeItem.kakao_place_id);
        } else {
          // place_name으로 찾기
          updatedDrafts = existingDrafts.filter(
            (draft) => draft.place_name !== getSavedPlaceDisplayFields(placeItem).name
          );
        }
        
        localStorage.setItem('studio_drafts', JSON.stringify(updatedDrafts));
        console.log("✅ localStorage 장소 삭제 완료:", delName);
      } else if (placeItem.id && !placeItem.id.startsWith('kakao_') && !placeItem.id.startsWith('local_')) {
        // Supabase 데이터 삭제 (UUID 형식인 경우만)
        const { error } = await supabase
          .from('user_saved_places')
          .delete()
          .eq('id', placeItem.id);
          
        if (error) {
          console.error('Supabase 삭제 오류:', error);
          alert('삭제에 실패했습니다.');
          return;
        }
        
        console.log("✅ Supabase 장소 삭제 완료:", delName);
      } else {
        console.warn('알 수 없는 장소 데이터 형식:', placeItem);
        alert('삭제할 수 없는 장소입니다.');
        return;
      }

      // 선택된 폴더에서 해당 장소 제거
      setSelectedFolder(prev => ({
        ...prev,
        places: prev.places.filter(place => place.id !== placeItem.id)
      }));

      // savedPlaces 상태도 업데이트
      setSavedPlaces(prev => {
        const updated = { ...prev };
        if (updated[selectedFolder.key]) {
          updated[selectedFolder.key].places = updated[selectedFolder.key].places.filter(
            place => place.id !== placeItem.id
          );
        }
        return updated;
      });

      alert('삭제되었습니다.');

    } catch (error) {
      console.error('장소 삭제 오류:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 장소 수정 핸들러
  const handleEditPlace = (placeItem) => {
    setEditingPlace(placeItem);
    
    // 현재 장소가 속한 폴더들 찾기
    const currentFolders = [];
    Object.entries(savedPlaces).forEach(([folderKey, folderData]) => {
      if (folderData.places.some(place => place.id === placeItem.id)) {
        currentFolders.push({
          key: folderKey,
          name: folderData.folderInfo.name,
          icon: folderData.folderInfo.icon,
          color: folderData.folderInfo.color
        });
      }
    });
    
    setSelectedFolders(currentFolders);
    setShowFolderEditModal(true);
  };

  // 폴더 토글 핸들러
  const toggleFolderSelection = (folderKey, folderInfo) => {
    setSelectedFolders(prev => {
      const isSelected = prev.some(folder => folder.key === folderKey);
      if (isSelected) {
        return prev.filter(folder => folder.key !== folderKey);
      } else {
        return [...prev, { key: folderKey, ...folderInfo }];
      }
    });
  };

  // 폴더 수정 저장 핸들러
  const handleSaveFolderChanges = async () => {
    if (!editingPlace || selectedFolders.length === 0) {
      alert('최소 하나의 폴더를 선택해야 합니다.');
      return;
    }

    try {
      // localStorage 데이터인지 Supabase 데이터인지 확인
      if (editingPlace.isKakaoPlace || editingPlace.isDbPlace) {
        // localStorage 데이터 수정
        const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
        const updatedDrafts = existingDrafts.map(draft => {
          if (draft.id === editingPlace.id || 
              (editingPlace.isKakaoPlace && draft.kakao_place_id === editingPlace.id.replace('kakao_', '')) ||
              (draft.place_id === editingPlace.id)) {
            const folderNames = selectedFolders.map(folder => folder.name);
            return { ...draft, folders: folderNames };
          }
          return draft;
        });
        
        localStorage.setItem('studio_drafts', JSON.stringify(updatedDrafts));
        console.log(
          "✅ localStorage 폴더 수정 완료:",
          getSavedPlaceDisplayFields(editingPlace).name
        );
      } else {
        // Supabase 데이터 수정 - 기존 폴더 관계 삭제 후 새로 추가
        const { error: deleteError } = await supabase
          .from('user_saved_place_folders')
          .delete()
          .eq('user_saved_place_id', editingPlace.id);
          
        if (deleteError) {
          console.error('폴더 관계 삭제 오류:', deleteError);
          alert('수정에 실패했습니다.');
          return;
        }

        // 새로운 폴더 관계 추가
        const folderRelations = selectedFolders.map(folder => ({
          user_saved_place_id: editingPlace.id,
          folder_key: folder.key
        }));

        const { error: insertError } = await supabase
          .from('user_saved_place_folders')
          .insert(folderRelations);
          
        if (insertError) {
          console.error('폴더 관계 추가 오류:', insertError);
          alert('수정에 실패했습니다.');
          return;
        }
        
        console.log(
          "✅ Supabase 폴더 수정 완료:",
          getSavedPlaceDisplayFields(editingPlace).name
        );
      }

      // 데이터 다시 로드
      await loadUserData();
      
      // 모달 닫기
      setShowFolderEditModal(false);
      setEditingPlace(null);
      setSelectedFolders([]);
      
      alert('폴더가 수정되었습니다.');

    } catch (error) {
      console.error('폴더 수정 오류:', error);
      alert('수정에 실패했습니다.');
    }
  };

  // 팔로우한 큐레이터 필터링 함수
  const getFilteredCurators = () => {
    if (!searchQuery.trim()) {
      return followingCurators;
    }

    return followingCurators.filter(curator => {
      const username = curator.username?.toLowerCase() || '';
      const displayName = curator.display_name?.toLowerCase() || '';
      const bio = curator.bio?.toLowerCase() || '';
      const searchLower = searchQuery.toLowerCase();
      
      return username.includes(searchLower) || 
             displayName.includes(searchLower) || 
             bio.includes(searchLower);
    });
  };

  // 큐레이터 프로필 불러오기
  const loadCuratorProfile = async (curator) => {
    try {
      // 큐레이터 상세 정보 불러오기
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('*')
        .eq('username', curator.username)
        .single();

      if (curatorError) {
        console.error('큐레이터 정보 로드 오류:', curatorError);
        return;
      }

      // 큐레이터의 저장된 장소 불러오기
      const { data: savedPlaces, error: placesError } = await supabase
        .from('user_saved_places')
        .select(`
          *,
          places (*)
        `)
        .eq('user_id', curatorData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (placesError) {
        console.error('큐레이터 저장 장소 로드 오류:', placesError);
      }

      // 큐레이터의 팔로워 수 불러오기
      const { count: followerCount, error: followerError } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('curator_id', curatorData.id);

      setSelectedCurator({
        ...curatorData,
        savedPlaces: savedPlaces || [],
        stats: {
          ...curatorData.stats,
          followerCount: followerCount || 0
        }
      });

    } catch (error) {
      console.error('큐레이터 프로필 로드 오류:', error);
    }
  };

  const loadUserData = async () => {
    try {
      console.log('🚀 loadUserData 함수 시작');
      setLoading(true);

      const useEmbedded =
        embeddedSavedRows != null && Array.isArray(embeddedSavedRows);

      let savedData = null;
      let savedError = null;

      if (useEmbedded) {
        savedData = embeddedSavedRows;
      } else {
        const res = await supabase
          .from("user_saved_places")
          .select(
            `
          *,
          places (*), 
          user_saved_place_folders (
            folder_key,
            system_folders (
              name,
              color,
              icon
            )
          )
        `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        savedData = res.data;
        savedError = res.error;
      }

      console.log("UserCard - savedData:", savedData);
      console.log("UserCard - savedError:", savedError);

      const localStorageDrafts = useEmbedded
        ? []
        : JSON.parse(localStorage.getItem("studio_drafts") || "[]");
      console.log('🗂️ UserCard - localStorage 데이터:', localStorageDrafts);
      
      // 기본 폴더 7개 초기화
      const SYSTEM_FOLDERS = [
        { key: 'after_party', name: '2차', color: '#FF8C42', icon: '🍺' },
        { key: 'date', name: '데이트', color: '#FF69B4', icon: '💘' },
        { key: 'hangover', name: '해장', color: '#87CEEB', icon: '🥣' },
        { key: 'solo', name: '혼술', color: '#9B59B6', icon: '👤' },
        { key: 'group', name: '회식', color: '#F1C40F', icon: '👥' },
        { key: 'must_go', name: '찐맛집', color: '#27AE60', icon: '🌟' },
        { key: 'terrace', name: '야외/뷰', color: '#5DADE2', icon: '🌅' }
      ];
      
      const groupedByFolder = {};
      SYSTEM_FOLDERS.forEach(folder => {
        groupedByFolder[folder.key] = {
          folderInfo: folder,
          places: []
        };
      });
      
      // localStorage 데이터 처리
      localStorageDrafts.forEach(draft => {
        const folders = draft.folders || [];
        folders.forEach(folderName => {
          // 폴더 이름을 key로 변환
          const folderKey = SYSTEM_FOLDERS.find(f => f.name === folderName)?.key;
          if (folderKey && groupedByFolder[folderKey]) {
            // localStorage 데이터를 Supabase 형식으로 변환
            const placeData = {
              id: draft.id || `local_${draft.kakao_place_id || draft.place_name}_${Date.now()}`,
              place: {
                name: draft.place_name,
                address: draft.address,
                category: draft.category,
                lat: draft.lat,
                lng: draft.lng
              },
              created_at: draft.created_at,
              isKakaoPlace: draft.isKakaoPlace || false,
              isDbPlace: draft.isDbPlace || false,
              kakao_place_id: draft.kakao_place_id // 추가 정보 저장
            };
            groupedByFolder[folderKey].places.push(placeData);
            console.log(`✅ localStorage 장소 추가: ${folderName} 폴더에 ${draft.place_name}`);
          }
        });
      });

      if (savedError) {
        console.error('저장된 장소 로드 오류:', savedError);
      } else if (savedData && savedData.length > 0) {
        // Supabase 데이터 처리 (데이터가 있을 경우에만)
        savedData.forEach(saved => {
          if (saved.user_saved_place_folders && saved.user_saved_place_folders.length > 0) {
            saved.user_saved_place_folders.forEach(folder => {
              const folderKey = folder.folder_key;
              if (groupedByFolder[folderKey]) {
                groupedByFolder[folderKey].places.push(saved);
              }
            });
          }
        });
      }

      console.log('UserCard - 그룹화된 데이터:', groupedByFolder);
      
      // 각 폴더별 장소 수 확인
      Object.entries(groupedByFolder).forEach(([folderKey, folderData]) => {
        console.log(
          `📁 ${folderData.folderInfo?.name}: ${folderData.places.length}개 장소`,
          folderData.places.map((p) => getSavedPlaceDisplayFields(p).name)
        );
      });
      
      // 전체 장소 수 확인
      const totalPlaces = Object.values(groupedByFolder).reduce((sum, folder) => sum + folder.places.length, 0);
      console.log(`📊 전체 장소 수: ${totalPlaces}개 (localStorage: ${localStorageDrafts.length}개, Supabase: ${savedData?.length || 0}개)`);
      
      setSavedPlaces(groupedByFolder);

      if (hideFollowingTab) {
        setFollowingCurators([]);
      } else if (useEmbedded) {
        setFollowingCurators(
          Array.isArray(embeddedFollowingCurators)
            ? embeddedFollowingCurators
            : []
        );
      } else {
      const { data: followingData, error: followingError } = await supabase
        .from('user_follows')
        .select('*')
        .eq('user_id', user.id);

      console.log("🔍 UserCard - 팔로우 데이터:", followingData);
      console.log("🔍 UserCard - 현재 user.id:", user.id);

      if (followingError) {
        console.error('팔로우 큐레이터 로드 오류:', followingError);
        setFollowingCurators([]);
      } else if (followingData && followingData.length > 0) {
        // 각 curator_id에 해당하는 큐레이터 정보 가져오기
        const curatorIds = followingData.map(f => f.curator_id).filter(Boolean);
        
        if (curatorIds.length > 0) {
          // UUID와 문자열을 분리
          const uuidIds = curatorIds.filter(id => id.includes('-'));
          const stringIds = curatorIds.filter(id => !id.includes('-'));
          
          let curatorData = [];
          
          // UUID 기반 조회
          if (uuidIds.length > 0) {
            const { data: uuidData, error: uuidError } = await supabase
              .from('curators')
              .select('*')
              .in('id', uuidIds);
            
            if (!uuidError && uuidData) {
              curatorData = [...curatorData, ...uuidData];
            } else if (uuidError) {
              console.error('UUID 큐레이터 정보 로드 오류:', uuidError);
            }
          }
          
          // 문자열(username) 기반 조회
          if (stringIds.length > 0) {
            const { data: stringData, error: stringError } = await supabase
              .from('curators')
              .select('*')
              .or(`username.in.(${stringIds.map(id => `'${id}'`).join(',')}),slug.in.(${stringIds.map(id => `'${id}'`).join(',')})`);
            
            if (!stringError && stringData) {
              curatorData = [...curatorData, ...stringData];
            } else if (stringError) {
              console.error('문자열 큐레이터 정보 로드 오류:', stringError);
            }
          }
          
          // 팔로우 데이터와 큐레이터 정보 결합
          const enrichedData = followingData.map(follow => {
            const curator = uuidIds.includes(follow.curator_id)
              ? curatorData.find(c => c.id === follow.curator_id)
              : curatorData.find(c => c.username === follow.curator_id) || 
                curatorData.find(c => c.slug === follow.curator_id);
            
            console.log("🔍 큐레이터 매칭:", {
              follow_curator_id: follow.curator_id,
              found_curator: curator,
              curator_username: curator?.username,
              curator_slug: curator?.slug
            });
            
            return curator || follow;
          });
          
          setFollowingCurators(enrichedData);
        } else {
          setFollowingCurators(followingData);
        }
      } else {
        setFollowingCurators([]);
      }
      }

    } catch (error) {
      console.error('사용자 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSaved = async (placeId) => {
    try {
      const { error } = await supabase
        .from('user_saved_places')
        .delete()
        .eq('user_id', user.id)
        .eq('place_id', placeId);

      if (error) {
        console.error('저장 삭제 오류:', error);
        alert('저장 삭제에 실패했습니다.');
      } else {
        setSavedPlaces(prev => prev.filter(p => p.place_id !== placeId));
      }
    } catch (error) {
      console.error('저장 삭제 처리 오류:', error);
    }
  };

  const handleUnfollow = async (curatorId) => {
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('curator_id', curatorId);

      if (error) {
        console.error('언팔로우 오류:', error);
        alert('언팔로우에 실패했습니다.');
      } else {
        setFollowingCurators(prev => prev.filter(c => c.id !== curatorId));
      }
    } catch (error) {
      console.error('언팔로우 처리 오류:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <div
        role={embeddedAdminReadOnly ? "presentation" : undefined}
        onClick={
          embeddedAdminReadOnly
            ? (e) => {
                if (e.target === e.currentTarget) onClose?.();
              }
            : undefined
        }
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          zIndex: layerZIndex,
          padding: 0,
          ...userCardGlass.overlay,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            borderRadius: "16px 16px 0 0",
            width: "100%",
            maxWidth: "500px",
            height: "auto",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            animation: "slideUp 0.3s ease-out",
            transform:
              sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
            transition:
              sheetDragY > 0
                ? "none"
                : "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
            touchAction: "pan-y",
            ...userCardGlass.sheet,
          }}
        >
          <div ref={swipeHeaderRef}>
            {/* 드래그 핸들 */}
            <div
              style={{
                width: "42px",
                height: "5px",
                backgroundColor: "rgba(255, 255, 255, 0.35)",
                borderRadius: "100px",
                margin: "8px auto 4px",
                cursor: "grab",
                touchAction: "none",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.15), 0 1px 8px rgba(0,0,0,0.2)",
              }}
            />

            {adminEmbedBanner ? (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.7)",
                  padding: "0 14px 6px",
                  lineHeight: 1.35,
                }}
              >
                {adminEmbedBanner}
              </div>
            ) : null}

            {/* 프로필 정보 */}
            <div
            style={{
              padding: "10px 14px 8px",
              paddingRight: "48px",
              borderBottom: `1px solid ${userCardGlass.hairline.borderColor}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, rgba(52, 152, 219, 0.95), rgba(41, 128, 185, 0.75))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                color: 'white',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(52, 152, 219, 0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}>
                {user.user_metadata?.image ? (
                  <img src={user.user_metadata.image} alt="프로필" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.user_metadata?.display_name || user.user_metadata?.username || '사용자'}
                </div>
                <div style={{ fontSize: '12px', color: '#3498DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  @{user.user_metadata?.username || user.email?.split('@')[0]}
                </div>
                {user.user_metadata?.bio && (
                  <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.25', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.user_metadata.bio}
                  </div>
                )}
              </div>
            </div>
          </div>

          {Array.isArray(adminRecommends) && adminRecommends.length > 0 ? (
            <div
              style={{
                padding: "8px 12px 6px",
                borderBottom: `1px solid ${userCardGlass.hairline.borderColor}`,
                backgroundColor: "rgba(0, 0, 0, 0.22)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                  marginBottom: "6px",
                }}
              >
                추천 등록 (스튜디오·큐레이터 연결)
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  maxHeight: "min(28vh, 200px)",
                  overflowY: "auto",
                }}
              >
                {adminRecommends.map((row, idx) => (
                  <div
                    key={`adm-rec-${row.at}-${idx}`}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(46, 204, 113, 0.12)",
                      border: "1px solid rgba(46, 204, 113, 0.25)",
                    }}
                  >
                    <div
                      style={{
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {row.place_name || "(이름 없음)"}
                    </div>
                    {row.address ? (
                      <div
                        style={{
                          color: "#aaa",
                          fontSize: "10px",
                          marginTop: "2px",
                        }}
                      >
                        {row.address}
                      </div>
                    ) : null}
                    <div style={{ color: "#777", fontSize: "10px", marginTop: "2px" }}>
                      {row.at
                        ? new Date(row.at).toLocaleString("ko-KR")
                        : "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* 탭 버튼 */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${userCardGlass.hairline.borderColor}`,
              backgroundColor: "rgba(0, 0, 0, 0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <button
              type="button"
              onClick={() => handleTabChange("saved")}
              style={{
                flex: 1,
                padding: "9px 8px",
                background:
                  activeTab === "saved"
                    ? "linear-gradient(180deg, rgba(52,152,219,0.52) 0%, rgba(52,152,219,0.3) 100%)"
                    : "transparent",
                color:
                  activeTab === "saved"
                    ? "white"
                    : "rgba(255, 255, 255, 0.55)",
                border: "none",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow:
                  activeTab === "saved"
                    ? "inset 0 1px 0 rgba(255,255,255,0.2)"
                    : "none",
              }}
            >
              ❤️ 내 저장 ({getTotalPlacesCount()})
            </button>
            {hideFollowingTab ? null : (
              <button
                type="button"
                onClick={() => handleTabChange("following")}
                style={{
                  flex: 1,
                  padding: "9px 8px",
                  background:
                    activeTab === "following"
                      ? "linear-gradient(180deg, rgba(52,152,219,0.52) 0%, rgba(52,152,219,0.3) 100%)"
                      : "transparent",
                  color:
                    activeTab === "following"
                      ? "white"
                      : "rgba(255, 255, 255, 0.55)",
                  border: "none",
                  borderLeft: `1px solid ${userCardGlass.hairline.borderColor}`,
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  boxShadow:
                    activeTab === "following"
                      ? "inset 0 1px 0 rgba(255,255,255,0.2)"
                      : "none",
                }}
              >
                🤝 팔로우 큐레이터 ({followingCurators.length})
                {activeTab === "following" && !embeddedAdminReadOnly && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSearch(!showSearch);
                    }}
                    style={{
                      backgroundColor: showSearch
                        ? "rgba(255, 255, 255, 0.3)"
                        : "rgba(255, 255, 255, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: "white",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                  >
                    🔍
                  </div>
                )}
              </button>
            )}
          </div>
          </div>

          {/* 닫기 버튼 — 스와이프 영역 밖 (탭·검색 클릭과 분리) */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: "6px",
              right: "10px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "50%",
              color: "rgba(255, 255, 255, 0.85)",
              fontSize: "18px",
              lineHeight: 1,
              cursor: "pointer",
              zIndex: 10,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            ×
          </button>

          {/* 탭 내용 */}
          <div
            ref={tabScrollRef}
            style={{
              padding: "10px 12px 14px",
              maxHeight: adminTallSheet
                ? "min(58vh, 520px)"
                : "min(34vh, 168px)",
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%)",
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '14px', color: '#999', fontSize: '13px' }}>
                로딩 중...
              </div>
            ) : activeTab === 'saved' ? (
              Object.keys(savedPlaces).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '14px', color: '#999', fontSize: '13px' }}>
                  아직 저장한 장소가 없습니다.
                </div>
              ) : (
                selectedFolder ? (
                  // 선택된 폴더의 상세 리스트 UI
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
                      paddingBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <button 
                        onClick={() => handleFolderClick(null, null)}
                        style={{ 
                          background: 'none', border: 'none', color: '#3498DB', 
                          cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' 
                        }}
                      > 
                        ← 뒤로 
                      </button>
                      <span style={{ fontSize: '14px' }}>{selectedFolder.info?.icon}</span>
                      <span style={{ color: 'white', fontWeight: 'bold' }}>{selectedFolder.info?.name}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {selectedFolder.places.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '12px' }}>
                          이 폴더에 저장된 장소가 없습니다.
                        </div>
                      ) : (
                        selectedFolder.places.map((item, index) => {
                          const { name: placeName, address: placeAddress } =
                            getSavedPlaceDisplayFields(item);
                          return (
                          <div key={item.id || `place-${index}`} style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              ...userCardGlass.panel,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  color: 'white',
                                  fontSize: '13px',
                                  fontWeight: 'bold',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {placeName}
                                </div>
                                {placeAddress ? (
                                <div style={{
                                  color: '#999',
                                  fontSize: '11px',
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {placeAddress}
                                </div>
                                ) : null}
                              </div>
                              {!embeddedAdminReadOnly ? (
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button
                                  onClick={() => {
                                    // 폴더 수정 기능 (폴더 옮기기, 중첩 저장)
                                    console.log('수정 버튼 클릭:', item);
                                    handleEditPlace(item);
                                  }}
                                  style={{
                                    backgroundColor: 'rgba(52, 152, 219, 0.55)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.22)',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                                  }}
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => {
                                    // TODO: 장소 삭제 기능
                                    console.log('삭제 버튼 클릭:', item);
                                    handleDeletePlace(item);
                                  }}
                                  style={{
                                    backgroundColor: 'rgba(231, 76, 60, 0.55)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                                  }}
                                >
                                  삭제
                                </button>
                              </div>
                              ) : null}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={modalStyles.section}>
                    {/* 폴더 그리드 - 2층으로 배치 */}
                    <div style={modalStyles.folderGrid}>
                      {Object.entries(savedPlaces).map(([folderKey, folderData]) => (
                        <button
                          key={folderKey}
                          onClick={() => handleFolderClick(folderKey, folderData)}
                          style={{
                            ...modalStyles.folderButton,
                            borderColor: folderData.folderInfo?.color || '#666',
                            backgroundColor: folderData.places.length > 0 ? 
                              `${folderData.folderInfo?.color}20` : 'transparent'
                          }}
                        >
                          <span style={{ fontSize: '12px', marginBottom: '1px' }}>
                            {folderData.folderInfo?.icon}
                          </span>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 'bold',
                            color: folderData.places.length > 0 ? 
                              folderData.folderInfo?.color : '#999',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {folderData.folderInfo?.name}
                            <span style={{ 
                              fontSize: '8px', 
                              color: '#666',
                              fontWeight: 'normal'
                            }}>
                              ({folderData.places.length})
                            </span>
                          </span>
                        </button>
                      ))}
                      
                      <button
                        onClick={() => {
                          if (embeddedAdminReadOnly) return;
                          alert("새 폴더 만들기 기능은 곧 구현됩니다!");
                        }}
                        style={modalStyles.addFolderButton}
                      >
                        <span style={{ fontSize: "14px" }}>+</span>
                        <span style={{ fontSize: "10px", fontWeight: "bold" }}>
                          새 폴더
                        </span>
                      </button>
                    </div>
                    {embeddedAdminReadOnly &&
                    Array.isArray(adminSavedUnassigned) &&
                    adminSavedUnassigned.length > 0 ? (
                      <div style={{ marginTop: "12px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "rgba(255, 193, 7, 0.95)",
                            marginBottom: "6px",
                          }}
                        >
                          폴더 미연결 저장 (앱 그리드에는 없음)
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                          }}
                        >
                          {adminSavedUnassigned.map((p, idx) => (
                            <div
                              key={`adm-un-${p.at}-${idx}`}
                              style={{
                                padding: "8px 10px",
                                borderRadius: "10px",
                                ...userCardGlass.panel,
                              }}
                            >
                              <div
                                style={{
                                  color: "white",
                                  fontSize: "13px",
                                  fontWeight: "bold",
                                }}
                              >
                                {p.place_name || "(이름 없음)"}
                              </div>
                              {p.address ? (
                                <div
                                  style={{
                                    color: "#999",
                                    fontSize: "11px",
                                    marginTop: "2px",
                                  }}
                                >
                                  {p.address}
                                </div>
                              ) : null}
                              <div
                                style={{
                                  color: "#777",
                                  fontSize: "10px",
                                  marginTop: "4px",
                                }}
                              >
                                {p.at
                                  ? new Date(p.at).toLocaleString("ko-KR")
                                  : "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              )
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* 검색 입력창 */}
                {showSearch && (
                  <div style={{ paddingBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="팔로우한 큐레이터 검색..."
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.22)',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                      }}
                      autoFocus
                    />
                  </div>
                )}
                
                {/* 큐레이터 리스트 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {getFilteredCurators().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#999', fontSize: '12px' }}>
                      {searchQuery ? '검색 결과가 없습니다' : '아직 팔로우한 큐레이터가 없습니다.'}
                    </div>
                  ) : (
                    getFilteredCurators().map((curator) => (
                      <div
                        key={curator.id}
                        style={curatorCardStyles.card}
                      >
                        <div style={curatorCardStyles.info}>
                          <div style={curatorCardStyles.avatar}>
                            {curator.username?.charAt(0)?.toUpperCase() || '👤'}
                          </div>
                          <div style={curatorCardStyles.details}>
                          <div
                            style={{
                              ...curatorCardStyles.name,
                              cursor: embeddedAdminReadOnly ? "default" : "pointer",
                              textDecoration: embeddedAdminReadOnly
                                ? "none"
                                : "underline",
                              textDecorationColor: "rgba(255, 255, 255, 0.3)",
                            }}
                            onClick={() => {
                              if (!embeddedAdminReadOnly) loadCuratorProfile(curator);
                            }}
                          >
                            @{curator.username || "unknown"}
                          </div>
                          <div style={curatorCardStyles.meta}>
                            {curator.bio ? `${curator.bio.slice(0, 20)}...` : '큐레이터'} • {curator.stats?.saveCount || 0} 저장
                          </div>
                        </div>
                        </div>
                        {!embeddedAdminReadOnly ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnfollow(curator.id);
                          }}
                          style={curatorCardStyles.unfollowButton}
                        >
                          언팔로우
                        </button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* 홈 인디케이터·여백: 반투명 틈 없이 시트로 완전 덮음 */}
          <div
            aria-hidden
            style={{
              width: "100%",
              minHeight: "14px",
              height: "max(14px, env(safe-area-inset-bottom, 0px))",
              flexShrink: 0,
              backgroundColor: "#05060a",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          />
        </div>
      </div>

      {/* 큐레이터 프로필 모달 */}
      {selectedCurator && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            ...userCardGlass.overlay,
          }}
        >
          <div
            style={{
              borderRadius: "22px",
              width: "90%",
              maxWidth: "500px",
              maxHeight: "80vh",
              overflow: "hidden",
              ...userCardGlass.sheet,
              boxShadow:
                "0 28px 64px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -1px 0 rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* 큐레이터 프로필 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>
                큐레이터 프로필
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCurator(null)}
                style={{
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "50%",
                  color: "rgba(255, 255, 255, 0.9)",
                  fontSize: "22px",
                  lineHeight: 1,
                  cursor: "pointer",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                }}
              >
                ×
              </button>
            </div>

            {/* 큐레이터 정보 */}
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#3498DB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {selectedCurator.username?.charAt(0)?.toUpperCase() || '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                    @{selectedCurator.username}
                  </div>
                  <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '4px' }}>
                    {selectedCurator.display_name || '큐레이터'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    팔로워 {selectedCurator.stats?.followerCount || 0}명 • 저장 {selectedCurator.stats?.saveCount || 0}개
                  </div>
                </div>
              </div>

              {selectedCurator.bio && (
                <div
                  style={{
                    fontSize: "14px",
                    color: "#e8eaef",
                    lineHeight: "1.45",
                    marginBottom: "20px",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    ...userCardGlass.panel,
                  }}
                >
                  {selectedCurator.bio}
                </div>
              )}

              {/* 저장된 장소 목록 */}
              <div>
                <h4 style={{ color: 'white', fontSize: '14px', marginBottom: '12px' }}>
                  저장한 장소 ({selectedCurator.savedPlaces?.length || 0})
                </h4>
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {selectedCurator.savedPlaces?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                      저장한 장소가 없습니다
                    </div>
                  ) : (
                    selectedCurator.savedPlaces.map((saved) => (
                      <div
                        key={saved.id}
                        style={{
                          padding: "12px",
                          borderRadius: "12px",
                          ...userCardGlass.panel,
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                          {saved.places?.name || '정보 없음'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {saved.places?.address || '주소 정보 없음'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 수정 모달 */}
      {showFolderEditModal && editingPlace && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
            ...userCardGlass.overlay,
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              width: "90%",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflow: "auto",
              padding: "20px",
              ...userCardGlass.sheet,
              boxShadow:
                "0 24px 56px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>
                폴더 수정
              </h3>
              <button
                onClick={() => {
                  setShowFolderEditModal(false);
                  setEditingPlace(null);
                  setSelectedFolders([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              {(() => {
                const { name: editName, address: editAddr } =
                  getSavedPlaceDisplayFields(editingPlace);
                return (
                  <>
                    <div
                      style={{
                        color: "white",
                        fontSize: "14px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      장소: {editName}
                    </div>
                    {editAddr ? (
                      <div
                        style={{
                          color: "#999",
                          fontSize: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        {editAddr}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
                폴더 선택 (다중 선택 가능):
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {Object.entries(savedPlaces).map(([folderKey, folderData]) => {
                  const isSelected = selectedFolders.some(folder => folder.key === folderKey);
                  return (
                    <button
                      key={folderKey}
                      onClick={() => toggleFolderSelection(folderKey, folderData.folderInfo)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        border: `2px solid ${isSelected ? folderData.folderInfo?.color : '#666'}`,
                        borderRadius: '8px',
                        backgroundColor: isSelected ? `${folderData.folderInfo?.color}20` : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? folderData.folderInfo?.color : '#999',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{folderData.folderInfo?.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                        {folderData.folderInfo?.name}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowFolderEditModal(false);
                  setEditingPlace(null);
                  setSelectedFolders([]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleSaveFolderChanges}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3498DB',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserCard;
