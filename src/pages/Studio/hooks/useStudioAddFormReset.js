import { useEffect } from "react";

const INITIAL_FORM_DATA = {
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
};

const INITIAL_MAP_CENTER = { lat: 37.5665, lng: 126.9780 };

/**
 * 「잔 올리기」 탭으로 진입할 때 폼/검색/지도 상태를 깨끗이 초기화한다.
 *
 * 단, 잔 리스트의 「수정」 버튼으로 이 탭에 올 때(`skipAddSectionResetRef.current === true`)
 * 또는 이미 `editingPlaceId`가 잡혀있는 경우엔 폼이 비어버리면 신규 INSERT로 중복
 * 저장되므로 건너뛴다.
 */
export function useStudioAddFormReset({
  activeSection,
  editingPlaceId,
  skipAddSectionResetRef,
  setFormData,
  setAddPlacePhotoFiles,
  setSearchSuggestions,
  setShowSuggestions,
  setSelectedSuggestionIndex,
  setSearchedPlaces,
  setMapCenter,
  setEditingPlaceId,
}) {
  useEffect(() => {
    if (activeSection !== "add") return;
    if (skipAddSectionResetRef.current) {
      skipAddSectionResetRef.current = false;
      return;
    }
    if (editingPlaceId) return;
    setFormData({ ...INITIAL_FORM_DATA });
    setAddPlacePhotoFiles([]);

    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setSearchedPlaces([]);
    setMapCenter(INITIAL_MAP_CENTER);
    setEditingPlaceId(null);
    try {
      localStorage.removeItem("editing_place_id");
    } catch {
      /* ignore */
    }
  }, [
    activeSection,
    editingPlaceId,
    skipAddSectionResetRef,
    setFormData,
    setAddPlacePhotoFiles,
    setSearchSuggestions,
    setShowSuggestions,
    setSelectedSuggestionIndex,
    setSearchedPlaces,
    setMapCenter,
    setEditingPlaceId,
  ]);
}
