import { useState } from "react";
import { normalizeStudioPlaceCategory } from "../../../utils/placeTaxonomy.js";
import { devLog, devWarn } from "../studioHomeModule.js";

/** 자주 쓰는 태그 (핵심 24개) — 잔 올리기 폼 상단의 「⭐ 자주 쓰는 태그」. */
export const FREQUENT_PLACE_TAGS = [
  "혼술", "낮술", "데이트", "소개팅", "1차", "2차", "회식", "친구모임", "가족모임",
  "야장", "룸 있음", "24시간", "가성비", "안주맛집",
  "성시경", "성시경맛집", "최자", "최자맛집", "소안맛집", "소주안주맛집",
  "사장님 친절",
  "사장님 불친절",
  "직원 친절",
  "직원 불친절",
];

/** 카테고리별 전체 태그 — 「📂 전체 태그 보기」 펼침 영역과 자동완성 매칭에 함께 사용. */
export const ALL_PLACE_TAGS = {
  "🍺 상황": ["혼술", "낮술", "데이트", "소개팅", "1차", "2차", "회식", "친구모임", "가족모임"],
  "🔥 특징": ["야장", "바테이블(닷지)", "늦게까지", "24시간", "웨이팅있음", "가성비", "안주맛집", "술이맛있음", "시그니처있음"],
  "🎭 감성": ["노포감성", "로컬맛집", "감성술집", "숨은맛집"],
  "📺 화제": ["성시경", "성시경맛집", "최자", "최자맛집", "소안맛집", "소주안주맛집"],
  "🍽 안주": ["국물안주", "해산물강함", "고기안주", "가벼운안주", "안주다양"],
  "🧭 공간": ["단체가능", "테이블넓음", "룸 있음", "예약필수", "웨이팅짧음", "2차추천"],
  "🚽 화장실": ["실내 화장실", "외부 화장실", "위생적인", "비위생적인"],
  "🙋 맞이·서비스": [
    "사장님 친절",
    "사장님 불친절",
    "직원 친절",
    "직원 불친절",
  ],
};

const ALL_PLACE_TAGS_LIST = Object.values(ALL_PLACE_TAGS).flat();

/**
 * 스튜디오 「잔 올리기」 폼의 검색·자동완성·태그 입력·폴더 토글 로직을 한 곳에 모은 훅.
 *
 * - formData / setFormData / mapRef / setMapCenter / setSearchedPlaces 등은 부모에서 받는다
 *   (`useStudioPlaceActions`도 같은 setter를 공유하므로 단일 출처는 부모가 유지).
 * - addPlaceNewFolder* state는 부모에서 그대로 두고 setter를 받는다 — 신규/임시저장 후
 *   `useStudioPlaceActions.handleAddPlace`가 폼을 초기화할 때 같은 setter를 다시 호출.
 */
export function useStudioAddPlaceForm({
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
}) {
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const [tagInputValue, setTagInputValue] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);

  const fetchSuggestions = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;

      if (!apiKey) {
        console.error("❌ 카카오 REST API 키가 없습니다.");
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const response = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
        {
          headers: {
            Authorization: `KakaoAK ${apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`검색 실패: ${response.status}`);
      }

      const data = await response.json();

      if (data.documents && data.documents.length > 0) {
        const suggestions = data.documents.map((doc) => ({
          place_name: doc.place_name,
          address_name: doc.address_name || doc.road_address_name,
          category_name: doc.category_name,
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x),
          kakao_place_id: doc.id != null ? String(doc.id) : null,
        }));

        setSearchSuggestions(suggestions);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(-1);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("자동완성 검색 오류:", error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleTagInputChange = (value) => {
    setTagInputValue(value);

    if (value.trim().length > 0) {
      const matches = ALL_PLACE_TAGS_LIST.filter((tag) =>
        tag.toLowerCase().includes(value.toLowerCase().trim())
      );
      setTagSuggestions(matches.slice(0, 5));
    } else {
      setTagSuggestions([]);
    }
  };

  const handleTagSuggestionClick = (tag) => {
    if (!formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInputValue("");
    setTagSuggestions([]);
  };

  const handleInputChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      name_address: value,
      kakao_place_id: null,
    }));
    fetchSuggestions(value);
  };

  const handleSuggestionClick = (suggestion) => {
    const sid =
      suggestion?.kakao_place_id ||
      (suggestion?.id != null ? String(suggestion.id) : null);
    const kid = sid && /^\d+$/.test(String(sid)) ? String(sid) : null;
    const lat = suggestion.lat;
    const lng = suggestion.lng;
    const latOk =
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      typeof lng === "number" &&
      Number.isFinite(lng);

    setFormData((prev) => ({
      ...prev,
      name_address: suggestion.place_name || suggestion,
      latitude: latOk ? lat : null,
      longitude: latOk ? lng : null,
      kakao_place_id: kid,
      category: normalizeStudioPlaceCategory(suggestion.category_name || ""),
    }));
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);

    if (latOk) {
      setMapCenter({ lat, lng });
      setSearchedPlaces([
        {
          place_name: suggestion.place_name,
          address_name: suggestion.address_name,
          y: String(lat),
          x: String(lng),
          kakao_place_id: kid,
        },
      ]);
      try {
        mapRef.current?.moveToLocation?.(lat, lng);
      } catch {
        /* ignore */
      }
    }
  };

  const handleSearch = async () => {
    if (!formData.name_address.trim()) {
      alert("검색어를 입력해주세요.");
      return;
    }

    devLog("🔍 StudioHome 검색 시작:", formData.name_address);

    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    devLog("🔑 API 키 확인:", apiKey ? "있음" : "없음");

    if (!apiKey) {
      console.error("❌ 카카오 REST API 키가 없습니다.");
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }

    const preferredKakaoId =
      formData.kakao_place_id &&
      /^\d+$/.test(String(formData.kakao_place_id))
        ? String(formData.kakao_place_id)
        : null;

    try {
      const skipAddressSearch = Boolean(preferredKakaoId);

      if (!skipAddressSearch) {
        devLog("📍 주소 검색 시도...");
        const addressResponse = await fetch(
          `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(formData.name_address)}&size=1`,
          {
            headers: {
              Authorization: `KakaoAK ${apiKey}`,
            },
          }
        );

        devLog("📋 주소 검색 응답 상태:", addressResponse.status);

        if (!addressResponse.ok) {
          console.error(
            "❌ 주소 검색 실패:",
            addressResponse.status,
            addressResponse.statusText
          );
          throw new Error(`주소 검색 실패: ${addressResponse.status}`);
        }

        const addressData = await addressResponse.json();
        devLog("📋 주소 검색 결과:", addressData);

        if (addressData.documents && addressData.documents.length > 0) {
          const firstResult = addressData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);

          devLog("✅ 주소 찾음:", { lat, lng, address: firstResult.address_name });

          setFormData((prev) => ({
            ...prev,
            name_address: firstResult.address_name || formData.name_address,
            latitude: lat,
            longitude: lng,
            kakao_place_id: null,
          }));

          setMapCenter({ lat, lng });

          setSearchedPlaces([
            {
              place_name: firstResult.address_name || formData.name_address,
              address_name: firstResult.address_name,
              y: lat.toString(),
              x: lng.toString(),
              kakao_place_id: null,
            },
          ]);
          try {
            mapRef.current?.moveToLocation?.(lat, lng);
          } catch {
            /* ignore */
          }
          return;
        }
      }

      devLog("🔍 키워드 검색 시도...");
      const keywordResponse = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(formData.name_address)}&size=15`,
        {
          headers: {
            Authorization: `KakaoAK ${apiKey}`,
          },
        }
      );

      devLog("📋 키워드 검색 응답 상태:", keywordResponse.status);

      if (!keywordResponse.ok) {
        console.error(
          "❌ 키워드 검색 실패:",
          keywordResponse.status,
          keywordResponse.statusText
        );
        throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
      }

      const keywordData = await keywordResponse.json();
      devLog("📋 키워드 검색 결과:", keywordData);

      const docs = keywordData.documents || [];
      let chosen =
        preferredKakaoId != null
          ? docs.find((d) => String(d.id) === preferredKakaoId)
          : null;
      if (!chosen && docs.length > 0) {
        chosen = docs[0];
      }

      if (
        !chosen &&
        preferredKakaoId &&
        formData.latitude != null &&
        formData.longitude != null
      ) {
        const lat = Number(formData.latitude);
        const lng = Number(formData.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          devLog(
            "✅ 키워드 목록에 없음 — 자동완성에서 받은 좌표 유지:",
            preferredKakaoId
          );
          setMapCenter({ lat, lng });
          setSearchedPlaces([
            {
              place_name: formData.name_address,
              address_name: formData.name_address,
              y: String(lat),
              x: String(lng),
              kakao_place_id: preferredKakaoId,
            },
          ]);
          try {
            mapRef.current?.moveToLocation?.(lat, lng);
          } catch {
            /* ignore */
          }
          return;
        }
      }

      if (!chosen) {
        devWarn("⚠️ 검색 결과 없음");
        alert("검색 결과를 찾을 수 없습니다. 지도를 클릭하여 위치를 선택해주세요.");
        return;
      }

      const lat = parseFloat(chosen.y);
      const lng = parseFloat(chosen.x);

      devLog("✅ 키워드 찾음:", { lat, lng, place: chosen.place_name });

      const kpId =
        chosen.id != null && /^\d+$/.test(String(chosen.id))
          ? String(chosen.id)
          : null;
      setFormData((prev) => ({
        ...prev,
        name_address: chosen.place_name,
        latitude: lat,
        longitude: lng,
        kakao_place_id: kpId,
      }));

      setMapCenter({ lat, lng });

      const searchResult = [
        {
          place_name: chosen.place_name,
          address_name: chosen.address_name || chosen.road_address_name,
          y: String(chosen.y),
          x: String(chosen.x),
          kakao_place_id: kpId,
        },
      ];

      devLog("🔍 검색 결과 데이터:", searchResult);
      setSearchedPlaces(searchResult);
      try {
        mapRef.current?.moveToLocation?.(lat, lng);
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.error("❌ StudioHome 검색 오류:", error);
      alert("검색 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < searchSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > -1 ? prev - 1 : -1));
        break;
      case "Enter":
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          handleSuggestionClick(searchSuggestions[selectedSuggestionIndex]);
        } else {
          e.preventDefault();
          handleSearch();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
      default:
        break;
    }
  };

  const toggleAddPlaceFolder = (folderKey) => {
    setAddPlaceSelectedFolders((prev) =>
      prev.includes(folderKey)
        ? prev.filter((k) => k !== folderKey)
        : [...prev, folderKey]
    );
  };

  const handleAddPlaceCustomFolder = async () => {
    const name = addPlaceNewFolderName.trim();
    if (!name) return;
    setAddPlaceNewFolderSaving(true);
    try {
      const res = await insertCustomSystemFolderRow(name);
      if (!res.ok) {
        if (res.error) {
          alert(
            res.error.message ||
              "폴더를 추가하지 못했습니다. Supabase에 INSERT 정책이 있는지 확인하세요."
          );
        }
        return;
      }
      setAddPlaceNewFolderName("");
      setAddPlaceShowNewFolder(false);
      if (res.key) {
        setAddPlaceSelectedFolders((prev) =>
          prev.includes(res.key) ? prev : [...prev, res.key]
        );
      }
    } finally {
      setAddPlaceNewFolderSaving(false);
    }
  };

  return {
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
    frequentTags: FREQUENT_PLACE_TAGS,
    allTags: ALL_PLACE_TAGS,
    allTagsList: ALL_PLACE_TAGS_LIST,
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
  };
}
