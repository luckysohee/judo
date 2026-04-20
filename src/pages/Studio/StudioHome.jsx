import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  uploadCuratorPlacePhoto,
  uploadCuratorProfileAvatarFile,
} from "../../utils/curatorPlacePhotos";
import {
  isAcceptableRasterImageFile,
  prepareImageFileForUpload,
} from "../../utils/prepareImageFileForUpload";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/Toast/ToastProvider";
import { createClient } from '@supabase/supabase-js';
import MapView from "../../components/Map/MapView";
import { 
  calculateRecommendationScore, 
  analyzeUserPreferences, 
  generateRecommendations,
  findSimilarCurators,
  findCoSavedPlaces,
  calculateCuratorLevel
} from "../../utils/recommendationEngine";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
import { isUsernameChangeCooldownError } from "../../utils/usernameCooldown";
import {
  countStudioFollowingDistinct,
  fetchStudioFollowersEnriched,
  resolveFollowerPresentation,
} from "../../utils/studioFollowersFetch";
import { upsertUserSavedPlaceFolders } from "../../utils/upsertUserSavedPlaceFolders";
import {
  selectSystemFoldersOrdered,
  insertSystemFolderRow,
  deleteOwnCustomSystemFolder,
} from "../../utils/systemFoldersSupabase";
import {
  STUDIO_ATMOSPHERE_OPTIONS,
  STUDIO_LIQUOR_TYPE_OPTIONS,
} from "../../utils/placeTaxonomy.js";
import { fetchCuratorPlacesMergedWithPlaces } from "../../utils/supabasePlaces";

/** DB·마이그레이션에 따라 프로필 사진 컬럼명이 다를 수 있음 */
function isLikelyMissingCuratorImageColumnError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = error.code;
  return (
    code === "42703" ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("schema cache") ||
    msg.includes("could not find the") ||
    msg.includes("unknown column")
  );
}

const FALLBACK_SAVED_FOLDER_DEFS = [
  { key: "after_party", name: "2차", color: "#FF8C42", icon: "🍺", sort_order: 1 },
  { key: "date", name: "데이트", color: "#FF69B4", icon: "💘", sort_order: 2 },
  { key: "hangover", name: "해장", color: "#87CEEB", icon: "🥣", sort_order: 3 },
  { key: "solo", name: "혼술", color: "#9B59B6", icon: "👤", sort_order: 4 },
  { key: "group", name: "회식", color: "#F1C40F", icon: "👥", sort_order: 5 },
  { key: "must_go", name: "찐맛집", color: "#27AE60", icon: "🌟", sort_order: 6 },
  { key: "terrace", name: "야외/뷰", color: "#5DADE2", icon: "🌅", sort_order: 7 },
];

/** 잔 리스트·편집: 이 7개만 삭제 불가, 그 외 키는 사용자 추가 폴더로 간주 */
const SYSTEM_SAVED_FOLDER_KEY_SET = new Set(
  FALLBACK_SAVED_FOLDER_DEFS.map((def) => def.key)
);

function isDeletableUserSavedFolderKey(key) {
  return key != null && !SYSTEM_SAVED_FOLDER_KEY_SET.has(String(key));
}

function studioSavedPlaceLabel(item) {
  if (!item || typeof item !== "object") return "이름 없음";
  const row = item.places ?? item.place;
  const name =
    row?.name ??
    row?.place_name ??
    row?.title ??
    item.place_name ??
    item.name ??
    "";
  return String(name || "").trim() || "이름 없음";
}

function studioSavedPlaceId(item) {
  if (!item || typeof item !== "object") return null;
  const row = item.places;
  if (row && row.id != null) return String(row.id);
  if (item.place_id != null) return String(item.place_id);
  return null;
}

/** 스튜디오 성장 추이 미니차트: 라벨·stroke가 박스 밖으로 안 나가게 y% 클램프 */
function growthTrendLineYPercent(value, scale) {
  const s = Number(scale);
  if (!Number.isFinite(s) || s <= 0) return 50;
  const v = Math.max(0, Number(value) || 0);
  const pct = 100 - (v / s) * 100;
  return Math.min(96, Math.max(4, pct));
}

/** 같은 place에 본인 curator_id(auth uid) 중복이면 한 행만 — 최신 우선, 동순이면 `places`가 붙은 행 우선 */
function dedupeCuratorPlacesByPlaceId(curatorPlacesData) {
  const groups = new Map();
  for (const cp of curatorPlacesData || []) {
    const pid = cp?.places?.id ?? cp?.place_id;
    if (pid == null) continue;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid).push(cp);
  }
  const out = [];
  for (const [, rows] of groups) {
    rows.sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      const ah = a?.places?.id ? 1 : 0;
      const bh = b?.places?.id ? 1 : 0;
      return bh - ah;
    });
    out.push(rows[0]);
  }
  return out;
}

/**
 * 잔 올리기: places 행은 kakao_place_id 로 재사용해도 curator_places 는 매번 INSERT 하면 동일 place_id 로 여러 줄이 생김.
 * 기존 본인 행이 있으면 UPDATE, 중복 행은 삭제 후 하나만 유지.
 */
async function upsertCuratorPlaceForStudio(
  supabase,
  authUserId,
  placeUuid,
  {
    display_name,
    one_line_reason = "",
    tags = [],
    alcohol_types = [],
    moods = [],
  }
) {
  const pid = String(placeUuid).trim();
  const safeArr = (a) => (Array.isArray(a) ? a : []);
  const patch = {
    display_name,
    one_line_reason,
    tags: safeArr(tags),
    alcohol_types: safeArr(alcohol_types),
    moods: safeArr(moods),
  };

  const { data: rows, error: selErr } = await supabase
    .from("curator_places")
    .select("id, curator_id, created_at")
    .eq("place_id", pid)
    .eq("curator_id", authUserId);
  if (selErr) return { data: null, error: selErr };

  const list = rows || [];
  let result;
  if (list.length === 0) {
    result = await supabase
      .from("curator_places")
      .insert([
        {
          curator_id: authUserId,
          place_id: pid,
          ...patch,
        },
      ])
      .select();
  } else {
    const canonical =
      list.find((r) => String(r.curator_id) === String(authUserId)) || list[0];
    for (const d of list.filter((r) => r.id !== canonical.id)) {
      const { error: delErr } = await supabase
        .from("curator_places")
        .delete()
        .eq("id", d.id);
      if (delErr) {
        console.warn("curator_places dedupe delete:", delErr);
      }
    }

    result = await supabase
      .from("curator_places")
      .update(patch)
      .eq("id", canonical.id)
      .select();
  }

  if (!result.error) {
    const { error: rpcErr } = await supabase.rpc(
      "studio_patch_curator_place_taxonomy",
      {
        p_place_id: pid,
        p_tags: patch.tags,
        p_moods: patch.moods,
        p_alcohol_types: patch.alcohol_types,
      }
    );
    if (rpcErr) {
      console.warn(
        "studio_patch_curator_place_taxonomy (Supabase 마이그레이션 적용 필요):",
        rpcErr.message
      );
    }
  }

  return result;
}

/** DB·API에서 tags 등이 json 문자열·비배열로 올 때 폼용 문자열 배열로 */
function parseDbStringArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const j = JSON.parse(t);
        return parseDbStringArray(j);
      } catch {
        /* fallthrough */
      }
    }
    if (t.startsWith("{") && t.endsWith("}") && !t.startsWith("[{")) {
      return t
        .slice(1, -1)
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((s) => s.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
    return t.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** studio_archive_extended_insights RPC → UI용 객체 */
function normalizeStudioArchiveExtendedInsights(raw) {
  let parsed = raw;
  if (typeof parsed === "string" && parsed.trim()) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return {
      oneLineTop: [],
      style: {
        alcohol: [],
        moods: [],
        tags: [],
        categories: [],
      },
      followers: {
        savesOnPicks: 0,
        distinctSavers: 0,
        regions: [],
        checkinsTotal: 0,
      },
    };
  }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const pctRows = (rows) =>
    arr(rows)
      .map((r) => ({
        label: String(r?.label ?? "").trim(),
        pct: Math.min(100, Math.max(0, Number(r?.pct) || 0)),
      }))
      .filter((r) => r.label);
  return {
    oneLineTop: arr(parsed.one_line_top)
      .map((r) => ({
        text: String(r?.text ?? "").trim(),
        saves: Number(r?.saves) || 0,
        placeId: r?.place_id != null ? String(r.place_id) : null,
        placeName: String(r?.place_name ?? "").trim(),
      }))
      .filter((r) => r.text),
    style: {
      alcohol: pctRows(parsed.style?.alcohol),
      moods: pctRows(parsed.style?.moods),
      tags: pctRows(parsed.style?.tags),
      categories: pctRows(parsed.style?.categories),
    },
    followers: {
      savesOnPicks: Number(parsed.followers?.saves_on_picks) || 0,
      distinctSavers: Number(parsed.followers?.distinct_savers) || 0,
      regions: arr(parsed.followers?.regions).map((r) => ({
        label: (String(r?.label ?? "기타").trim() || "기타"),
        saves: Number(r?.saves) || 0,
      })),
      checkinsTotal:
        Number(
          parsed.followers?.checkins_total ?? parsed.followers?.checkins_30d
        ) || 0,
    },
  };
}

/** 잔 올리기 카테고리 셀렉트 고정 목록 — 그 외 저장값은 동적 option 으로 표시 */
const STUDIO_PLACE_CATEGORY_OPTIONS = [
  "한식",
  "중식",
  "일식",
  "양식",
  "육류",
  "해산물",
  "디저트",
  "미분류",
];

/** 잔 올리기 셀렉트에 넣지 않을 레거시·가져오기용 카테고리 문자열 → 표준값 */
function normalizeStudioPlaceCategory(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (STUDIO_PLACE_CATEGORY_OPTIONS.includes(s)) return s;
  if (/순대|순댓/i.test(s)) return "한식";
  return s;
}

function mapCuratorJoinRowsToMyPlaces(curatorPlacesData) {
  return (curatorPlacesData || []).map((curatorPlace) => {
    const place = curatorPlace.places;
    const alc = parseDbStringArray(curatorPlace.alcohol_types);
    const moodArr = parseDbStringArray(curatorPlace.moods);
    const line =
      curatorPlace.one_line_reason != null &&
      curatorPlace.one_line_reason !== undefined
        ? String(curatorPlace.one_line_reason)
        : null;
    const archived = curatorPlace.is_archived === true;
    const isPublicListed = !archived;

    if (!place?.id && curatorPlace.place_id) {
      const nm = String(curatorPlace.display_name || "").trim();
      return {
        id: curatorPlace.place_id,
        name: nm || "장소 상세를 불러오지 못했습니다",
        address:
          "curator_places에는 있으나 places 행을 조회하지 못했습니다. RLS·네트워크·place_id를 확인하세요.",
        latitude: null,
        longitude: null,
        kakao_place_id: null,
        category: "미분류",
        alcohol_type: alc[0] ?? "",
        atmosphere: moodArr[0] ?? "",
        recommended_menu: "",
        menu_reason: line ?? "",
        tags: filterPlaceTagsForDisplay(parseDbStringArray(curatorPlace.tags)),
        alcohol_types: alc,
        moods: moodArr,
        is_public: isPublicListed,
        created_at: new Date().toISOString().split("T")[0],
        curator_place_id: curatorPlace.id,
        _studioPlaceLoadFailed: true,
      };
    }
    if (!place?.id) return null;

    const tagsCp = parseDbStringArray(curatorPlace.tags);
    const tagsPl = parseDbStringArray(place.tags);
    const tagsMerged = tagsCp.length ? tagsCp : tagsPl;
    return {
      id: place.id,
      name: place.name,
      address: place.address || place.name,
      latitude: place.lat,
      longitude: place.lng,
      kakao_place_id: place.kakao_place_id ?? null,
      category: normalizeStudioPlaceCategory(place.category || "") || "미분류",
      alcohol_type: alc[0] ?? place.alcohol_type ?? "",
      atmosphere: moodArr[0] ?? place.atmosphere ?? "",
      recommended_menu: place.recommended_menu || "",
      menu_reason: line !== null ? line : (place.menu_reason || ""),
      tags: filterPlaceTagsForDisplay(tagsMerged),
      alcohol_types: alc,
      moods: moodArr,
      is_public: isPublicListed,
      created_at: place.created_at
        ? new Date(place.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      curator_place_id: curatorPlace.id,
    };
  }).filter(Boolean);
}

/**
 * curators 행에 프로필 이미지 저장 (avatar_url → avatar → image 순으로 시도)
 */
async function persistCuratorProfileImageToSupabase(supabaseClient, userId, imageUrl) {
  const updatedAt = new Date().toISOString();
  const patches = [{ avatar_url: imageUrl }, { avatar: imageUrl }, { image: imageUrl }];
  let lastError = null;
  for (const patch of patches) {
    const { error } = await supabaseClient
      .from("curators")
      .update({ ...patch, updated_at: updatedAt })
      .eq("user_id", userId);
    if (!error) {
      return { ok: true };
    }
    lastError = error;
    if (isLikelyMissingCuratorImageColumnError(error)) {
      continue;
    }
    return { ok: false, error };
  }
  return {
    ok: false,
    error:
      lastError ||
      new Error("프로필 사진 컬럼(avatar_url / avatar / image)을 찾을 수 없습니다."),
  };
}

// 섹션 컴포넌트들
const NewPlaceSection = ({ curator, setMyPlaces, setActiveSection }) => {
  const [step, setStep] = useState(1);
  const mapRef = useRef(null); // 지도 ref 추가
  const [searchSuggestions, setSearchSuggestions] = useState([]); // 검색 제안
  const [showSuggestions, setShowSuggestions] = useState(false); // 제안 표시 여부
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1); // 선택된 제안 인덱스
  const [basicInfo, setBasicInfo] = useState({
    name_address: "", // 가게 이름과 주소 합치기
    phone: "",
    category: "",
    atmosphere: "",
    recommended_menu: "",
    menu_reason: "",
    tags: [],
    latitude: null,
    longitude: null,
  });
  const [curationInfo, setCurationInfo] = useState({
    one_line_review: "",
    visit_situations: [],
    price_range: "",
    visit_tips: "",
  });
  const [publishInfo, setPublishInfo] = useState({
    is_public: true,
    is_featured: false,
  });
  const [mapPlaces, setMapPlaces] = useState([]); // 지도에 표시할 장소들

  const handleSaveDraft = () => {
    alert("임시저장 기능은 곧 구현됩니다!");
  };

  const handleSubmit = async () => {
    try {
      // 필수 필드 확인
      if (!basicInfo.name_address || !basicInfo.latitude || !basicInfo.longitude) {
        alert("장소 이름과 위치를 선택해주세요.");
        return;
      }

      // curator 확인
      if (!curator || !curator.id) {
        alert("큐레이터 정보가 없습니다. 다시 로그인해주세요.");
        return;
      }

      console.log("curator 정보:", curator); // 디버깅용 로그

      // 새 장소 데이터 생성
      const newPlace = {
        curator: curator.id, // curator_id -> curator로 변경
        name: basicInfo.name_address,
        address: basicInfo.name_address,
        phone: basicInfo.phone || null,
        category: basicInfo.category || null,
        atmosphere: basicInfo.atmosphere || null,
        recommended_menu: basicInfo.recommended_menu || null,
        menu_reason: basicInfo.menu_reason || null,
        tags: basicInfo.tags || [],
        latitude: basicInfo.latitude,
        longitude: basicInfo.longitude,
        one_line_review: curationInfo.one_line_review || null,
        visit_situations: curationInfo.visit_situations || [],
        price_range: curationInfo.price_range || null,
        visit_tips: curationInfo.visit_tips || null,
        is_public: publishInfo.is_public,
        is_featured: publishInfo.is_featured || false,
        created_at: new Date().toISOString(),
      };

      console.log("저장할 데이터:", newPlace); // 디버깅용 로그

      // Supabase에 장소 저장
      const { data, error } = await supabase
        .from("places")
        .insert([newPlace])
        .select();

      if (error) {
        console.error("장소 저장 오류:", error);
        alert(`장소 저장에 실패했습니다.\n오류: ${error.message}\n코드: ${error.code || '알 수 없음'}`);
        return;
      }

      // 성공적으로 저장된 경우
      if (data && data.length > 0) {
        // 폼 초기화
        setBasicInfo({
          name_address: "",
          phone: "",
          category: "",
          atmosphere: "",
          recommended_menu: "",
          menu_reason: "",
          tags: [],
          latitude: null,
          longitude: null,
        });
        setCurationInfo({
          one_line_review: "",
          visit_situations: [],
          price_range: "",
          visit_tips: "",
        });
        setPublishInfo({
          is_public: true,
          is_featured: false,
        });
        setMapPlaces([]);
        
        // '내 장소 리스트' 섹션으로 이동
        setActiveSection("places");
      }
    } catch (error) {
      console.error("장소 추가 중 오류:", error);
      alert("장소 추가에 실패했습니다.");
    }
  };

  // 섹션 변경 시 변경사항 확인
  const handleSectionChange = (newSection) => {
    console.log("섹션 변경 시도:", { 
      currentSection: activeSection, 
      newSection, 
      hasUnsavedChanges 
    });
    
    // 잔 리스트에서 공개/비공개 변경 감지
    if (activeSection === "list" && hasUnsavedChanges) {
      const shouldSave = window.confirm("공개/비공개 상태 변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음");
      
      if (shouldSave) {
        console.log("저장 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      } else {
        console.log("저장 안 함 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      }
    } else if (hasUnsavedChanges) {
      const shouldSave = window.confirm("변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장하기\n취소: 저장하지 않음");
      
      if (shouldSave) {
        console.log("저장 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      } else {
        console.log("저장 안 함 선택");
        setHasUnsavedChanges(false);
        setActiveSection(newSection);
      }
    } else {
      console.log("변경사항 없음 - 바로 이동");
      setActiveSection(newSection);
    }
  };

  // 지도 클릭 핸들러
  const handleMapClick = (lat, lng) => {
    setBasicInfo({
      ...basicInfo,
      latitude: lat,
      longitude: lng,
    });
    
    // 지도에 마커 추가
    const newPlace = {
      id: "temp",
      name: basicInfo.name_address || "새 장소",
      lat: lat, // lat으로 변경
      lng: lng, // lng으로 변경
      address: basicInfo.name_address || "",
    };
    setMapPlaces([newPlace]);
  };

  // 지도 중심 이동 함수
  const moveMapToLocation = (lat, lng) => {
    // MapView의 ref를 통해 지도 중심 이동
    if (mapRef.current && mapRef.current.moveToLocation) {
      mapRef.current.moveToLocation(lat, lng);
    }
  };

  // 장소명/주소 변경 핸들러
  const handleNameAddressChange = (value) => {
    setBasicInfo({
      ...basicInfo,
      name_address: value,
    });
    
    // 연관 검색 제안 가져오기
    fetchSearchSuggestions(value);
    
    // 선택된 인덱스 초기화
    setSelectedSuggestionIndex(-1);
    
    // 지도에 있는 마커도 업데이트
    if (basicInfo.latitude && basicInfo.longitude) {
      const updatedPlace = {
        id: "temp",
        name: value,
        lat: basicInfo.latitude,
        lng: basicInfo.longitude,
        address: value || "",
      };
      setMapPlaces([updatedPlace]);
    }
  };

  // 주소 검색 함수
  const searchAddress = async (query) => {
    console.log("🔍 검색 시작:", query);
    
    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    console.log("🔑 API 키 확인:", apiKey ? "있음" : "없음");
    console.log("🔑 API 키 길이:", apiKey?.length || 0);

    if (!apiKey) {
      console.error("❌ 카카오 REST API 키가 없습니다.");
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }

    try {
      console.log("📍 주소 검색 시도...");
      // 주소 검색
      const addressResponse = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });
      
      console.log("📋 주소 검색 응답 상태:", addressResponse.status);
      
      if (!addressResponse.ok) {
        console.error("❌ 주소 검색 실패:", addressResponse.status, addressResponse.statusText);
        throw new Error(`주소 검색 실패: ${addressResponse.status}`);
      }

      const addressData = await addressResponse.json();
      console.log("📋 주소 검색 결과:", addressData);

      if (addressData.documents && addressData.documents.length > 0) {
        const firstResult = addressData.documents[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        
        console.log("✅ 주소 찾음:", { lat, lng, address: firstResult.address_name });
        
        // 상태 업데이트
        setBasicInfo({
          ...basicInfo,
          latitude: lat,
          longitude: lng,
        });
        
        // 지도 중심 이동
        moveMapToLocation(lat, lng);
      } else {
        // 키워드 검색 (장소명으로 검색)
        console.log("🔍 키워드 검색 시도...");
        const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
          headers: {
            "Authorization": `KakaoAK ${apiKey}`
          }
        });
        
        console.log("📋 키워드 검색 응답 상태:", keywordResponse.status);
        
        if (!keywordResponse.ok) {
          console.error("❌ 키워드 검색 실패:", keywordResponse.status, keywordResponse.statusText);
          throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
        }

        const keywordData = await keywordResponse.json();
        console.log("📋 키워드 검색 결과:", keywordData);

        if (keywordData.documents && keywordData.documents.length > 0) {
          const firstResult = keywordData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);
          
          console.log("✅ 키워드 찾음:", { lat, lng, place: firstResult.place_name });
          
          // 상태 업데이트
          setBasicInfo({
            ...basicInfo,
            latitude: lat,
            longitude: lng,
          });
          
          // alert(`"${firstResult.place_name}" 위치를 찾았습니다!`);
          
          // 지도 중심 이동
          moveMapToLocation(lat, lng);
        } else {
          alert("검색 결과를 찾을 수 없습니다. 지도를 클릭하여 위치를 선택해주세요.");
        }
      }
    } catch (error) {
      console.error("주소 검색 오류:", error);
      alert("검색 중 오류가 발생했습니다. 지도를 클릭하여 위치를 선택해주세요.");
    }
  };

  // 검색 버튼 클릭 핸들러
  const handleSearch = () => {
    const query = basicInfo.name_address.trim();
    if (!query) {
      alert("검색어를 입력해주세요.");
      return;
    }
    searchAddress(query);
  };

  // 화살표키 핸들러
  const handleKeyDown = (e) => {
    if (!showSuggestions || searchSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = selectedSuggestionIndex < searchSuggestions.length - 1 
          ? selectedSuggestionIndex + 1 
          : 0;
        setSelectedSuggestionIndex(nextIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = selectedSuggestionIndex > 0 
          ? selectedSuggestionIndex - 1 
          : searchSuggestions.length - 1;
        setSelectedSuggestionIndex(prevIndex);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionClick(searchSuggestions[selectedSuggestionIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // 엔터키 검색 핸들러
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // 연관 검색 제안 함수
  const fetchSearchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    if (!apiKey) return;

    try {
      // 키워드 검색으로 연관 장소 찾기
      const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const suggestions = data.documents.map(doc => ({
          place_name: doc.place_name,
          address_name: doc.address_name || doc.road_address_name,
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x)
        }));
        setSearchSuggestions(suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("검색 제안 오류:", error);
    }
  };

  // 검색어 초기화 핸들러
  const handleClearSearch = () => {
    setBasicInfo({
      ...basicInfo,
      name_address: "",
    });
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setMapPlaces([]);
    setBasicInfo(prev => ({
      ...prev,
      latitude: null,
      longitude: null,
    }));
  };
  // 검색 제안 선택 핸들러
  const handleSuggestionClick = (suggestion) => {
    setBasicInfo({
      ...basicInfo,
      name_address: suggestion.place_name,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
    });
    
    const newPlace = {
      id: "temp",
      name: suggestion.place_name,
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address_name,
    };
    setMapPlaces([newPlace]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    moveMapToLocation(suggestion.lat, suggestion.lng);
  };

  return (
    <div style={sectionStyles.stepContainer}>
      <div style={sectionStyles.stepIndicator}>
        {[1, 2, 3].map((num) => (
          <div key={num} style={sectionStyles.stepDot}>
            <div style={{
              ...sectionStyles.stepDotInner,
              backgroundColor: step >= num ? "#2ECC71" : "#333333"
            }} />
            <span style={sectionStyles.stepDotText}>{num}단계</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={sectionStyles.step}>
          <h2 style={sectionStyles.stepTitle}>1단계: 기본 정보</h2>
          <div style={sectionStyles.form}>
            <div style={sectionStyles.formGroup}>
              <div style={{position: 'relative', zIndex: 6}}>
                <div style={sectionStyles.searchWrapper}>
                  <input
                    type="text"
                    value={basicInfo.name_address}
                    onChange={(e) => handleNameAddressChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="장소 또는 주소를 입력하세요"
                    style={sectionStyles.searchInput}
                    tabIndex={1}
                  />
                  {basicInfo.name_address && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{
                        position: 'absolute',
                        right: '100px', // 더 많이 이동
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: '#666666',
                        padding: '2px',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        zIndex: 2
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f0f0f0';
                        e.target.style.color = '#333333';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = '#666666';
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSearch}
                    style={sectionStyles.searchButton}
                    tabIndex={2}
                  >
                    🔍 검색
                  </button>
                </div>
                
                {/* 연관 검색 제안 */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid #333333',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 5, // z-index 낮추기
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}>
                    {searchSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background-color 0.2s ease',
                          backgroundColor: index === selectedSuggestionIndex ? '#f0f0f0' : '#ffffff',
                          color: index === selectedSuggestionIndex ? '#333333' : 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#f8f9fa';
                          setSelectedSuggestionIndex(index);
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = index === selectedSuggestionIndex ? '#f0f0f0' : '#ffffff';
                        }}
                      >
                        <div style={{fontWeight: 'bold', color: '#333333', marginBottom: '4px'}}>
                          {suggestion.place_name}
                        </div>
                        <div style={{fontSize: '12px', color: '#666666'}}>
                          {suggestion.address_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* 지도 */}
            <div style={{...sectionStyles.mapContainer, marginBottom: showSuggestions ? "300px" : "0"}}>
              <label style={sectionStyles.label}>위치 선택 (지도를 클릭하세요)</label>
              <div style={{...sectionStyles.mapWrapper, marginTop: '20px'}}>
                <MapView
                  ref={mapRef}
                  places={mapPlaces}
                  selectedPlace={mapPlaces[0]}
                  setSelectedPlace={() => {}}
                  curatorColorMap={{}}
                  savedColorMap={{}}
                  livePlaceIds={[]}
                  onMapClick={handleMapClick}
                />
              </div>
              {basicInfo.latitude && basicInfo.longitude && (
                <div style={sectionStyles.coordinates}>
                  <span>좌표: {basicInfo.latitude.toFixed(6)}, {basicInfo.longitude.toFixed(6)}</span>
                </div>
              )}
            </div>
            
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>카테고리 *</label>
              <select
                value={basicInfo.category}
                onChange={(e) => setBasicInfo({...basicInfo, category: e.target.value})}
                style={sectionStyles.select}
                tabIndex={3}
              >
                <option value="">선택하세요</option>
                <option value="디저트">디저트</option>
                <option value="양식">양식</option>
                <option value="육류">육류</option>
                <option value="일식">일식</option>
                <option value="중식">중식</option>
                <option value="해산물">해산물</option>
                <option value="한식">한식</option>
              </select>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>분위기</label>
              <select
                value={basicInfo.atmosphere}
                onChange={(e) => setBasicInfo({...basicInfo, atmosphere: e.target.value})}
                style={sectionStyles.select}
                tabIndex={4}
              >
                <option value="">선택하세요</option>
                <option value="quiet">조용한</option>
                <option value="lively">활기찬</option>
                <option value="modern">모던한</option>
                <option value="cozy">아늑한</option>
              </select>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>추천 메뉴</label>
              <input
                type="text"
                value={basicInfo.recommended_menu}
                onChange={(e) => setBasicInfo({...basicInfo, recommended_menu: e.target.value})}
                placeholder="추천하는 메뉴를 입력하세요"
                style={sectionStyles.input}
                tabIndex={5}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>추천 이유</label>
              <textarea
                value={basicInfo.menu_reason}
                onChange={(e) => setBasicInfo({...basicInfo, menu_reason: e.target.value})}
                placeholder="이 가게 추천하는 이유를 설명해주세요"
                style={sectionStyles.textarea}
                rows={3}
                tabIndex={6}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>태그</label>
              <input
                type="text"
                value={basicInfo.tags.join(", ")}
                onChange={(e) => setBasicInfo({...basicInfo, tags: e.target.value.split(",").map(tag => tag.trim()).filter(tag => tag)})}
                placeholder="#태그1 #태그2 #태그3 (쉼표로 구분)"
                style={sectionStyles.input}
                tabIndex={7}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={sectionStyles.step}>
          <h2 style={sectionStyles.stepTitle}>2단계: 큐레이션 정보</h2>
          <div style={sectionStyles.form}>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>한줄평</label>
              <textarea
                value={curationInfo.one_line_review}
                onChange={(e) => setCurationInfo({...curationInfo, one_line_review: e.target.value})}
                placeholder="이 장소를 한마디로 표현해주세요"
                style={sectionStyles.textarea}
                rows={2}
              />
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>방문 추천 상황</label>
              <div style={sectionStyles.checkboxGroup}>
                {["데이트", "친구와", "회식", "혼자", "가족과"].map((situation) => (
                  <label key={situation} style={sectionStyles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={curationInfo.visit_situations.includes(situation)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCurationInfo({...curationInfo, visit_situations: [...curationInfo.visit_situations, situation]});
                        } else {
                          setCurationInfo({...curationInfo, visit_situations: curationInfo.visit_situations.filter(s => s !== situation)});
                        }
                      }}
                      style={sectionStyles.checkbox}
                    />
                    {situation}
                  </label>
                ))}
              </div>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.label}>가격대</label>
              <select
                value={curationInfo.price_range}
                onChange={(e) => setCurationInfo({...curationInfo, price_range: e.target.value})}
                style={sectionStyles.select}
              >
                <option value="">선택하세요</option>
                <option value="cheap">저렴함 (1~2만원)</option>
                <option value="moderate">보통 (2~4만원)</option>
                <option value="expensive">비쌈 (4만원+)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={sectionStyles.step}>
          <h2 style={sectionStyles.stepTitle}>3단계: 발행 설정</h2>
          <div style={sectionStyles.form}>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={publishInfo.is_public}
                  onChange={(e) => setPublishInfo({...publishInfo, is_public: e.target.checked})}
                  style={sectionStyles.checkbox}
                />
                공개하기
              </label>
              <p style={sectionStyles.helpText}>
                공개하면 다른 사용자들이 이 장소를 볼 수 있습니다.
              </p>
            </div>
            <div style={sectionStyles.formGroup}>
              <label style={sectionStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={publishInfo.is_featured}
                  onChange={(e) => setPublishInfo({...publishInfo, is_featured: e.target.checked})}
                  style={sectionStyles.checkbox}
                />
                대표 추천으로 설정
              </label>
              <p style={sectionStyles.helpText}>
                대표 추천 장소로 설정하면 더 많은 사용자에게 노출됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={sectionStyles.actions}>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            style={sectionStyles.secondaryButton}
          >
            이전
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            style={sectionStyles.primaryButton}
          >
            다음
          </button>
        )}
        {step === 3 && (
          <>
            <button
              type="button"
              onClick={handleSaveDraft}
              style={sectionStyles.secondaryButton}
            >
              임시저장
            </button>
            <button
              type="button"
              onClick={() => handleAddPlace(false)}
              style={sectionStyles.primaryButton}
            >
              완료
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const PlacesSection = ({ places }) => (
  <div style={sectionStyles.section}>
    <h2 style={sectionStyles.sectionTitle}>내 장소 리스트</h2>
    {places.length === 0 ? (
      <div style={sectionStyles.emptyState}>
        <div style={sectionStyles.emptyIcon}>📍</div>
        <p style={sectionStyles.emptyText}>아직 올린 장소가 없습니다.</p>
      </div>
    ) : (
      <div style={sectionStyles.list}>
        {places.map((place) => (
          <div key={place.id} style={sectionStyles.card}>
            <div style={sectionStyles.cardContent}>
              <div style={sectionStyles.cardTitle}>{place.name}</div>
              <div style={sectionStyles.cardMeta}>
                {place.category && `${place.category} • `}
                {place.address}
              </div>
              {place.one_line_review && (
                <div style={sectionStyles.cardDescription}>
                  {place.one_line_review}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const DraftsSection = ({ drafts }) => (
  <div style={sectionStyles.section}>
    <h2 style={sectionStyles.sectionTitle}>임시 저장소</h2>
    {drafts.length === 0 ? (
      <div style={sectionStyles.emptyState}>
        <div style={sectionStyles.emptyIcon}>📝</div>
        <p style={sectionStyles.emptyText}>작성중인 초안이 없습니다.</p>
      </div>
    ) : (
      <div style={sectionStyles.list}>
        {drafts.map((draft) => (
          <div key={draft.id} style={sectionStyles.card}>
            <div style={sectionStyles.cardContent}>
              <div style={sectionStyles.cardTitle}>
                {draft.name || "제목 없음"}
              </div>
              <div style={sectionStyles.cardMeta}>
                {draft.updated_at && new Date(draft.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const StatsSection = ({ stats }) => (
  <div style={sectionStyles.section}>
    <h2 style={sectionStyles.sectionTitle}>성과 및 반응</h2>
    <div style={sectionStyles.statsGrid}>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>📍</div>
        <div style={sectionStyles.statNumber}>{stats.totalPlaces}</div>
        <div style={sectionStyles.statLabel}>올린 장소</div>
      </div>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>❤️</div>
        <div style={sectionStyles.statNumber}>{stats.totalSaved}</div>
        <div style={sectionStyles.statLabel}>저장된 수</div>
      </div>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>👁️</div>
        <div style={sectionStyles.statNumber}>{stats.totalViews}</div>
        <div style={sectionStyles.statLabel}>조회 수</div>
      </div>
      <div style={sectionStyles.statCard}>
        <div style={sectionStyles.statIcon}>👥</div>
        <div style={sectionStyles.statNumber}>{stats.followerCount}</div>
        <div style={sectionStyles.statLabel}>picked</div>
      </div>
    </div>
  </div>
);

const sectionStyles = {
  stepContainer: {
    padding: "20px 0",
  },
  stepIndicator: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginBottom: "32px",
  },
  stepDot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  stepDotInner: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#333333",
    transition: "background-color 0.3s",
  },
  stepDotText: {
    fontSize: "12px",
    color: "#bdbdbd",
  },
  step: {
    marginBottom: "32px",
  },
  stepTitle: {
    fontSize: "20px",
    fontWeight: 700,
    margin: "0 0 24px 0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#ffffff",
  },
  input: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
  },
  select: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
  },
  textarea: {
    border: "1px solid #333333",
    borderRadius: "8px",
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "16px",
    outline: "none",
    resize: "vertical",
  },
  checkboxGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#2ECC71",
  },
  helpText: {
    fontSize: "12px",
    color: "#bdbdbd",
    margin: "4px 0 0 0",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "32px",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 16px 0",
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
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
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
  mapContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px", // 간격 증가
    marginTop: "16px", // 위쪽 마진 증가
  },
  mapWrapper: {
    width: "100%",
    height: "300px",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #333333",
    backgroundColor: "#f0f0f0", // 연한 회색 배경으로 변경
    position: "relative",
    zIndex: 1,
  },
  coordinates: {
    fontSize: "12px",
    color: "#2ECC71",
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    padding: "8px 12px",
    borderRadius: "6px",
    textAlign: "center",
  },
  searchWrapper: {
    display: "flex",
    gap: "8px",
    position: "relative",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    padding: "12px 45px 12px 16px", // 오른쪽 패딩 45px로 증가
    border: "1px solid #333333",
    borderRadius: "8px",
    fontSize: "14px",
    backgroundColor: "#ffffff",
    color: "#333333",
    outline: "none",
    transition: "all 0.2s ease",
  },
  searchButton: {
    border: "1px solid #2ECC71",
    backgroundColor: "#2ECC71",
    color: "#111111",
    borderRadius: "8px",
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

export default function StudioHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth(); // 인증된 사용자 정보 가져오기
  const { showToast } = useToast(); // Toast 훅 추가
  const mapRef = useRef(null); // 지도 ref 다시 추가
  /** 잔 리스트에서 「수정」으로 잔 올리기 탭에 올 때는 탭 전환 useEffect가 폼·editingPlaceId를 지우지 않도록 함 */
  const skipAddSectionResetRef = useRef(false);
  /** 잔 리스트 탭 진입 시에만 내 저장 폴더 접기 (다른 탭↔리스트 전환 시 기본 접힘) */
  const prevActiveSectionForListFolderRef = useRef(null);
  /** 잔 아카이브 탭으로 전환할 때만 인사이트 RPC 재조회 (수정 저장은 길이 불변이라 기존 useEffect가 안 돎) */
  const prevActiveSectionForArchiveStatsRef = useRef(null);
  /** 잔 아카이브 프로필 박스 — 보기 모드에서 사진만 바로 저장 */
  /** 프로필 수정 모드에서만 사용 — 원 밖 「사진 올리기」 */
  const profileEditAvatarFileRef = useRef(null);

  // 상태 관리
  const [activeSection, setActiveSection] = useState("archive"); // archive, add, list, drafts
  const [myPlaces, setMyPlaces] = useState([]); // 잔 리스트 상태 - 실제 데이터만 사용
  const [loading, setLoading] = useState(true);
  const [isCurator, setIsCurator] = useState(false); // 큐레이터 여부
  const [filterType, setFilterType] = useState("all"); // 잔 리스트: all | public | private
  const [listSearchQuery, setListSearchQuery] = useState(""); // 잔 리스트 탭 내 검색어

  /** 잔 리스트 상단 — 카카오 「저장」 폴더 (system_folders + user_saved_places) */
  const [savedFolderDefs, setSavedFolderDefs] = useState(FALLBACK_SAVED_FOLDER_DEFS);
  const [savedByFolder, setSavedByFolder] = useState(() => ({}));
  const [savedFoldersLoadError, setSavedFoldersLoadError] = useState("");
  const [savedFoldersLoading, setSavedFoldersLoading] = useState(false);
  const [savedFolderKey, setSavedFolderKey] = useState(null);
  const [savedShowNewFolder, setSavedShowNewFolder] = useState(false);
  const [savedNewFolderName, setSavedNewFolderName] = useState("");
  const [savedFolderSaving, setSavedFolderSaving] = useState(false);
  const [savedFoldersEditMode, setSavedFoldersEditMode] = useState(false);
  const [savedFolderMetaDeletingKey, setSavedFolderMetaDeletingKey] =
    useState(null);
  /** 잔 리스트 — 내 저장 폴더 패널 (기본 접힘) */
  const [savedFoldersListExpanded, setSavedFoldersListExpanded] = useState(false);

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
      console.log("💾 curator_places 테이블 업데이트 시도:", updatedPlace.id);
      
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
        console.log("✅ curator_places 저장 성공:", { placeId: updatedPlace.id, is_archived: isArchived });
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
          console.log("✅ 저장 선택 - DB 저장 시작");
          // 실제 DB 저장 로직
          if (originalPlaceBeforeChange) {
            const updatedPlace = myPlaces.find(p => p.id === originalPlaceBeforeChange.id);
            if (updatedPlace) {
              await saveToDatabase(updatedPlace);
              console.log("✅ 저장 완료 - 상태 초기화");
            }
          }
        } else {
          console.log("❌ 저장 안 함 선택 - 원상복구");
          // 변경사항 취소하고 원래 상태로 복원
          if (originalPlaceBeforeChange) {
            setMyPlaces(prevPlaces => 
              prevPlaces.map(place => 
                place.id === originalPlaceBeforeChange.id 
                  ? { ...place, is_public: originalPlaceBeforeChange.is_public }
                  : place
              )
            );
            console.log("🔄 원상복구 완료:", originalPlaceBeforeChange);
          }
        }
        
        setHasUnsavedChanges(false);
        setOriginalPlaceBeforeChange(null);
      }
      
      setPreviousSection(activeSection);
    };
    
    handleSectionChange();
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
              console.log("지도 리사이즈 실패:", error);
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
  const [originalEditingPlace, setOriginalEditingPlace] = useState(null); // 원본 데이터 저장
  const [editingDraftId, setEditingDraftId] = useState(null); // 수정 중인 임시저장 ID
  const formRef = useRef(null); // 폼 참조

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
    } catch (_) {
      /* ignore */
    }
  }, [activeSection, editingPlaceId]);

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

  // 자동완성 상태
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  // 자동완성 검색 함수
  const fetchSuggestions = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingSuggestions(true);
    
    try {
      const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
      
      if (!apiKey) {
        console.error("❌ 카카오 REST API 키가 없습니다.");
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      
      // 카카오 장소 검색 API (자동완성용)
      const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`검색 실패: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.documents && data.documents.length > 0) {
        const suggestions = data.documents.map(doc => ({
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
    } finally {
      setIsSearchingSuggestions(false);
    }
  };
  
  // 해시태그 처리 함수
  const handleTagsChange = (value) => {
    console.log("=== 태그 처리 시작 ==="); // 디버깅용
    console.log("입력된 값:", value);
    console.log("trim() 후:", value.trim());
    console.log("기존 태그:", formData.tags);
    
    // 엔터를 누르면 현재 입력값을 태그로 추가
    if (value.trim()) {
      let newTag = value.trim();
      // #이 없으면 자동으로 추가
      if (!newTag.startsWith('#')) {
        newTag = `#${newTag}`;
      }
      console.log("최종 태그:", newTag);
      console.log("중복 체크:", formData.tags.includes(newTag));
      
      // 중복 태그 방지
      if (!formData.tags.includes(newTag)) {
        setFormData(prev => { 
          console.log("태그 추가 전:", prev.tags);
          const newState = { 
            ...prev, 
            tags: [...prev.tags, newTag]
          };
          console.log("태그 추가 후:", newState.tags);
          return newState;
        });
        console.log("태그 추가됨"); // 디버깅용
        // 지연시켜서 충돌 방지
        setTimeout(() => setTagInputValue(""), 0);
      } else {
        console.log("중복 태그라서 추가 안함"); // 디버깅용
        setTimeout(() => setTagInputValue(""), 0);
      }
    } else {
      console.log("값이 비어있어서 태그 추가 안함"); // 디버깅용
      setTimeout(() => setTagInputValue(""), 0);
    }
    console.log("=== 태그 처리 끝 ==="); // 디버깅용
  };

  // 해시태그 입력 핸들러 - 오직 스페이스/엔터만 사용
  const handleTagKeyDown = (e) => {
    console.log("=== 키 이벤트 ==="); // 디버깅용
    console.log("키 누름:", e.key);
    console.log("keyCode:", e.keyCode);
    console.log("isComposing:", e.isComposing);
    console.log("입력창 값:", e.target.value);
    console.log("==============="); // 디버깅용
    
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const value = e.target.value;
      console.log("스페이스/엔터 감지, 처리할 값:", value); // 디버깅용
      if (value.trim()) {
        handleTagsChange(value);
      } else {
        console.log("값이 비어있어서 처리 안함"); // 디버깅용
      }
    }
  };

  // 한글 입력 처리를 위한 onInput 이벤트
  const handleTagInput = (e) => {
    const value = e.target.value;
    console.log("입력 중:", value, "isComposing:", e.nativeEvent?.isComposing); // 디버깅용
    setTagInputValue(value);
  };

  // 해시태그 삭제 함수
  const removeTag = (tagToRemove) => {
    setFormData(prev => ({ 
      ...prev, 
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // 태그 관련 상태
  const [tagInputValue, setTagInputValue] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]); // 자동완성 제안

  // 자주 쓰는 태그 (핵심 10개)
  const frequentTags = [
    "혼술", "데이트", "소개팅", "1차", "2차", "회식", "친구모임", "가족모임",
    "야장", "룸 있음", "24시간", "가성비", "안주맛집",
    "성시경", "성시경맛집", "최자", "최자맛집", "소안맛집", "소주안주맛집",
  ];

  // 전체 태그 목록 (분위기성 태그 제외)
  const allTags = {
    "🍺 상황": ["혼술", "데이트", "소개팅", "1차", "2차", "회식", "친구모임", "가족모임"],
    "🔥 특징": ["야장", "바테이블", "늦게까지", "24시간", "웨이팅있음", "가성비", "안주맛집", "술이맛있음", "시그니처있음"],
    "🎭 감성": ["노포감성", "로컬맛집", "감성술집", "숨은맛집"], // 분위기성 태그 제거
    "📺 화제": ["성시경", "성시경맛집", "최자", "최자맛집", "소안맛집", "소주안주맛집"],
    "🍽 안주": ["국물안주", "해산물강함", "고기안주", "가벼운안주", "안주다양"],
    "🧭 공간": ["단체가능", "테이블넓음", "룸 있음", "예약필수", "웨이팅짧음", "2차추천", "바테이블(닷지)"],
    "🚽 화장실": ["실내 화장실", "외부 화장실", "위생적인", "비위생적인"]
  };

  // 모든 태그를 평탄화한 리스트 (자동완성용)
  const allTagsList = Object.values(allTags).flat();

  // 태그 자동완성
  const handleTagInputChange = (value) => {
    setTagInputValue(value);
    
    if (value.trim().length > 0) {
      // 입력한 텍스트와 일치하는 태그 찾기
      const matches = allTagsList.filter(tag => 
        tag.toLowerCase().includes(value.toLowerCase().trim())
      );
      setTagSuggestions(matches.slice(0, 5)); // 최대 5개까지 제안
    } else {
      setTagSuggestions([]);
    }
  };

  // 태그 자동완성 선택
  const handleTagSuggestionClick = (tag) => {
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInputValue("");
    setTagSuggestions([]);
  };

  // 자동완성 핸들러
  const handleInputChange = (value) => {
    setFormData(prev => ({ ...prev, name_address: value }));
    
    // API를 통해 자동완성 제안 가져오기
    fetchSuggestions(value);
  };

  // 자동완성 선택
  const handleSuggestionClick = (suggestion) => {
    const sid =
      suggestion?.kakao_place_id ||
      (suggestion?.id != null ? String(suggestion.id) : null);
    const kid =
      sid && /^\d+$/.test(String(sid)) ? String(sid) : null;
    setFormData(prev => ({ 
      ...prev, 
      name_address: suggestion.place_name || suggestion,
      latitude: suggestion.lat || null,
      longitude: suggestion.lng || null,
      kakao_place_id: kid,
    }));
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // 지도 중심 이동 (좌표가 있는 경우)
    if (suggestion.lat && suggestion.lng) {
      setMapCenter({ lat: suggestion.lat, lng: suggestion.lng });
    }
  };

  // 키보드 핸들러
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < searchSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          handleSuggestionClick(searchSuggestions[selectedSuggestionIndex]);
        } else {
          e.preventDefault();
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

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

  // 프로필 수정 상태 (일반 사용자용)
  const [isEditingUserProfile, setIsEditingUserProfile] = useState(false);
  const [editUserProfile, setEditUserProfile] = useState({
    displayName: "",
    username: "",
    bio: "",
    image: null
  });
  
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

  // 큐레이터 통계 상태 - 실제 데이터 기반
  const [curatorStats, setCuratorStats] = useState({
    level: 1,
    saveCount: 0,
    followerCount: 0,
    followingCount: 0,
    /** 내 잔(place) 중 다른 큐레이터도 올린 장소 개수 — studio_curator_overlap_place_count RPC */
    overlapSharedPlaceCount: 0,
    /** studio_week_save_insights RPC */
    weekTopReactingPlace: null,
    weekTopReactingSaves: 0,
    weeklyStats: {
      newPlaces: 0,
      newSaves: 0,
      newFollowers: 0
    },
    lastWeekStats: {
      newPlaces: 0,
      newSaves: 0,
      newFollowers: 0
    }
  });
  const [archiveExtInsights, setArchiveExtInsights] = useState(() =>
    normalizeStudioArchiveExtendedInsights(null)
  );
  /** studio_archive_extended_insights RPC 실패 시 메시지(빈 스타일과 구분) */
  const [archiveInsightsError, setArchiveInsightsError] = useState("");
  /** 겹친 장소 RPC 목록 — studio_curator_overlap_places */
  const [overlapSharedPlacesList, setOverlapSharedPlacesList] = useState([]);
  const [showOverlapPlacesList, setShowOverlapPlacesList] = useState(false);

  // 큐레이터 프로필 ID 확인 (테스트용)
  useEffect(() => {
    if (curatorProfile?.id) {
      console.log('🔍 큐레이터 로그인:', curatorProfile.id);
      console.log('🔍 전체 프로필:', curatorProfile);
      console.log('🔍 현재 사용자:', user?.id);
      
      // 읽지 않은 팔로우 조회 및 Toast 알림
      const fetchUnreadFollowers = async () => {
        try {
          const { data: unreadFollows, error: unreadError } = await supabase
            .from('user_follows')
            .select('user_id, created_at')
            .eq('curator_id', curatorProfile.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

          if (unreadError) {
            console.error('읽지 않은 팔로워 조회 실패:', unreadError);
            return;
          }

          if (unreadFollows && unreadFollows.length > 0) {
            const enriched = await fetchStudioFollowersEnriched(
              supabase,
              curatorProfile.id
            );
            const byUserId = new Map(
              enriched.map((r) => [r.user_id, r])
            );

            const followerPromises = unreadFollows.map(async (follow) => {
              const row = byUserId.get(follow.user_id);
              if (row) {
                const toastLine =
                  row.label === "이름 미설정" ? null : row.label;
                return { ...follow, toastLine, toastDetail: null };
              }
              const [profRes, curRes] = await Promise.all([
                supabase
                  .from("profiles")
                  .select("username, display_name, auth_provider, avatar_url")
                  .eq("id", follow.user_id)
                  .maybeSingle(),
                supabase
                  .from("curators")
                  .select(
                    "user_id, display_name, username, name, avatar_url, avatar, image, grade"
                  )
                  .eq("user_id", follow.user_id)
                  .maybeSingle(),
              ]);

              const pres = resolveFollowerPresentation(
                profRes.data || {},
                curRes.data
              );
              const toastLine =
                pres.label === "이름 미설정" ? null : pres.label;

              return {
                ...follow,
                toastLine,
                toastDetail: null,
              };
            });

            const followersWithData = await Promise.all(followerPromises);
            const count = followersWithData.length;
            const firstFollower = followersWithData[0];

            // 메시지 생성
            const singleMsg = (() => {
              const f = firstFollower;
              if (f.toastDetail) {
                return `✨ ${f.toastLine} — ${f.toastDetail}`;
              }
              if (!f.toastLine) {
                return `✨ 새 팔로우가 생겼어요! 👤`;
              }
              return `✨ ${f.toastLine}님이 큐레이터님을 팔로우했습니다! 👤`;
            })();

            const message =
              count === 1
                ? singleMsg
                : !firstFollower.toastLine
                  ? `🚀 새 팔로우 ${count}건이 있어요. 👤`
                  : `🚀 ${firstFollower.toastLine}님 외 ${count - 1}명이 큐레이터님을 팔로우합니다!`;

            // Toast 알림 표시
            showToast(message, 'info', 5000);

            // 읽음 처리
            await supabase
              .from('user_follows')
              .update({ is_read: true })
              .eq('curator_id', curatorProfile.id)
              .eq('is_read', false);
          }
        } catch (error) {
          console.error('팔로워 알림 처리 오류:', error);
        }
      };

      fetchUnreadFollowers();
    } else {
      console.log('🔍 큐레이터 프로필 없음');
      console.log('🔍 현재 사용자:', user?.id);
    }
  }, [curatorProfile?.id, user?.id, showToast]);

  // 실제 통계 데이터 로드 함수 (다대다 구조)
  const loadCuratorStats = async (userId) => {
    try {
      let statsCpQ = supabase
        .from("curator_places")
        .select(
          `
          place_id,
          created_at,
          places (created_at)
        `
        )
        .eq("curator_id", userId);
      const { data: statsCpRaw, error: placesError } = await statsCpQ;

      if (placesError) {
        console.error("places load error:", placesError);
        return;
      }

      const byPlace = new Map();
      for (const row of statsCpRaw || []) {
        const pid = row?.place_id;
        if (pid == null) continue;
        byPlace.set(String(pid), row);
      }
      const placeCuratorsData = [...byPlace.values()];

      const totalPlaces = placeCuratorsData?.length || 0;
      const totalLikes = 0; // likes 필드가 없으므로 0으로 설정

      /** 큐레이터가 이 장소를 연결한 시각. 없으면 레거시 폴백으로 places.created_at */
      const linkCreatedAt = (pc) => {
        const a = pc?.created_at;
        if (a) return new Date(a);
        const p = pc?.places?.created_at;
        return p ? new Date(p) : null;
      };

      // 로컬 주(일요일 0시) — 잔 기록·picked(신규 팔로워) 동일 기준
      const now = new Date();
      const thisWeekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const thisWeekPlaces =
        placeCuratorsData?.filter((pc) => {
          const t = linkCreatedAt(pc);
          return t && t >= thisWeekStart;
        }).length || 0;

      const lastWeekPlaces =
        placeCuratorsData?.filter((pc) => {
          const t = linkCreatedAt(pc);
          return t && t >= lastWeekStart && t < thisWeekStart;
        }).length || 0;

      let thisWeekNewFollowers = 0;
      let lastWeekNewFollowers = 0;

      // 등급 계산 (실제 장소 수 기반)
      let level = 1;
      if (totalPlaces >= 1000) level = 5;      // 다이아몬드
      else if (totalPlaces >= 500) level = 4;  // 플래티넘
      else if (totalPlaces >= 200) level = 3;  // 골드
      else if (totalPlaces >= 100) level = 2;  // 실버
      else if (totalPlaces >= 50) level = 1;   // 브론즈

      // 팔로워 수(성장 추이 picked = 주간 신규 팔로워 집계에도 동일 행 사용)
      console.log("🔍 큐레이터 프로필 ID:", curatorProfile?.id);
      const [{ data: followersData, error: followersError }, followingCount] =
        await Promise.all([
          curatorProfile?.id
            ? supabase
                .from("user_follows")
                .select("id, created_at")
                .eq("curator_id", curatorProfile.id)
            : Promise.resolve({ data: [], error: null }),
          countStudioFollowingDistinct(supabase, userId),
        ]);

      console.log("🔍 팔로워 데이터:", { followersData, followersError });
      const followerCount = followersError ? 0 : followersData?.length || 0;
      console.log("🔍 팔로워 / 팔로잉 수:", followerCount, followingCount);

      if (!followersError && followersData?.length) {
        for (const row of followersData) {
          if (!row.created_at) continue;
          const t = new Date(row.created_at);
          if (t >= thisWeekStart) thisWeekNewFollowers += 1;
          else if (t >= lastWeekStart && t < thisWeekStart) lastWeekNewFollowers += 1;
        }
      }

      let weekInsight = {
        top_place_name: null,
        top_save_count: 0,
        week_total_saves: 0,
      };
      const [
        { data: insightJson, error: insightErr },
        overlapRpc,
        extRpc,
        overlapPlacesRpc,
      ] = await Promise.all([
        supabase.rpc("studio_week_save_insights", { p_curator_id: userId }),
        supabase.rpc("studio_curator_overlap_place_count", {
          p_curator_id: userId,
        }),
        supabase.rpc("studio_archive_extended_insights", {
          p_curator_id: userId,
        }),
        supabase.rpc("studio_curator_overlap_places", {
          p_curator_id: userId,
        }),
      ]);
      if (!insightErr && insightJson && typeof insightJson === "object") {
        weekInsight = {
          top_place_name: insightJson.top_place_name ?? null,
          top_save_count: Number(insightJson.top_save_count) || 0,
          week_total_saves: Number(insightJson.week_total_saves) || 0,
        };
      } else if (insightErr) {
        console.warn(
          "studio_week_save_insights (Supabase에 마이그레이션 적용 필요):",
          insightErr.message
        );
      }

      let overlapSharedPlaceCount = 0;
      const { data: overlapRaw, error: overlapErr } = overlapRpc || {};
      if (!overlapErr && overlapRaw != null) {
        overlapSharedPlaceCount = Number(overlapRaw) || 0;
      } else if (overlapErr) {
        console.warn(
          "studio_curator_overlap_place_count (Supabase에 마이그레이션 적용 필요):",
          overlapErr.message
        );
      }

      const { data: overlapPlacesRaw, error: overlapPlacesErr } =
        overlapPlacesRpc || {};
      if (!overlapPlacesErr && Array.isArray(overlapPlacesRaw)) {
        setOverlapSharedPlacesList(overlapPlacesRaw);
      } else {
        if (overlapPlacesErr) {
          console.warn(
            "studio_curator_overlap_places (Supabase에 마이그레이션 적용 필요):",
            overlapPlacesErr.message
          );
        }
        setOverlapSharedPlacesList([]);
      }

      const { data: extRaw, error: extErr } = extRpc || {};
      if (!extErr && extRaw != null) {
        setArchiveInsightsError("");
        setArchiveExtInsights(normalizeStudioArchiveExtendedInsights(extRaw));
      } else {
        if (extErr) {
          console.warn(
            "studio_archive_extended_insights (Supabase에 마이그레이션 적용 필요):",
            extErr.message
          );
          setArchiveInsightsError(extErr.message);
        } else {
          setArchiveInsightsError(
            "내 스타일 분석 응답이 비어 있습니다. Supabase에 최신 마이그레이션을 적용했는지 확인하세요."
          );
        }
        setArchiveExtInsights(normalizeStudioArchiveExtendedInsights(null));
      }

      const stats = {
        placeCount: totalPlaces,
        saveCount: totalLikes, // likes 필드가 없으므로 0
        followerCount: followerCount, // 실제 팔로워 수
        followingCount,
        overlapSharedPlaceCount,
        weekTopReactingPlace: weekInsight.top_place_name,
        weekTopReactingSaves: weekInsight.top_save_count,
        weeklyStats: {
          newPlaces: thisWeekPlaces,
          newSaves: weekInsight.week_total_saves,
          newFollowers: thisWeekNewFollowers
        },
        lastWeekStats: {
          newPlaces: lastWeekPlaces,
          newSaves: 0,
          newFollowers: lastWeekNewFollowers
        }
      };
      
      setCuratorStats(prev => ({
        ...prev,
        level: level,
        ...stats
      }));

      console.log("✅ 실제 통계 데이터 로드 (다대다):", stats);
    } catch (error) {
      console.error("stats load error:", error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadCuratorStats(user.id); // 실제 사용자 ID 전달
    }
  }, [user?.id, myPlaces.length, curatorProfile?.id]);

  useEffect(() => {
    const prev = prevActiveSectionForArchiveStatsRef.current;
    prevActiveSectionForArchiveStatsRef.current = activeSection;
    if (!user?.id) return;
    if (activeSection === "archive" && prev != null && prev !== "archive") {
      void loadCuratorStats(user.id);
    }
  }, [activeSection, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    loadStudioData();
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (location.state?.openStudioList) {
      setActiveSection("list");
      navigate("/studio", { replace: true, state: {} });
    }
  }, [location.state?.openStudioList, navigate]);

  useEffect(() => {
    if (!liveStartConfirmOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLiveStartConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [liveStartConfirmOpen]);

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
        console.log("인증된 사용자 없음, 기본 프로필 사용");
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
        console.log("✅ 인증된 사용자:", user.id);
        
        // 인증된 사용자의 프로필 가져오기
        const { data: profileData, error: profileError } = await supabase
          .from("curators")
          .select("*")
          .eq("user_id", user.id) // user_id로 연결
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
          console.log("프로필 데이터 없음, 기본값 사용:", profileError);
        }
        
        // 큐레이터 여부 확인
        const isUserCurator = profileData && !profileError;
        setIsCurator(isUserCurator);
        console.log("🎭 큐레이터 여부:", isUserCurator);
        
        const currentUser = profileData || {
          user_id: user.id, // 인증된 사용자 ID 연결
          username: user.user_metadata?.username || user.email?.split('@')[0],
          display_name: user.user_metadata?.display_name || "큐레이터",
          bio: "안녕하세요! 맛집 탐험을 좋아하는 큐레이터입니다.",
          image: null,
          grade: "bronze",
          status: "active",
          total_places: 0,
          total_likes: 0,
          warning_count: 0
        };

        console.log("📂 프로필 데이터 로드:", currentUser);
        
        setCuratorProfile(prev => ({
          ...prev,
          id: currentUser.id, // ID 필드 추가
          username: currentUser.username,
          displayName: currentUser.display_name,
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
      
      console.log("📂 스튜디오 데이터 로딩 시작...");
      console.log("🔍 현재 사용자 ID:", user?.id);

      if (!user?.id) {
        setMyPlaces([]);
        const savedDraftsGuest = JSON.parse(
          localStorage.getItem("studio_drafts") || "[]"
        );
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

      console.log("🔍 큐레이터 추천 쿼리 결과:", { data: curatorPlacesData, error: placesError });

      // 만약 데이터가 없다면, 기존 방식으로도 확인
      if (!placesData || placesData.length === 0) {
        console.log("⚠️ 다대다 방식으로 장소 없음, 기존 방식으로 확인 중...");
        
        // 기존 방식으로도 확인 (user_id 필드가 아직 있는 경우)
        const { data: oldWayData, error: oldWayError } = await supabase
          .from("places")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (oldWayData && oldWayData.length > 0) {
          console.log("✅ 기존 방식으로 장소 발견:", oldWayData.length, "개");
          
          // 기존 방식으로 데이터 변환
          const formattedPlaces = oldWayData.map(place => ({
            id: place.id,
            name: place.name,
            address: place.address || place.name,
            latitude: place.lat,
            longitude: place.lng,
            category: place.category || "미분류",
            alcohol_type: place.alcohol_type || "",
            atmosphere: place.atmosphere || "",
            recommended_menu: place.recommended_menu || "",
            menu_reason: place.menu_reason || "",
            tags: place.tags || [],
            is_public: place.is_public,
            created_at: place.created_at ? new Date(place.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          }));
          
          setMyPlaces(formattedPlaces);
          console.log("✅ myPlaces 업데이트 완료 (기존 방식):", formattedPlaces);
          setLoading(false);
          return;
        }
        
        // 완전히 없는 경우
        console.log("🔍 모든 장소 확인 중...");
        const { data: allPlaces, error: allPlacesError } = await supabase
          .from("places")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        
        console.log("🔍 모든 장소 데이터:", allPlaces);
        console.log("🔍 모든 장소 user_id:", allPlaces?.map(p => ({ id: p.id, name: p.name, user_id: p.user_id })));
      }

      if (placesError) {
        console.error("❌ 장소 로딩 오류:", placesError);
      } else {
        console.log("✅ 불러온 장소 데이터:", placesData);
        
        const formattedPlaces =
          mapCuratorJoinRowsToMyPlaces(curatorPlacesData);
        
        setMyPlaces(formattedPlaces);
        console.log("✅ myPlaces 업데이트 완료:", formattedPlaces);
        
        // drafts는 별도로 관리 (myPlaces와 동기화하지 않음)
        // 임시저장된 데이터만 drafts에 표시됨
        
        // localStorage에서 임시저장된 데이터 불러오기
        const savedDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
        setDrafts(savedDrafts);
        console.log("📝 localStorage에서 임시저장 데이터 불러옴:", savedDrafts.length, "개");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("❌ Studio data loading error:", error);
      setLoading(false);
    }
  };

  const loadSavedFolders = useCallback(async () => {
    if (!user?.id) return;
    setSavedFoldersLoading(true);
    setSavedFoldersLoadError("");
    try {
      const sfPromise = selectSystemFoldersOrdered(supabase, user.id);
      const savPromise = supabase
        .from("user_saved_places")
        .select(
          `
          id,
          place_id,
          places ( id, name, address ),
          user_saved_place_folders ( folder_key )
        `
        )
        .eq("user_id", user.id);

      const [sfResult, savResult] = await Promise.all([sfPromise, savPromise]);

      const { data: sfRows, error: sfErr } = sfResult;
      const { data: savedRows, error: savErr } = savResult;

      if (!sfErr && sfRows?.length) {
        setSavedFolderDefs(sfRows);
      } else if (sfErr) {
        console.warn("system_folders:", sfErr.message);
      }

      if (savErr) {
        setSavedFoldersLoadError(
          savErr.message || "저장 폴더 목록을 불러오지 못했습니다."
        );
        setSavedByFolder({});
        return;
      }

      const defList = sfRows?.length ? sfRows : FALLBACK_SAVED_FOLDER_DEFS;
      const next = {};
      defList.forEach((f) => {
        next[f.key] = [];
      });

      (savedRows || []).forEach((row) => {
        const links = row.user_saved_place_folders;
        if (!links?.length) return;
        links.forEach((l) => {
          const k = l?.folder_key;
          if (!k) return;
          if (!next[k]) next[k] = [];
          next[k].push(row);
        });
      });

      setSavedByFolder(next);
    } catch (e) {
      setSavedFoldersLoadError(e?.message || "오류가 발생했습니다.");
    } finally {
      setSavedFoldersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (
      (activeSection === "list" || activeSection === "add") &&
      user?.id
    ) {
      loadSavedFolders();
    }
  }, [activeSection, user?.id, loadSavedFolders]);

  useEffect(() => {
    const prev = prevActiveSectionForListFolderRef.current;
    if (
      activeSection === "list" &&
      prev != null &&
      prev !== "list"
    ) {
      setSavedFoldersListExpanded(false);
    }
    prevActiveSectionForListFolderRef.current = activeSection;
  }, [activeSection]);

  const sortedSavedFolders = useMemo(() => {
    return [...savedFolderDefs].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [savedFolderDefs]);

  const hasDeletableSavedFolders = useMemo(
    () => sortedSavedFolders.some((f) => isDeletableUserSavedFolderKey(f.key)),
    [sortedSavedFolders]
  );

  /** 폴더 삭제 후 등 DB와 잔 리스트 동기화 */
  const reloadStudioMyPlaces = useCallback(async () => {
    if (!user?.id) return;
    let data = [];
    try {
      data = await fetchCuratorPlacesMergedWithPlaces(supabase, user.id);
    } catch (e) {
      console.warn("reloadStudioMyPlaces:", e?.message || e);
      return;
    }
    const deduped = dedupeCuratorPlacesByPlaceId(data);
    setMyPlaces(mapCuratorJoinRowsToMyPlaces(deduped));
  }, [user?.id]);

  const handleDeleteSavedFolder = async (key) => {
    if (!user?.id) return;
    if (!isDeletableUserSavedFolderKey(key)) return;
    if (
      !window.confirm(
        "이 폴더에 넣어 둔 잔은 내 저장·스튜디오 잔 리스트(추천)에서 모두 사라집니다. 다른 폴더에도 같이 넣었어도 해당 저장·추천이 지워집니다. 폴더 목록에서도 사라집니다. 계속할까요?"
      )
    ) {
      return;
    }
    setSavedFolderMetaDeletingKey(key);
    try {
      const folderItems = savedByFolder[key] || [];
      const hintSavedIds = folderItems.map((r) => r.id).filter(Boolean);
      const hintPlaceIds = folderItems
        .map((r) => {
          if (r?.place_id != null) return String(r.place_id);
          if (r?.places?.id != null) return String(r.places.id);
          return null;
        })
        .filter(Boolean);
      const hint = {
        savedPlaceIds: hintSavedIds,
        placeIds: hintPlaceIds,
        curatorRowId: curatorProfile?.id ?? null,
      };

      const { error } = await deleteOwnCustomSystemFolder(
        supabase,
        user.id,
        key,
        hint
      );
      if (error) {
        alert(error.message || "삭제하지 못했습니다.");
        return;
      }
      setSavedFolderKey((k) => (k === key ? null : k));
      setAddPlaceSelectedFolders((prev) => prev.filter((fk) => fk !== key));
      await loadSavedFolders();
      await reloadStudioMyPlaces();
    } finally {
      setSavedFolderMetaDeletingKey(null);
    }
  };

  const savedFolderSelectedPlaces = savedFolderKey
    ? savedByFolder[savedFolderKey] || []
    : [];

  /** 잔 리스트 카드: 선택한 폴더에 넣은 places.id 집합 (내 잔과 교집합) */
  const savedFolderPlaceIdSet = useMemo(() => {
    if (!savedFolderKey) return null;
    const ids = new Set();
    for (const row of savedFolderSelectedPlaces) {
      const id = studioSavedPlaceId(row);
      if (id) ids.add(String(id));
    }
    return ids;
  }, [savedFolderKey, savedFolderSelectedPlaces]);

  const insertCustomSystemFolderRow = useCallback(
    async (trimmedName) => {
      if (!trimmedName) return { ok: false };
      if (!user?.id) {
        return {
          ok: false,
          error: { message: "로그인이 필요합니다." },
        };
      }
      const key = `custom_${Date.now()}`;
      const maxSo = Math.max(
        0,
        ...savedFolderDefs.map((f) => Number(f.sort_order) || 0)
      );
      const { error } = await insertSystemFolderRow(supabase, {
        key,
        name: trimmedName,
        color: "#3498DB",
        icon: "📁",
        description: "",
        sort_order: maxSo + 1,
        is_active: true,
        created_by: user.id,
      });
      if (error) {
        return { ok: false, error };
      }
      await loadSavedFolders();
      return { ok: true, key };
    },
    [savedFolderDefs, loadSavedFolders, user?.id]
  );

  const persistUserSavedPlaceFolders = useCallback(
    (placeUuid, folderKeys) =>
      upsertUserSavedPlaceFolders(supabase, {
        placeId: placeUuid,
        folderKeys,
        firstSavedFrom: "studio",
        authUser: user,
      }),
    [user]
  );

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

  const handleAddSavedFolder = async () => {
    const name = savedNewFolderName.trim();
    if (!name) return;
    setSavedFolderSaving(true);
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
      setSavedNewFolderName("");
      setSavedShowNewFolder(false);
    } finally {
      setSavedFolderSaving(false);
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

  const handleAddPlace = async (isDraft = false) => {
    try {
      const draftIdPublishedFrom = editingDraftId;
      const removePublishedDraft = () => {
        if (!draftIdPublishedFrom) return;
        try {
          const existingDrafts = JSON.parse(
            localStorage.getItem("studio_drafts") || "[]"
          );
          const nextDrafts = existingDrafts.filter(
            (d) => String(d.id) !== String(draftIdPublishedFrom)
          );
          localStorage.setItem("studio_drafts", JSON.stringify(nextDrafts));
          setDrafts(nextDrafts);
        } catch (e) {
          console.warn("studio_drafts 정리(잔 올리기 저장 후):", e);
        }
        setEditingDraftId(null);
      };

      // 필수 필드 확인
      if (!formData.name_address || !formData.latitude || !formData.longitude) {
        alert("장소 이름과 위치를 선택해주세요.");
        return;
      }

      // 중복 확인 (자신의 장소만)
      const duplicateCheck = checkDuplicatePlace(formData.name_address);
      if (duplicateCheck) {
        return;
      }

      console.log("🔍 StudioHome 저장 시작:", { ...formData, isDraft });
      
      if (!isDraft) {
        // 수정 모드가 아닐 경우 그대로 진행 (DB 중복 확인 제거)
        console.log("📝 새 장소 저장 모드 (다른 큐레이터 장소도 저장 가능)");
        // 실제 저장인 경우 Supabase에 저장
        // 실제 인증된 사용자 ID 사용
        if (!user) {
          alert("로그인이 필요합니다.");
          return;
        }

        if (addPlaceSelectedFolders.length === 0) {
          alert("내 저장 폴더를 1개 이상 선택해주세요.");
          return;
        }

        const effectiveEditPlaceId =
          editingPlaceId ||
          (typeof localStorage !== "undefined"
            ? localStorage.getItem("editing_place_id")
            : null);

        if (effectiveEditPlaceId) {
          // 수정 모드: UPDATE 사용
          const updateData = {
            name: formData.name_address,
            address: formData.name_address,
            lat: formData.latitude,
            lng: formData.longitude,
            // 추천 한 줄은 curator_places.one_line_reason (upsertCuratorPlaceForStudio)
            kakao_place_id: formData.kakao_place_id || null,
          };
          
          console.log("📝 수정할 데이터:", updateData);
          
          const { data, error } = await supabase
            .from("places")
            .update(updateData)
            .eq("id", effectiveEditPlaceId)
            .select();

          if (error) {
            console.error("❌ 장소 수정 오류:", error);
            console.error("❌ 에러 상세:", error.message, error.code, error.details);
            alert(`장소 수정에 실패했습니다: ${error.message}`);
            return;
          }

          console.log("✅ 장소 수정 성공:", data);

          const { error: cpMergeErr } = await upsertCuratorPlaceForStudio(
            supabase,
            user.id,
            effectiveEditPlaceId,
            {
              display_name:
                user.display_name || user.nickname || user.email,
              one_line_reason: formData.menu_reason || "",
              tags: formData.tags || [],
              alcohol_types: formData.alcohol_type
                ? [formData.alcohol_type]
                : [],
              moods: formData.atmosphere ? [formData.atmosphere] : [],
            }
          );
          if (cpMergeErr) {
            console.warn("curator_places 정리(수정 저장):", cpMergeErr);
          } else if (user?.id) {
            void loadCuratorStats(user.id);
          }

          const folderRes = await persistUserSavedPlaceFolders(
            effectiveEditPlaceId,
            addPlaceSelectedFolders
          );
          if (folderRes.ok) {
            void loadSavedFolders().catch((e) =>
              console.warn("loadSavedFolders(수정 후):", e)
            );
          }
          
          // 로컬 상태 업데이트
          setMyPlaces(prev => prev.map(place => 
            String(place.id) === String(effectiveEditPlaceId)
              ? {
                  ...place,
                  ...updateData,
                  latitude: updateData.lat,
                  longitude: updateData.lng,
                  tags: formData.tags || [],
                  alcohol_type: formData.alcohol_type || "",
                  atmosphere: formData.atmosphere || "",
                  menu_reason: formData.menu_reason || "",
                }
              : place
          ));

          removePublishedDraft();

          alert(
            folderRes.ok
              ? "장소가 성공적으로 수정되었습니다!"
              : `장소는 수정되었습니다. 내 저장 폴더 연결: ${folderRes.message || "실패"}`
          );
          
          // 수정 모드 종료
          setEditingPlaceId(null);
          try {
            localStorage.removeItem("editing_place_id");
          } catch (_) {
            /* ignore */
          }

          setHasUnsavedChanges(false);
          setOriginalPlaceBeforeChange(null);
          setActiveSection("list");
          
        } else {
          // 새로 추가 모드: places.kakao_place_id 유니크 → 동일 카카오 ID는 기존 행 재사용
          const kid = formData.kakao_place_id
            ? String(formData.kakao_place_id).trim()
            : "";

          let placeRow = null;

          if (kid) {
            const { data: existingPlace, error: exErr } = await supabase
              .from("places")
              .select("*")
              .eq("kakao_place_id", kid)
              .maybeSingle();

            if (exErr) {
              console.warn("기존 장소(kakao_place_id) 조회:", exErr.message);
            } else if (existingPlace) {
              const { data: updated, error: updErr } = await supabase
                .from("places")
                .update({
                  name: formData.name_address,
                  address: formData.name_address,
                  lat: formData.latitude,
                  lng: formData.longitude,
                  category:
                    formData.category ||
                    existingPlace.category ||
                    "미분류",
                  kakao_place_id: kid,
                })
                .eq("id", existingPlace.id)
                .select()
                .single();

              placeRow = updErr ? existingPlace : updated;
              console.log("✅ 기존 places 행 재사용 (kakao_place_id):", kid);
            }
          }

          if (!placeRow) {
            const newPlaceData = {
              name: formData.name_address,
              address: formData.name_address,
              lat: formData.latitude,
              lng: formData.longitude,
              category: formData.category || "미분류",
              kakao_place_id: kid || null,
            };

            console.log("📝 새 places INSERT:", newPlaceData);
            const { data: newPlace, error: placeError } = await supabase
              .from("places")
              .insert([newPlaceData])
              .select();

            if (placeError) {
              if (placeError.code === "23505" && kid) {
                const { data: racePlace, error: raceErr } = await supabase
                  .from("places")
                  .select("*")
                  .eq("kakao_place_id", kid)
                  .maybeSingle();
                if (!raceErr && racePlace) {
                  placeRow = racePlace;
                  console.log("✅ INSERT 충돌 후 기존 행 사용:", kid);
                }
              }
              if (!placeRow) {
                console.error("❌ 장소 저장 오류:", placeError);
                alert(`장소 저장에 실패했습니다: ${placeError.message}`);
                return;
              }
            } else {
              placeRow = newPlace?.[0] ?? null;
            }
          }

          const placeData = { data: placeRow ? [placeRow] : null };

          console.log("✅ 장소 마스터 준비 완료:", placeData);
          
          // 2. 큐레이터 추천에 저장
        if (placeData && placeData.data && placeData.data[0]) {
          const curatorFields = {
            display_name: user.display_name || user.nickname || user.email,
            one_line_reason: formData.menu_reason || "",
            tags: formData.tags || [],
            alcohol_types: formData.alcohol_type ? [formData.alcohol_type] : [],
            moods: formData.atmosphere ? [formData.atmosphere] : [],
          };
            console.log("📝 저장할 curator_places 필드:", curatorFields);

            const { data: curatorData, error: curatorError } =
              await upsertCuratorPlaceForStudio(
                supabase,
                user.id,
                placeData.data[0].id,
                curatorFields
              );

            if (curatorError) {
              console.error("❌ curator_places 저장 오류:", curatorError);
              alert(`큐레이터 추천 저장에 실패했습니다: ${curatorError.message}`);
              return;
            }
            if (!curatorData?.[0]?.id) {
              console.error("❌ curator_places 저장 후 행 없음");
              alert("큐레이터 추천 저장에 실패했습니다.");
              return;
            }

            console.log("✅ curator_places 저장 성공:", curatorData);

            const insertedRow = placeData.data[0];
            const insertedPlaceUuid = insertedRow?.id;

            const folderRes = await persistUserSavedPlaceFolders(
              insertedPlaceUuid,
              addPlaceSelectedFolders
            );
            if (folderRes.ok) {
              void loadSavedFolders().catch((e) =>
                console.warn("loadSavedFolders(신규 저장 후):", e)
              );
            } else {
              alert(
                `잔은 올라갔지만 내 저장 폴더 연결에 실패했습니다: ${folderRes.message || ""}`
              );
            }
            const kakaoForPhotos =
              insertedRow?.kakao_place_id || formData.kakao_place_id || null;
            const photoFilesSnapshot = addPlacePhotoFiles.slice();
            setAddPlacePhotoFiles([]);
            const curatorUserId = user?.id;
            if (
              insertedPlaceUuid &&
              photoFilesSnapshot.length > 0 &&
              curatorUserId
            ) {
              void (async () => {
                let photoFail = 0;
                for (const file of photoFilesSnapshot) {
                  try {
                    if (!isAcceptableRasterImageFile(file)) continue;
                    const fileToUpload = await prepareImageFileForUpload(file);
                    await uploadCuratorPlacePhoto({
                      file: fileToUpload,
                      curatorId: curatorUserId,
                      kakaoPlaceId: kakaoForPhotos,
                      placeId: insertedPlaceUuid,
                    });
                  } catch (photoErr) {
                    photoFail += 1;
                    console.error("큐레이터 사진 업로드 실패:", photoErr);
                  }
                }
                if (photoFail > 0) {
                  showToast(
                    `사진 ${photoFail}장 업로드 실패 — 콘솔·Supabase Storage/RLS 확인`,
                    "error",
                    6000
                  );
                } else {
                  showToast(
                    `사진 ${photoFilesSnapshot.length}장을 등록했습니다.`,
                    "success"
                  );
                }
              })();
            }
            
            // 3. myPlaces에 새 장소 추가 — id는 항상 places.id (목록·수정·삭제·폴더 필터와 loadStudioData 일치)
            const newPlaceForList = {
              id: placeData.data[0].id,
              curator_place_id: curatorData[0].id,
              place_id: placeData.data[0].id,
              name: formData.name_address,
              address: formData.name_address,
              latitude: formData.latitude,
              longitude: formData.longitude,
              category: formData.category || "미분류",
              alcohol_type: formData.alcohol_type || "",
              atmosphere: formData.atmosphere || "",
              recommended_menu: formData.recommended_menu || "",
              menu_reason: formData.menu_reason || "",
              tags: formData.tags || [],
              is_public: true, // 기본 공개
              is_archived: false, // curator_places 기준
              created_at: new Date().toISOString().split('T')[0],
              places: placeData.data[0],
            };
            
            console.log("📝 myPlaces에 추가할 데이터:", newPlaceForList);
            setMyPlaces((prev) => {
              const withoutDup = prev.filter((p) => p.id !== newPlaceForList.id);
              const updated = [newPlaceForList, ...withoutDup];
              console.log("✅ myPlaces 업데이트 완료:", updated.length, "개");
              return updated;
            });

            removePublishedDraft();
          }
          
          // 폼 초기화
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
            is_public: true
          });
          setAddPlacePhotoFiles([]);
          setAddPlaceSelectedFolders([]);
          setAddPlaceShowNewFolder(false);
          setAddPlaceNewFolderName("");
          
          setSearchedPlaces([]);
          setMapCenter({ lat: 37.5665, lng: 126.9780 }); // 서울시청으로 리셋
          setEditingPlaceId(null); // 수정 모드 종료

          setHasUnsavedChanges(false);
          setOriginalPlaceBeforeChange(null);
          
          // "잔 리스트" 탭으로 자동 이동
          setActiveSection("list");
        }
      } else {
        // 임시저장인 경우
        const draftRowId = editingDraftId || `${Date.now()}`;
        const draftData = {
          id: draftRowId,
          basicInfo: {
            name_address: formData.name_address,
            category: formData.category
          },
          // 모든 formData 데이터 저장
          alcohol_type: formData.alcohol_type,
          atmosphere: formData.atmosphere,
          recommended_menu: formData.recommended_menu,
          menu_reason: formData.menu_reason,
          tags: formData.tags,
          latitude: formData.latitude,
          longitude: formData.longitude,
          publishInfo: {
            is_public: formData.is_public,
            is_featured: false,
          },
          createdAt: new Date().toISOString().split('T')[0]
        };
        
        // localStorage에 저장
        const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
        let updatedDrafts;
        
        if (editingDraftId) {
          // 수정 모드: 기존 임시저장 업데이트
          updatedDrafts = existingDrafts.map(draft => 
            draft.id === editingDraftId ? draftData : draft
          );
          console.log("📝 임시저장 업데이트:", editingDraftId);
          setEditingDraftId(null); // 수정 모드 종료
        } else {
          // 새로운 임시저장 추가
          updatedDrafts = [...existingDrafts, draftData];
          console.log("📝 새 임시저장 추가:", draftData.id);
        }
        
        localStorage.setItem('studio_drafts', JSON.stringify(updatedDrafts));

        // React 상태는 localStorage와 동일하게 유지 (기존: 항상 append 해서 수정 시 초안이 2개로 보임)
        setDrafts(updatedDrafts);
        console.log("✅ 임시저장 완료 (localStorage):", draftData);
        
        // 수정 모드였다면 원본 장소를 잔 리스트에서 제거
        const currentEditingId = editingPlaceId || localStorage.getItem('editing_place_id');
        if (currentEditingId) {
          console.log("🗑️ 수정 후 임시저장: 원본 장소 제거", currentEditingId);
          setMyPlaces(prev => prev.filter(place => place.id !== currentEditingId));
          
          // 수정 모드 종료
          setEditingPlaceId(null);
          localStorage.removeItem('editing_place_id');
        }
        
        alert("초안이 임시저장되었습니다.");
        
        // '잔 채우기' 탭으로 자동 이동
        setActiveSection("drafts");
      }
      
    } catch (error) {
      console.error("❌ 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
    }
  };

  const checkDuplicatePlace = (placeName) => {
    // 수정 모드인 경우 중복 확인 건너뛰기
    const currentEditingId = editingPlaceId || localStorage.getItem('editing_place_id');
    if (currentEditingId) {
      console.log("✏️ 수정 모드: 중복 확인 건너뛰기", { editingPlaceId, localStorageId: localStorage.getItem('editing_place_id') });
      return false;
    }
    
    // myPlaces에서만 중복 확인 (자신의 장소만)
    const duplicate = myPlaces.find(place => 
      place.name.toLowerCase().trim() === placeName.toLowerCase().trim()
    );
    
    if (duplicate) {
      console.log("⚠️ 중복된 장소 (내 장소):", duplicate.name);
      alert("이미 저장된 장소입니다.");
      return true;
    }
    
    return false;
  };

  const handleTogglePublic = async (placeId) => {
    try {
      console.log("🔄 공개/비공개 토글:", placeId);
      
      // 변경 전 원본 데이터 저장
      const originalPlace = myPlaces.find(p => p.id === placeId);
      if (originalPlace) {
        setOriginalPlaceBeforeChange(JSON.parse(JSON.stringify(originalPlace)));
        console.log("💾 변경 전 원본 데이터 저장:", originalPlace);
      }
      
      // 1. 로컬 상태 업데이트
      setMyPlaces(prevPlaces => 
        prevPlaces.map(place => 
          place.id === placeId 
            ? { ...place, is_public: !place.is_public }
            : place
        )
      );
      
      // 2. 변경사항 상태 설정
      setHasUnsavedChanges(true);
      console.log("⚠️ 공개/비공개 상태 변경 - hasUnsavedChanges 설정");
      
      // 3. DB 업데이트는 임시로 제외 (is_public 필드가 DB에 없음)
      // TODO: 나중에 is_public 필드를 DB에 추가하거나 별도 테이블로 관리
      console.log("✅ 공개/비공개 상태가 로컬에서 변경되었습니다.");
      
    } catch (error) {
      console.error("❌ 토글 오류:", error);
    }
  };

  const handleDeletePlace = async (placeId) => {
    try {
      // 확인 대화상자
      const confirmed = window.confirm("정말로 이 장소를 삭제하시겠습니까?");
      if (!confirmed) return;
      
      console.log("🗑️ 장소 삭제:", placeId);
      
      // 1. DB에서 삭제
      const { error } = await supabase
        .from("places")
        .delete()
        .eq("id", placeId);
        
      if (error) {
        console.error("❌ 장소 삭제 오류:", error);
        alert("장소 삭제에 실패했습니다: " + error.message);
        return;
      }
      
      // 2. 로컬 상태에서 삭제
      setMyPlaces(prevPlaces => prevPlaces.filter(place => place.id !== placeId));
      
      // 잔 채우기 목록에서도 삭제
      setDrafts(prevDrafts => prevDrafts.filter(draft => draft.id !== placeId));
      
      console.log("✅ 장소 삭제 성공");
      alert("장소가 삭제되었습니다.");
      
    } catch (error) {
      console.error("❌ 삭제 오류:", error);
      alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleEditPlace = (place) => {
    try {
      console.log("✏️ 장소 수정:", place);

      setEditingDraftId(null);

      // 수정 모드 설정
      setEditingPlaceId(place.id);
      localStorage.setItem('editing_place_id', place.id);

      skipAddSectionResetRef.current = true;

      const alcoholFromCp =
        Array.isArray(place.alcohol_types) && place.alcohol_types.length
          ? place.alcohol_types[0]
          : place.alcohol_type || "";
      const moodFromCp =
        Array.isArray(place.moods) && place.moods.length
          ? place.moods[0]
          : place.atmosphere || "";

      setFormData({
        name_address: place.name,
        category: normalizeStudioPlaceCategory(place.category || "") || "",
        alcohol_type: alcoholFromCp,
        atmosphere: moodFromCp,
        recommended_menu: place.recommended_menu || "",
        menu_reason: place.menu_reason || "",
        tags: filterPlaceTagsForDisplay(parseDbStringArray(place.tags)),
        latitude: place.latitude,
        longitude: place.longitude,
        kakao_place_id: place.kakao_place_id ?? null,
        is_public: place.is_public,
      });

      // 지도 중심을 해당 장소로 이동
      setMapCenter({ lat: place.latitude, lng: place.longitude });
      
      // '잔 올리기' 탭으로 이동
      setActiveSection("add");
      
      console.log("📝 폼 데이터 설정 완료:", {
        name: place.name,
        category: place.category,
        alcohol_type: alcoholFromCp,
        atmosphere: moodFromCp,
        tags: place.tags,
      });
      
      alert("장소 정보를 수정할 수 있습니다. 수정 후 다시 저장해주세요.");
      
    } catch (error) {
      console.error("❌ 장소 수정 오류:", error);
      alert("장소 수정에 실패했습니다: " + error.message);
    }
  };

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
        console.log("username 중복 확인 필요:", editProfile.username);
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
      
      console.log("📝 프로필 DB 저장:", profileData);
      
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
      
      console.log("✅ 프로필 DB 저장 성공:", data);
      
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
      console.log("프로필 업데이트 완료:", editProfile);
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
    console.log("자동 username 생성:", newUsername);
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
    console.log("Edit draft:", draft);
    console.log("🔍 임시저장된 데이터 상세:", {
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
      console.log("🗺️ 지도 중심 설정:", { lat: draft.latitude, lng: draft.longitude });
    }
    
    // 잔 올리기 섹션으로 이동
    setActiveSection("add");

    // 잔 리스트에서 연 '장소 수정' 상태가 남아 있으면 임시저장 시 잘못된 행이 지워지거나 중복 저장될 수 있음
    setEditingPlaceId(null);
    try {
      localStorage.removeItem("editing_place_id");
    } catch (_) {
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
      
      console.log("✅ 직접 폼 필드에 값 설정 완료");
    }, 200);
  };

  const handleDeleteDraft = (draftId) => {
    // 초안 삭제 로직
    console.log("Delete draft:", draftId);
    
    // localStorage에서 삭제
    const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
    const updatedDrafts = existingDrafts.filter(draft => draft.id !== draftId);
    localStorage.setItem('studio_drafts', JSON.stringify(updatedDrafts));
    
    // state에서도 삭제
    setDrafts(prev => prev.filter(draft => draft.id !== draftId));
    console.log("🗑️ 임시저장 삭제 완료 (localStorage):", draftId);
  };

  const handleSearch = async () => {
    if (!formData.name_address.trim()) {
      alert("검색어를 입력해주세요.");
      return;
    }
    
    console.log("🔍 StudioHome 검색 시작:", formData.name_address);
    
    const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
    console.log("🔑 API 키 확인:", apiKey ? "있음" : "없음");

    if (!apiKey) {
      console.error("❌ 카카오 REST API 키가 없습니다.");
      alert("카카오 API 키가 설정되지 않았습니다.");
      return;
    }

    try {
      console.log("📍 주소 검색 시도...");
      // 주소 검색
      const addressResponse = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(formData.name_address)}&size=1`, {
        headers: {
          "Authorization": `KakaoAK ${apiKey}`
        }
      });
      
      console.log("📋 주소 검색 응답 상태:", addressResponse.status);
      
      if (!addressResponse.ok) {
        console.error("❌ 주소 검색 실패:", addressResponse.status, addressResponse.statusText);
        throw new Error(`주소 검색 실패: ${addressResponse.status}`);
      }

      const addressData = await addressResponse.json();
      console.log("📋 주소 검색 결과:", addressData);

      if (addressData.documents && addressData.documents.length > 0) {
        const firstResult = addressData.documents[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        
        console.log("✅ 주소 찾음:", { lat, lng, address: firstResult.address_name });
        
        // 상태 업데이트
        setFormData(prev => ({
          ...prev,
          name_address: firstResult.address_name || formData.name_address,
          latitude: lat,
          longitude: lng,
          kakao_place_id: null,
        }));
        
        setMapCenter({ lat, lng });
        
        // 검색 결과를 places에 추가
        setSearchedPlaces([{
          place_name: firstResult.address_name || formData.name_address,
          address_name: firstResult.address_name,
          y: lat.toString(),
          x: lng.toString(),
          kakao_place_id: null,
        }]);
        
      } else {
        // 키워드 검색 (장소명으로 검색)
        console.log("🔍 키워드 검색 시도...");
        const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(formData.name_address)}&size=1`, {
          headers: {
            "Authorization": `KakaoAK ${apiKey}`
          }
        });
        
        console.log("📋 키워드 검색 응답 상태:", keywordResponse.status);
        
        if (!keywordResponse.ok) {
          console.error("❌ 키워드 검색 실패:", keywordResponse.status, keywordResponse.statusText);
          throw new Error(`키워드 검색 실패: ${keywordResponse.status}`);
        }

        const keywordData = await keywordResponse.json();
        console.log("📋 키워드 검색 결과:", keywordData);

        if (keywordData.documents && keywordData.documents.length > 0) {
          const firstResult = keywordData.documents[0];
          const lat = parseFloat(firstResult.y);
          const lng = parseFloat(firstResult.x);
          
          console.log("✅ 키워드 찾음:", { lat, lng, place: firstResult.place_name });
          
          // 상태 업데이트
          const kpId =
            firstResult.id != null && /^\d+$/.test(String(firstResult.id))
              ? String(firstResult.id)
              : null;
          setFormData(prev => ({
            ...prev,
            name_address: firstResult.place_name,
            latitude: lat,
            longitude: lng,
            kakao_place_id: kpId,
          }));
          
          setMapCenter({ lat, lng });
          
          // 검색 결과를 places에 추가
          const searchResult = [{
            place_name: firstResult.place_name,
            address_name: firstResult.address_name,
            y: lat.toString(),
            x: lng.toString(),
            kakao_place_id: kpId,
          }];
          
          console.log("🔍 검색 결과 데이터:", searchResult);
          setSearchedPlaces(searchResult);
          
        } else {
          console.warn("⚠️ 검색 결과 없음");
          alert("검색 결과를 찾을 수 없습니다. 지도를 클릭하여 위치를 선택해주세요.");
        }
      }
    } catch (error) {
      console.error("❌ StudioHome 검색 오류:", error);
      alert("검색 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleSelectPlace = (place) => {
    const kp =
      place?.kakao_place_id ||
      (place?.id != null && /^\d+$/.test(String(place.id))
        ? String(place.id)
        : null);
    setFormData(prev => ({
      ...prev,
      name_address: place.place_name,
      latitude: parseFloat(place.y),
      longitude: parseFloat(place.x),
      kakao_place_id: kp || prev.kakao_place_id,
    }));
    setSearchedPlaces([]);
    setMapCenter({ lat: parseFloat(place.y), lng: parseFloat(place.x) });
  };

  const endLive = () => {
    setStats((prev) => ({ ...prev, isLive: false, notificationSent: false }));
  };

  const handleLiveStartWithNotification = () => {
    console.log("알림 발송됨");
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

  const studioCornerButtonStyle = {
    minHeight: "34px",
    height: "34px",
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    lineHeight: 1.2,
    boxSizing: "border-box",
    border: "none",
    color: "white",
    whiteSpace: "nowrap",
  };

  return (
    <div style={styles.studioShell}>
      {/* 좌측 상단: 홈 · 내 저장(폴더) — 스튜디오 잔 작업과 분리 */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          maxWidth: "calc(100% - 24px)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            ...studioCornerButtonStyle,
            backgroundColor: "#2ECC71",
          }}
        >
          홈
        </button>
      </div>
      
      <header style={{ marginTop: "8px", marginBottom: "10px", padding: "0 8px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.02em" }}>
          @{curatorProfile.username}님의
        </div>
        <h1 style={{ fontSize: "clamp(18px, 3.4vw, 22px)", fontWeight: 800, margin: "3px 0 0", lineHeight: 1.15, letterSpacing: "-0.03em" }}>
          스튜디오
        </h1>
      </header>
      
      {/* 섹션 탭 — 한 줄 (좁으면 가로 스크롤) */}
      <div style={styles.topBarWrap}>
        <button
          type="button"
          title="잔 올리기"
          onClick={() => {
            setEditingDraftId(null);
            setEditingPlaceId(null);
            try {
              localStorage.removeItem("editing_place_id");
            } catch (_) {
              /* ignore */
            }
            setActiveSection("add");
          }}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "add" ? styles.topBarButtonActive : {}),
          }}
        >
          잔 올리기
        </button>
        <button
          type="button"
          title="잔 리스트"
          onClick={() => setActiveSection("list")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "list" ? styles.topBarButtonActive : {}),
          }}
        >
          잔 리스트
        </button>
        <button
          type="button"
          title="잔 채우기"
          onClick={() => setActiveSection("drafts")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "drafts" ? styles.topBarButtonActive : {}),
          }}
        >
          잔 채우기
        </button>
        <button
          type="button"
          title="잔 아카이브"
          onClick={() => setActiveSection("archive")}
          style={{
            ...styles.topBarButton,
            ...(activeSection === "archive" ? styles.topBarButtonActive : {}),
          }}
        >
          잔 아카이브
        </button>
      </div>

      {/* 잔 올리기 섹션 */}
      {activeSection === "add" && (
        <div style={styles.studioSectionInner}>
          {/* 장소/주소 검색 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>장소 또는 주소 검색</label>
            <div style={{ position: "relative", zIndex: 1000 }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    type="text"
                    value={formData.name_address}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (formData.name_address.trim()) {
                        fetchSuggestions(formData.name_address);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }, 200);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 35px 10px 10px",
                      border: "1px solid #333",
                      borderRadius: "6px",
                      backgroundColor: "#222",
                      color: "white",
                      fontSize: "14px",
                      zIndex: 1001,
                      boxSizing: "border-box"
                    }}
                    placeholder="장소 이름 또는 주소를 입력하세요"
                    tabIndex={1}
                  />
                  {formData.name_address && (
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, name_address: "" }));
                        setSearchSuggestions([]);
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }}
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#666",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: "2px",
                        zIndex: 1002
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#2ECC71",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    whiteSpace: "nowrap",
                    zIndex: 1001,
                    flexShrink: 0
                  }}
                  tabIndex={2}
                >
                  🔍 검색
                </button>
              </div>
              
              {/* 자동완성 리스트 */}
              {showSuggestions && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: "0",
                  right: "0",
                  backgroundColor: "#333",
                  border: "1px solid #444",
                  borderTop: "none",
                  borderRadius: "0 0 6px 6px",
                  maxHeight: "180px",
                  overflowY: "auto",
                  zIndex: 1000,
                  marginTop: "1px"
                }}>
                  {searchSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: "8px 10px",
                        cursor: "pointer",
                        backgroundColor: index === selectedSuggestionIndex ? "#444" : "transparent",
                        color: index === selectedSuggestionIndex ? "#2ECC71" : "white",
                        fontSize: "13px",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      onMouseLeave={() => setSelectedSuggestionIndex(-1)}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                        🔍 {suggestion.place_name}
                      </div>
                      {suggestion.address_name && (
                        <div style={{ fontSize: "11px", color: "#999" }}>
                          {suggestion.address_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 지도 영역 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>위치 선택 (지도를 클릭하세요)</label>
            <div style={{ 
              height: "400px", 
              width: "100%",
              borderRadius: "8px", 
              overflow: "hidden",
              border: "1px solid #333",
              backgroundColor: "#f0f0f0"
            }}>
              <MapView
                key={`map-${activeSection}`}
                ref={mapRef}
                places={searchedPlaces.length > 0 ? searchedPlaces.map(place => ({
                  id: place.place_name,
                  name: place.place_name,
                  address: place.address_name,
                  latitude: parseFloat(place.y),
                  longitude: parseFloat(place.x),
                  category: "",
                  is_public: true,
                  created_at: new Date().toISOString().split('T')[0]
                })) : defaultPlaces}
                center={mapCenter}
                style={{ 
                  width: "100%", 
                  height: "100%",
                  display: "block"
                }}
              />
            </div>
            {formData.latitude && formData.longitude && (
              <div style={{ marginTop: "10px", color: "#666", fontSize: "12px" }}>
                선택된 좌표: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
              </div>
            )}
          </div>

          {/* 카테고리 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>카테고리</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #333",
                borderRadius: "6px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
              tabIndex={3}
            >
              <option value="">선택하세요</option>
              {STUDIO_PLACE_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {formData.category &&
              !STUDIO_PLACE_CATEGORY_OPTIONS.includes(formData.category) ? (
                <option value={formData.category}>{formData.category}</option>
              ) : null}
            </select>
          </div>

          {/* 술종류 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>술종류</label>
            <select
              value={formData.alcohol_type}
              onChange={(e) => setFormData(prev => ({ ...prev, alcohol_type: e.target.value }))}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #333",
                borderRadius: "6px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
              tabIndex={4}
            >
              <option value="">선택하세요</option>
              {STUDIO_LIQUOR_TYPE_OPTIONS.map((a) => (
                <option key={`alc-opt-${a}`} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* 분위기 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>분위기</label>
            <select
              value={formData.atmosphere}
              onChange={(e) => setFormData(prev => ({ ...prev, atmosphere: e.target.value }))}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #333",
                borderRadius: "6px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
              tabIndex={5}
            >
              <option value="">선택하세요</option>
              {STUDIO_ATMOSPHERE_OPTIONS.map((m) => (
                <option key={`atm-opt-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 추천이유 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>추천이유</label>
            <textarea
              value={formData.menu_reason}
              onChange={(e) => setFormData(prev => ({ ...prev, menu_reason: e.target.value }))}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #333",
                borderRadius: "6px",
                backgroundColor: "#222",
                color: "white",
                fontSize: "14px",
                minHeight: "64px",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box"
              }}
              placeholder="추천하는 이유를 알려주세요"
              tabIndex={6}
            />
          </div>

          {/* 해시태그 */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>해시태그</label>
            
            {/* 자주 쓰는 태그 */}
            <div style={{ marginBottom: "15px" }}>
              <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>⭐ 자주 쓰는 태그</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {frequentTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (!formData.tags.includes(tag)) {
                        setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      backgroundColor: formData.tags.includes(tag) ? "#3498DB" : "#444",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 전체 태그 보기 */}
            {!showAllTags ? (
              <button
                onClick={() => setShowAllTags(true)}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#666",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  marginBottom: "15px"
                }}
              >
                📂 전체 태그 보기
              </button>
            ) : (
              <div style={{ marginBottom: "15px" }}>
                {Object.entries(allTags).map(([category, tags]) => (
                  <div key={category} style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>{category}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {tags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            if (!formData.tags.includes(tag)) {
                              setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            backgroundColor: formData.tags.includes(tag) ? "#3498DB" : "#444",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setShowAllTags(false)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#666",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    marginTop: "5px"
                  }}
                >
                  ▼ 접기
                </button>
              </div>
            )}
            
            {/* 직접 입력 (자동완성) */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={tagInputValue}
                onChange={(e) => handleTagInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  // 한글 IME 조합 중 Enter/Space는 태그 확정으로 쓰지 않음 (끝 글자 중복·오입 방지)
                  if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                  e.preventDefault();
                  const trimmedValue = String(
                    e.currentTarget?.value ?? ""
                  ).trim();
                  if (!trimmedValue) return;

                  const existingTag = allTagsList.find(
                    (tag) =>
                      tag.toLowerCase() === trimmedValue.toLowerCase()
                  );
                  const tagToAdd = existingTag || trimmedValue;

                  setFormData((prev) => {
                    if (prev.tags.includes(tagToAdd)) return prev;
                    return { ...prev, tags: [...prev.tags, tagToAdd] };
                  });
                  setTagInputValue("");
                  setTagSuggestions([]);
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  backgroundColor: "#222",
                  color: "white",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
                placeholder="태그 검색 또는 직접 입력 (엔터로 추가)"
                tabIndex={7}
              />
              
              {/* 자동완성 제안 */}
              {tagSuggestions.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "#333",
                  border: "1px solid #444",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  maxHeight: "150px",
                  overflowY: "auto",
                  zIndex: 10
                }}>
                  {tagSuggestions.map((tag, index) => (
                    <div
                      key={index}
                      onClick={() => handleTagSuggestionClick(tag)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #444",
                        fontSize: "14px",
                        color: "#ccc"
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "#444"}
                      onMouseLeave={(e) => e.target.style.backgroundColor = "#333"}
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* 선택된 태그 목록 */}
            {formData.tags.length > 0 && (
              <div style={{ 
                marginTop: "10px", 
                display: "flex", 
                flexWrap: "wrap", 
                gap: "8px" 
              }}>
                {formData.tags.map((tag, index) => (
                  <div
                    key={index}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 8px",
                      backgroundColor: "#444",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "white",
                      border: "1px solid #555"
                    }}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{
                        marginLeft: "4px",
                        background: "none",
                        border: "none",
                        color: "#999",
                        cursor: "pointer",
                        fontSize: "10px",
                        padding: "0",
                        lineHeight: "1"
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 내 저장 폴더 (저장 시 user_saved_places — SaveModal과 동일) */}
          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "600",
                fontSize: "12px",
              }}
            >
              내 저장 폴더
            </label>
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: "11px",
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.35,
              }}
            >
              실제 저장 시 카카오 「저장」 목록에도 같은 폴더로 들어갑니다. 1개 이상 선택하세요.
            </p>
            {savedFoldersLoading ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.45)",
                  marginBottom: "8px",
                }}
              >
                폴더 불러오는 중…
              </div>
            ) : null}
            {savedFoldersLoadError ? (
              <div
                style={{
                  color: "#e74c3c",
                  fontSize: "12px",
                  marginBottom: "8px",
                }}
              >
                {savedFoldersLoadError}
              </div>
            ) : null}
            <div style={addPlaceFolderPickerStyles.grid}>
              {sortedSavedFolders.map((f) => {
                const selected = addPlaceSelectedFolders.includes(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleAddPlaceFolder(f.key)}
                    style={{
                      ...addPlaceFolderPickerStyles.btnBase,
                      borderColor: f.color,
                      backgroundColor: selected
                        ? f.color
                        : "rgba(255, 255, 255, 0.05)",
                      ...(selected ? addPlaceFolderPickerStyles.btnSelected : {}),
                    }}
                  >
                    <span style={addPlaceFolderPickerStyles.fIcon}>{f.icon}</span>
                    <span
                      style={{
                        ...addPlaceFolderPickerStyles.fName,
                        color: selected ? "#fff" : f.color,
                      }}
                    >
                      {f.name}
                    </span>
                  </button>
                );
              })}
              {!addPlaceShowNewFolder ? (
                <button
                  type="button"
                  onClick={() => setAddPlaceShowNewFolder(true)}
                  style={addPlaceFolderPickerStyles.addBtn}
                >
                  <span style={addPlaceFolderPickerStyles.addIcon}>+</span>
                  <span style={addPlaceFolderPickerStyles.addText}>새 폴더</span>
                </button>
              ) : null}
            </div>
            {addPlaceShowNewFolder ? (
              <div style={addPlaceFolderPickerStyles.newFolderBox}>
                <input
                  type="text"
                  value={addPlaceNewFolderName}
                  onChange={(e) => setAddPlaceNewFolderName(e.target.value)}
                  placeholder="폴더 이름"
                  style={addPlaceFolderPickerStyles.newFolderInput}
                  autoFocus
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !addPlaceNewFolderSaving &&
                    handleAddPlaceCustomFolder()
                  }
                />
                <div style={addPlaceFolderPickerStyles.newFolderActions}>
                  <button
                    type="button"
                    disabled={addPlaceNewFolderSaving}
                    onClick={handleAddPlaceCustomFolder}
                    style={addPlaceFolderPickerStyles.newFolderOk}
                  >
                    {addPlaceNewFolderSaving ? "…" : "✓"}
                  </button>
                  <button
                    type="button"
                    disabled={addPlaceNewFolderSaving}
                    onClick={() => {
                      setAddPlaceShowNewFolder(false);
                      setAddPlaceNewFolderName("");
                    }}
                    style={addPlaceFolderPickerStyles.newFolderCancel}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : null}
            {addPlaceSelectedFolders.length > 0 ? (
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {addPlaceSelectedFolders.length}개 폴더 선택됨
              </div>
            ) : null}
          </div>

          {/* 장소 사진 (저장 시 업로드) */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "12px" }}>
              장소 사진 (선택, 최대 8장)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files || []).filter((f) =>
                  isAcceptableRasterImageFile(f)
                );
                setAddPlacePhotoFiles((prev) =>
                  [...prev, ...picked].slice(0, 8)
                );
                e.target.value = "";
              }}
              style={{ color: "#ccc", fontSize: "13px", maxWidth: "100%" }}
            />
            {addPlacePhotoFiles.length > 0 ? (
              <ul
                style={{
                  fontSize: "12px",
                  color: "#aaa",
                  margin: "10px 0 0 0",
                  paddingLeft: "18px",
                  listStyle: "disc",
                }}
              >
                {addPlacePhotoFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}-${f.size}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAddPlacePhotoFiles((p) => p.filter((_, j) => j !== i))
                      }
                      style={{
                        background: "#444",
                        border: "none",
                        color: "#fff",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        padding: "2px 8px",
                      }}
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p style={{ fontSize: "11px", color: "#888", marginTop: "8px", marginBottom: 0 }}>
              「저장」 시 함께 올라갑니다. 검색으로 고른 카카오 장소면 같은 ID로 지도 카드에서도 보입니다.
            </p>
          </div>

          {/* 버튼들 */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => handleAddPlace(true)}
              style={{
                padding: "9px 18px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
              tabIndex={8}
            >
              임시저장
            </button>
            <button
              onClick={() => handleAddPlace(false)}
              style={{
                padding: "9px 18px",
                backgroundColor: "#2ECC71",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
              }}
              tabIndex={9}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 잔 리스트 섹션 */}
      {activeSection === "list" && (
        <div style={styles.studioSectionInner}>
          <div style={{ marginBottom: "6px", textAlign: "left" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: savedFoldersListExpanded ? "8px" : "4px",
                maxWidth: "320px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSavedFoldersListExpanded((open) => {
                    if (open) {
                      setSavedFoldersEditMode(false);
                      setSavedShowNewFolder(false);
                      setSavedNewFolderName("");
                    }
                    return !open;
                  });
                }}
                aria-expanded={savedFoldersListExpanded}
                style={listSavedFolderStyles.savedFoldersCollapseTrigger}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  내 저장 폴더
                </span>
                <span style={listSavedFolderStyles.savedFoldersChevron}>
                  {savedFoldersListExpanded ? "▲" : "▼"}
                </span>
              </button>
              {savedFoldersListExpanded ? (
                <button
                  type="button"
                  disabled={savedFoldersLoading}
                  aria-pressed={savedFoldersEditMode}
                  onClick={() => {
                    if (savedFoldersEditMode) {
                      setSavedFoldersEditMode(false);
                    } else {
                      setSavedFoldersEditMode(true);
                    }
                  }}
                  style={listSavedFolderStyles.editToggleBtn}
                >
                  {savedFoldersEditMode ? "완료" : "편집"}
                </button>
              ) : null}
            </div>
            {!savedFoldersListExpanded && savedFoldersLoading ? (
              <div
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "11px",
                  marginBottom: "6px",
                  maxWidth: "320px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                폴더 불러오는 중…
              </div>
            ) : null}
            {!savedFoldersListExpanded && savedFoldersLoadError ? (
              <div
                style={{
                  color: "#e74c3c",
                  fontSize: "12px",
                  marginBottom: "8px",
                  maxWidth: "320px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                {savedFoldersLoadError}
              </div>
            ) : null}
            {savedFoldersListExpanded && savedFoldersLoadError ? (
              <div
                style={{
                  color: "#e74c3c",
                  fontSize: "12px",
                  marginBottom: "8px",
                }}
              >
                {savedFoldersLoadError}
              </div>
            ) : null}
            {savedFoldersListExpanded && savedFoldersLoading ? (
              <div
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "12px",
                  marginBottom: "8px",
                }}
              >
                폴더 불러오는 중…
              </div>
            ) : null}
            {savedFoldersListExpanded && !savedFoldersLoading ? (
              <>
                <div style={listSavedFolderStyles.grid}>
                  {sortedSavedFolders.map((f) => {
                    const list = savedByFolder[f.key] || [];
                    const n = list.length;
                    const active = savedFolderKey === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() =>
                          setSavedFolderKey((k) => (k === f.key ? null : f.key))
                        }
                        style={{
                          ...listSavedFolderStyles.folderBtn,
                          borderColor: f.color,
                          borderWidth: 2,
                          backgroundColor: active
                            ? f.color
                            : "rgba(255, 255, 255, 0.05)",
                          ...(active ? listSavedFolderStyles.folderBtnActive : {}),
                        }}
                      >
                        <span style={listSavedFolderStyles.fIcon}>{f.icon}</span>
                        <span
                          style={{
                            ...listSavedFolderStyles.fLabel,
                            color: active ? "#fff" : f.color,
                          }}
                        >
                          {f.name}{" "}
                          <span style={listSavedFolderStyles.fCountInline}>
                            ({n})
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {!savedShowNewFolder ? (
                    <button
                      type="button"
                      onClick={() => setSavedShowNewFolder(true)}
                      style={listSavedFolderStyles.addBtn}
                    >
                      <span style={listSavedFolderStyles.addIcon}>+</span>
                      <span style={listSavedFolderStyles.addTextInline}>
                        새 폴더
                      </span>
                    </button>
                  ) : null}
                </div>
                {savedShowNewFolder ? (
                  <div style={listSavedFolderStyles.newFolderBox}>
                    <input
                      type="text"
                      value={savedNewFolderName}
                      onChange={(e) => setSavedNewFolderName(e.target.value)}
                      placeholder="폴더 이름"
                      style={listSavedFolderStyles.newFolderInput}
                      autoFocus
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !savedFolderSaving &&
                        handleAddSavedFolder()
                      }
                    />
                    <div style={listSavedFolderStyles.newFolderActions}>
                      <button
                        type="button"
                        disabled={savedFolderSaving}
                        onClick={handleAddSavedFolder}
                        style={listSavedFolderStyles.newFolderOk}
                      >
                        {savedFolderSaving ? "…" : "✓"}
                      </button>
                      <button
                        type="button"
                        disabled={savedFolderSaving}
                        onClick={() => {
                          setSavedShowNewFolder(false);
                          setSavedNewFolderName("");
                        }}
                        style={listSavedFolderStyles.newFolderCancel}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : null}
                {savedFoldersEditMode &&
                !savedFoldersLoading &&
                savedFolderKey &&
                isDeletableUserSavedFolderKey(savedFolderKey) ? (
                  <div style={listSavedFolderStyles.folderDeleteBarWrap}>
                    <button
                      type="button"
                      disabled={
                        savedFolderMetaDeletingKey === savedFolderKey
                      }
                      onClick={() => handleDeleteSavedFolder(savedFolderKey)}
                      style={listSavedFolderStyles.folderDeleteBarBtn}
                    >
                      {savedFolderMetaDeletingKey === savedFolderKey
                        ? "삭제 중…"
                        : `「${
                            sortedSavedFolders.find((x) => x.key === savedFolderKey)
                              ?.name ?? "폴더"
                          }」 삭제`}
                    </button>
                  </div>
                ) : null}
                {savedFoldersEditMode &&
                !savedFoldersLoading &&
                !(
                  savedFolderKey &&
                  isDeletableUserSavedFolderKey(savedFolderKey)
                ) ? (
                  <div style={listSavedFolderStyles.editPanel}>
                    {savedFolderKey &&
                    !isDeletableUserSavedFolderKey(savedFolderKey) ? (
                      <p style={listSavedFolderStyles.editHint}>
                        기본 폴더 7개는 삭제가 불가해요.
                      </p>
                    ) : !hasDeletableSavedFolders ? (
                      <p style={listSavedFolderStyles.editHint}>
                        지금 목록에는 고정 7개 폴더만 있어요. 「새 폴더」로 추가한 뒤에는 편집
                        중에 그 폴더를 탭해 선택하면 목록 맨 아래 「…삭제」버튼이 나와요.
                      </p>
                    ) : (
                      <p style={listSavedFolderStyles.editHint}>
                        고정 7개를 제외한 폴더를 탭해 선택하면 폴더 줄 전체 아래에 「삭제」가
                        나와요. 다시 탭하면 선택이 풀려요. 삭제 후 「완료」로 편집을 닫을 수
                        있어요.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div
            style={{
              width: "100%",
              height: 1,
              backgroundColor: "rgba(255,255,255,0.12)",
              margin: "16px 0 14px",
            }}
            aria-hidden
          />

          {savedFolderKey &&
          !isDeletableUserSavedFolderKey(savedFolderKey) ? (
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: "11px",
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.4,
                textAlign: "left",
              }}
            >
              아래 목록은「
              {sortedSavedFolders.find((x) => x.key === savedFolderKey)?.name}
              」폴더에 넣은 장소만 보여요. 폴더를 다시 누르면 전체 잔으로 돌아갑니다.
            </p>
          ) : null}

          {/* 잔 리스트 검색 — flex 부모·긴 플레이스홀더로 가로 넘침 방지 */}
          <div
            style={{
              position: "relative",
              marginBottom: "14px",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <input
              type="text"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder={
                savedFolderKey
                  ? "이 폴더 안 잔만 검색 (장소명/카테고리/주소)"
                  : "잔리스트 검색 (장소명/카테고리/주소)"
              }
              style={{
                display: "block",
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                padding: "10px 12px",
                paddingRight: listSearchQuery.trim() ? "38px" : "12px",
                borderRadius: "8px",
                border: "1px solid #3a3a3a",
                backgroundColor: "#1f1f1f",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
              }}
            />
            {listSearchQuery.trim() ? (
              <button
                type="button"
                aria-label="검색어 지우기"
                title="검색어 지우기"
                onClick={() => setListSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "28px",
                  height: "28px",
                  padding: 0,
                  margin: 0,
                  border: "none",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "18px",
                  lineHeight: 1,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ×
              </button>
            ) : null}
          </div>

          {/* 필터 버튼 */}
          <div style={{ 
            display: "flex", 
            gap: "8px", 
            marginBottom: "12px",
            flexWrap: "wrap"
          }}>
            <button
              onClick={() => setFilterType("all")}
              style={{
                padding: "6px 12px",
                backgroundColor: filterType === "all" ? "#2ECC71" : "#444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              전체
            </button>
            <button
              onClick={() => setFilterType("public")}
              style={{
                padding: "6px 12px",
                backgroundColor: filterType === "public" ? "#2ECC71" : "#444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              공개
            </button>
            <button
              onClick={() => setFilterType("private")}
              style={{
                padding: "6px 12px",
                backgroundColor: filterType === "private" ? "#2ECC71" : "#444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              비공개
            </button>
          </div>
          
          {/* 장소 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* 필터링된 myPlaces 데이터 표시 */}
            {(() => {
              let filteredPlaces = myPlaces;
              const normalizedQuery = listSearchQuery.trim().toLowerCase();
              
              if (filterType === "public") {
                filteredPlaces = myPlaces.filter(
                  (place) => place.is_public !== false
                );
              } else if (filterType === "private") {
                filteredPlaces = myPlaces.filter(
                  (place) => place.is_public === false
                );
              }

              if (savedFolderKey && savedFolderPlaceIdSet) {
                filteredPlaces = filteredPlaces.filter((place) =>
                  savedFolderPlaceIdSet.has(String(place.id))
                );
              }

              if (normalizedQuery) {
                filteredPlaces = filteredPlaces.filter((place) => {
                  const name = (place?.name || "").toLowerCase();
                  const category = (place?.category || "").toLowerCase();
                  const address = (place?.address || "").toLowerCase();
                  return (
                    name.includes(normalizedQuery) ||
                    category.includes(normalizedQuery) ||
                    address.includes(normalizedQuery)
                  );
                });
              }

              const folderFilteredEmpty =
                Boolean(savedFolderKey) &&
                myPlaces.length > 0 &&
                filteredPlaces.length === 0;
              
              return filteredPlaces.length === 0 ? (
                <div style={{
                  backgroundColor: "#222",
                  padding: "24px 16px",
                  borderRadius: "8px",
                  textAlign: "center",
                  color: "#666",
                  fontSize: "13px",
                }}>
                  {folderFilteredEmpty ? (
                    <div style={{ color: "#e0c896", lineHeight: 1.55 }}>
                      「내 저장」폴더가 선택된 상태입니다. 이 모드에서는 그 폴더에 넣은 장소만 보입니다.
                      <br />
                      <strong style={{ color: "#fff" }}>임포트·추천 잔 전체</strong>를 보려면 상단 폴더 칩을 다시 눌러 선택을 해제하세요.
                    </div>
                  ) : savedFolderKey
                    ? filterType === "public"
                      ? "이 폴더에 속한 공개 잔이 없습니다."
                      : filterType === "private"
                        ? "이 폴더에 속한 비공개 잔이 없습니다."
                        : "이 폴더에 넣은 장소가 없거나, 아직 내 잔에 올리지 않았어요."
                    : filterType === "public"
                      ? "공개 장소가 없습니다."
                      : filterType === "private"
                        ? "비공개 장소가 없습니다."
                        : "저장된 장소가 없습니다."}
                </div>
              ) : (
                filteredPlaces.map(place => (
                <div key={place.id} style={{
                  backgroundColor: "#222",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "bold" }}>
                      {place.name}
                    </h3>
                    <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "12px" }}>
                      {place.category} • {place.created_at}
                    </p>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {/* 수정 버튼 */}
                    <button
                      onClick={() => handleEditPlace(place)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#3498DB",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      수정
                    </button>
                    
                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleDeletePlace(place.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#E74C3C",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      삭제
                    </button>
                    
                    {/* 공개/비공개 토글 버튼 - 맨 오른쪽 */}
                    <button
                      onClick={() => handleTogglePublic(place.id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: place.is_public ? "#2ECC71" : "#E74C3C",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                        minWidth: "50px"
                      }}
                    >
                      {place.is_public ? "공개" : "비공개"}
                    </button>
                  </div>
                </div>
              ))
            )})()}
          </div>
        </div>
      )}

      {/* 잔 채우기 (임시저장) 섹션 */}
      {activeSection === "drafts" && (
        <div style={styles.studioSectionInner}>
          {/* 초안 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* 임시로 예시 데이터 */}
            {drafts.map(draft => (
              <div key={draft.id} style={{
                backgroundColor: "#222",
                padding: "12px 14px",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "bold" }}>
                    {draft.basicInfo.name_address}
                  </h3>
                  <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "12px" }}>
                    {draft.basicInfo.category} • {draft.createdAt}
                  </p>
                  <span style={{
                    display: "inline-block",
                    padding: "4px 8px",
                    backgroundColor: "#F39C12",
                    color: "white",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}>
                    초안
                  </span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {/* 수정 버튼 */}
                  <button
                    onClick={() => handleEditDraft(draft)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#3498DB",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    수정
                  </button>
                  
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDeleteDraft(draft.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#E74C3C",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            
            {/* 실제 데이터가 없을 때 */}
            {drafts.length === 0 && (
              <div style={{
                textAlign: "center",
                padding: "24px 16px",
                backgroundColor: "#222",
                borderRadius: "8px",
                color: "#666",
                fontSize: "13px",
              }}>
                임시저장된 초안이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 잔 아카이브 섹션 */}
      {activeSection === "archive" && (
        <div style={styles.studioSectionInner}>
          {/* 큐레이터 프로필 */}
          <div style={{
            backgroundColor: "#222",
            padding: "16px 14px",
            borderRadius: "10px",
            marginBottom: "16px",
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box",
            overflow: "hidden",
          }}>
            {/* 큐레이터 사진 — 보기: 원만 / 수정: 원 + 원 밖 「사진 올리기」 */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {isEditingProfile && (
                <input
                  ref={profileEditAvatarFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleProfileEditAvatarFile}
                />
              )}
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  fontSize: "14px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {(isEditingProfile ? editProfile.image : curatorProfile.image) ? (
                  <img
                    src={
                      isEditingProfile ? editProfile.image : curatorProfile.image
                    }
                    alt={curatorProfile.displayName || curatorProfile.username}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ textAlign: "center", fontSize: "12px" }}>사진</div>
                )}
              </div>
              {isEditingProfile && (
                <button
                  type="button"
                  title="프로필 사진 올리기"
                  aria-label="프로필 사진 올리기"
                  onClick={() => profileEditAvatarFileRef.current?.click()}
                  style={{
                    margin: 0,
                    padding: "5px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#fff",
                    backgroundColor: "#444",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  사진 올리기
                </button>
              )}
            </div>
            
            {/* 프로필 정보 */}
            <div style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
              {isEditingProfile ? (
                // 수정 모드
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ color: "#ccc", fontSize: "12px", fontWeight: "600" }}>
                      @큐레이터명 (주소)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", flexWrap: "wrap" }}>
                      <span style={{ color: "#3498DB", fontSize: "16px", fontWeight: "600" }}>@</span>
                      <input
                        type="text"
                        value={editProfile.username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="영문 소문자·숫자·_"
                        style={{
                          flex: 1,
                          minWidth: "140px",
                          padding: "8px 12px",
                          backgroundColor: "#333",
                          color: "white",
                          border: usernameError ? "1px solid #E74C3C" : "1px solid #444",
                          borderRadius: "4px",
                          fontSize: "16px",
                          fontWeight: "600",
                          boxSizing: "border-box",
                          maxWidth: "280px"
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleUpdateUsername}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#95A5A6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          flexShrink: 0
                        }}
                      >
                        자동생성
                      </button>
                    </div>
                    {usernameError && (
                      <div style={{ color: "#E74C3C", fontSize: "12px", marginTop: "4px" }}>
                        {usernameError}
                      </div>
                    )}
                    <div style={{ color: "#666", fontSize: "11px" }}>
                      3–20자, 영문 소문자·숫자·밑줄만
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ color: "#ccc", fontSize: "12px", fontWeight: "600" }}>
                      별명
                    </label>
                    <input
                      type="text"
                      value={editProfile.displayName}
                      onChange={(e) => setEditProfile(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="화면에 보이는 이름"
                      style={{
                        padding: "7px 10px",
                        backgroundColor: "#333",
                        color: "white",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontWeight: "600",
                        width: "100%",
                        boxSizing: "border-box",
                        maxWidth: "100%"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ color: "#ccc", fontSize: "12px", fontWeight: "600" }}>
                      한줄 소개
                    </label>
                    <input
                      type="text"
                      value={editProfile.bio}
                      onChange={(e) => setEditProfile(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="한 줄로 소개해 보세요"
                      maxLength={200}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#333",
                        color: "white",
                        border: "1px solid #444",
                        borderRadius: "4px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box",
                        maxWidth: "100%"
                      }}
                    />
                    <div style={{ color: "#666", fontSize: "11px", textAlign: "right" }}>
                      {(editProfile.bio || "").length}/200
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={handleSaveProfile}
                      disabled={!!usernameError}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: usernameError ? "#95A5A6" : "#2ECC71",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: usernameError ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#E74C3C",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // 보기 모드
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "nowrap",
                      alignItems: "baseline",
                      gap: 0,
                      width: "100%",
                      margin: "0 0 8px 0",
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <span
                      style={{
                        flex: "0 0 50%",
                        minWidth: 0,
                        maxWidth: "50%",
                        fontSize: "clamp(15px, 3.5vw, 17px)",
                        fontWeight: 700,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        boxSizing: "border-box",
                      }}
                      title={curatorProfile.displayName || ""}
                    >
                      {curatorProfile.displayName}
                    </span>
                    <span
                      style={{
                        flex: "0 0 50%",
                        minWidth: 0,
                        maxWidth: "50%",
                        fontSize: "clamp(12px, 3vw, 14px)",
                        fontWeight: 600,
                        color: "#3498DB",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        boxSizing: "border-box",
                      }}
                      title={`@${curatorProfile.username || ""}`}
                    >
                      @{curatorProfile.username}
                    </span>
                  </div>
                  <p style={{
                    margin: "0 0 12px 0",
                    color: "#ccc",
                    fontSize: "clamp(11px, 2.8vw, 13px)",
                    lineHeight: 1.45,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    maxWidth: "100%",
                  }}>
                    {curatorProfile.bio}
                  </p>
                  
                  {/* 큐레이터 등급 — 활동상태 (컴팩트 한 줄) */}
                  <div
                    style={{
                      backgroundColor: "#333",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      marginBottom: "12px",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "4px 8px",
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      lineHeight: 1.2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          filter: "grayscale(0%) brightness(1.15)",
                          lineHeight: 1,
                        }}
                      >
                        {curatorProfile.grade === "diamond" ? "👑" :
                         curatorProfile.grade === "platinum" ? "🏆" :
                         curatorProfile.grade === "gold" ? "⭐" :
                         curatorProfile.grade === "silver" ? "🌟" : "🌱"}
                      </span>
                      <span
                        style={{
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {curatorProfile.grade === "diamond" ? "다이아몬드" :
                         curatorProfile.grade === "platinum" ? "플래티넘" :
                         curatorProfile.grade === "gold" ? "골드" :
                         curatorProfile.grade === "silver" ? "실버" : "브론즈"} 큐레이터
                      </span>
                    </div>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.32)",
                        fontSize: "11px",
                        fontWeight: 500,
                        userSelect: "none",
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      {" "}-{" "}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        backgroundColor:
                          curatorProfile.status === "active" ? "#1a3d2a" :
                          curatorProfile.status === "warning" ? "#3d2a1a" :
                          curatorProfile.status === "suspended" ? "#3d1a1a" : "#2a2a2a",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color:
                            curatorProfile.status === "active" ? "#2ECC71" :
                            curatorProfile.status === "warning" ? "#F39C12" :
                            curatorProfile.status === "suspended" ? "#E74C3C" : "#95A5A6",
                          whiteSpace: "nowrap",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {curatorProfile.status === "active" ? "✅ 활동중" :
                         curatorProfile.status === "warning" ? "⚠️ 경고" :
                         curatorProfile.status === "suspended" ? "🚫 활동중지" : "💤 휴면"}
                      </span>
                      {curatorProfile.warning_count > 0 && (
                        <span
                          style={{
                            color: "#F39C12",
                            fontSize: "10px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          경고 {curatorProfile.warning_count}회
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "nowrap",
                      alignItems: "stretch",
                      gap: "6px",
                      width: "100%",
                      minWidth: 0,
                      maxWidth: "100%",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleEditProfile}
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "transparent",
                        color: "rgba(255,255,255,0.88)",
                        border: "1px solid rgba(255,255,255,0.28)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "600",
                        flex: "0 0 auto",
                        transition: "background-color 0.15s ease, border-color 0.15s ease",
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = "rgba(255,255,255,0.06)";
                        e.target.style.borderColor = "rgba(255,255,255,0.4)";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.borderColor = "rgba(255,255,255,0.28)";
                      }}
                    >
                      프로필 수정
                    </button>
                    <button
                      type="button"
                      onClick={
                        stats.isLive
                          ? endLive
                          : () => setLiveStartConfirmOpen(true)
                      }
                      title={
                        stats.isLive
                          ? `라이브 중지 — ${stats.notificationSent ? "알림 발송됨" : "알림 미발송"}`
                          : "라이브 시작"
                      }
                      style={{
                        flex: "1 1 0%",
                        minWidth: 0,
                        maxWidth: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "600",
                        boxSizing: "border-box",
                        border: stats.isLive
                          ? "1px solid rgba(0,0,0,0.15)"
                          : "1px solid transparent",
                        backgroundColor: stats.isLive ? "#C0392B" : "#2ECC71",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          width: "100%",
                          textAlign: "center",
                          lineHeight: 1.25,
                        }}
                      >
                        {stats.isLive ? (
                          <>
                            <span aria-hidden style={{ marginRight: "3px" }}>
                              🔴
                            </span>
                            라이브
                            <span style={{ fontWeight: 500, opacity: 0.9 }}>
                              {stats.notificationSent
                                ? " · 발송"
                                : " · 미발송"}
                            </span>
                          </>
                        ) : (
                          "라이브 시작"
                        )}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* 통계 — 2×2 컴팩트 */}
          <div style={styles.archiveStatsGrid} role="region" aria-label="큐레이터 통계">
            <div style={styles.archiveStatCell} title="공개·비공개 포함 잔 기록 수">
              <div style={styles.archiveStatValue}>{myPlaces.length}</div>
              <div style={styles.archiveStatLabel}>잔 기록</div>
              <div style={styles.archiveStatSub}>공개·비공개 포함</div>
            </div>
            <button
              type="button"
              title="내 잔 중 다른 큐레이터도 올린 장소 — 탭하여 목록"
              aria-expanded={showOverlapPlacesList}
              aria-label={`겹친 장소 ${curatorStats.overlapSharedPlaceCount ?? 0}곳, 목록 ${showOverlapPlacesList ? "접기" : "펼치기"}`}
              onClick={() => setShowOverlapPlacesList((v) => !v)}
              style={{
                ...styles.archiveStatCell,
                cursor: "pointer",
                width: "100%",
                margin: 0,
                font: "inherit",
                color: "inherit",
                textAlign: "center",
                WebkitAppearance: "none",
                appearance: "none",
              }}
            >
              <div style={styles.archiveStatValue}>
                {curatorStats.overlapSharedPlaceCount ?? 0}
              </div>
              <div style={styles.archiveStatLabel}>겹친 장소</div>
              <div style={styles.archiveStatSub}>
                다른 큐레이터와 같은 곳
                {(curatorStats.overlapSharedPlaceCount ?? 0) > 0
                  ? " · 탭하여 목록"
                  : ""}
              </div>
            </button>
            <div style={styles.archiveStatCell} title="유저들이 내 추천 장소에 저장한 횟수">
              <div style={styles.archiveStatValue}>{curatorStats.saveCount || 0}</div>
              <div style={styles.archiveStatLabel}>잔 반응</div>
              <div style={styles.archiveStatSub}>유저의 저장 횟수</div>
            </div>
            <button
              type="button"
              title="picked · picks 목록"
              aria-label={`picked ${curatorStats.followerCount || 0}명, picks ${curatorStats.followingCount || 0}명, 목록 보기`}
              onClick={() => navigate("/studio/followers")}
              style={{
                ...styles.archiveStatCell,
                cursor: "pointer",
                width: "100%",
                margin: 0,
                font: "inherit",
                color: "inherit",
                textAlign: "center",
                WebkitAppearance: "none",
                appearance: "none",
              }}
            >
              <div style={styles.archiveStatValue}>
                {curatorStats.followerCount || 0}
                <span style={{ opacity: 0.45, fontWeight: 600, margin: "0 2px" }}>
                  ·
                </span>
                {curatorStats.followingCount || 0}
              </div>
              <div style={styles.archiveStatLabel}>picked · picks</div>
              <div style={styles.archiveStatSub}>탭하여 목록</div>
            </button>
          </div>

          {showOverlapPlacesList && (
            <div
              role="region"
              aria-label="겹친 장소 목록"
              style={{
                marginTop: "4px",
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "10px",
                backgroundColor: "#252525",
                border: "1px solid rgba(255,255,255,0.08)",
                maxHeight: "min(52vh, 320px)",
                overflowY: "auto",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#bbb",
                  marginBottom: "10px",
                }}
              >
                다른 큐레이터와 같은 곳 ({overlapSharedPlacesList.length}곳)
              </div>
              {overlapSharedPlacesList.length === 0 ? (
                <div style={{ color: "#777", fontSize: "12px", lineHeight: 1.5 }}>
                  {(curatorStats.overlapSharedPlaceCount ?? 0) === 0
                    ? "겹친 장소가 없습니다."
                    : "목록을 불러오지 못했습니다. Supabase에 마이그레이션 studio_curator_overlap_places 적용 후 새로고침해 주세요."}
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {overlapSharedPlacesList.map((row) => (
                    <li
                      key={String(row.place_id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        backgroundColor: "#1e1e1e",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#eee",
                          marginBottom: "4px",
                          wordBreak: "break-word",
                        }}
                      >
                        {row.place_name || "(이름 없음)"}
                      </div>
                      {row.place_address ? (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            lineHeight: 1.4,
                            wordBreak: "break-word",
                          }}
                        >
                          {row.place_address}
                        </div>
                      ) : null}
                      {row.other_curator_handles ? (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#7eb6d6",
                            lineHeight: 1.45,
                            marginTop: "6px",
                            wordBreak: "break-word",
                          }}
                        >
                          큐레이터: {row.other_curator_handles}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 잔 아카이브 인사이트: 한 줄 TOP · 스타일 · 팔로워 행동 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginBottom: "20px",
            }}
            role="region"
            aria-label="잔 아카이브 인사이트"
          >
            <div
              style={{
                backgroundColor: "#2a2a2a",
                borderRadius: "10px",
                padding: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                💬 한 줄 TOP
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "11px",
                  marginBottom: "10px",
                  lineHeight: 1.35,
                }}
              >
                한 줄평을 적어 둔 장소마다 저장 수를 세고, 그중 반응이 많은 순(상위 5곳)
              </div>
              {archiveExtInsights.oneLineTop.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
                  아직 한 줄이 없거나, 저장이 0건이에요.
                </div>
              ) : (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    color: "#eee",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  {archiveExtInsights.oneLineTop.map((row, idx) => (
                    <li
                      key={row.placeId ? `${row.placeId}` : `${idx}-${row.text.slice(0, 24)}`}
                      style={{ marginBottom: "6px" }}
                    >
                      {row.placeName ? (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "rgba(255,255,255,0.45)",
                            marginBottom: "2px",
                            wordBreak: "break-word",
                          }}
                        >
                          {row.placeName}
                        </div>
                      ) : null}
                      <span style={{ fontWeight: 600 }}>“{row.text}”</span>
                      <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "6px" }}>
                        → 저장 {row.saves}건
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div
              style={{
                backgroundColor: "#2a2a2a",
                borderRadius: "10px",
                padding: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                🎨 내 스타일 분석
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "11px",
                  marginBottom: "12px",
                  lineHeight: 1.35,
                }}
              >
                잔에 적은 값과 장소 마스터에 저장된 태그·주종·분위기·업종을 합쳐 비율을 계산합니다
              </div>
              {archiveInsightsError ? (
                <div
                  role="alert"
                  style={{
                    color: "#e59866",
                    fontSize: "11px",
                    marginBottom: "12px",
                    lineHeight: 1.45,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(231, 76, 60, 0.12)",
                    border: "1px solid rgba(231, 76, 60, 0.25)",
                  }}
                >
                  통계를 불러오지 못했습니다: {archiveInsightsError}
                </div>
              ) : null}
              {(() => {
                const blocks = [
                  { title: "주종", key: "alcohol", rows: archiveExtInsights.style.alcohol },
                  { title: "분위기", key: "moods", rows: archiveExtInsights.style.moods },
                  { title: "태그", key: "tags", rows: archiveExtInsights.style.tags },
                  { title: "업종", key: "categories", rows: archiveExtInsights.style.categories },
                ];
                const any = blocks.some((b) => b.rows.length > 0);
                if (!any) {
                  return (
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
                      잔 올리기에서 주종·분위기·태그·카테고리를 넣으면 비율이 잡혀요.
                    </div>
                  );
                }
                return blocks.map((b) =>
                  b.rows.length === 0 ? null : (
                    <div key={b.key} style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          fontSize: "11px",
                          fontWeight: 600,
                          marginBottom: "6px",
                        }}
                      >
                        {b.title}
                      </div>
                      {b.rows.map((r) => (
                        <div
                          key={`${b.key}-${r.label}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "5px",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              flex: "0 0 38%",
                              fontSize: "11px",
                              color: "#ddd",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={r.label}
                          >
                            {r.label}
                          </span>
                          <div
                            style={{
                              flex: "1 1 auto",
                              height: "6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(255,255,255,0.12)",
                              overflow: "hidden",
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                width: `${r.pct}%`,
                                height: "100%",
                                borderRadius: "4px",
                                backgroundColor: "#F39C12",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              flex: "0 0 32px",
                              fontSize: "11px",
                              color: "rgba(255,255,255,0.65)",
                              textAlign: "right",
                            }}
                          >
                            {r.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                );
              })()}
            </div>

            <div
              style={{
                backgroundColor: "#2a2a2a",
                borderRadius: "10px",
                padding: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                🤝 팔로워 행동
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: "11px",
                  marginBottom: "10px",
                  lineHeight: 1.35,
                }}
              >
                picked 가 내 픽에 남긴 저장 · 그 저장이 몰린 지역 · 내 픽 장소 한잔 누적(전체
                사용자)
              </div>
              <div style={{ color: "#eee", fontSize: "12px", marginBottom: "8px" }}>
                <span style={{ fontWeight: 700 }}>
                  {archiveExtInsights.followers.savesOnPicks}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: "4px" }}>
                  건 저장
                </span>
                <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 6px" }}>·</span>
                <span style={{ fontWeight: 700 }}>
                  {archiveExtInsights.followers.distinctSavers}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: "4px" }}>
                  명이 참여
                </span>
              </div>
              <div style={{ color: "#eee", fontSize: "12px", marginBottom: "10px" }}>
                <span style={{ fontWeight: 700 }}>
                  {archiveExtInsights.followers.checkinsTotal}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: "4px" }}>
                  한잔 누적 (내 픽 장소)
                </span>
              </div>
              {archiveExtInsights.followers.regions.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
                  팔로워 저장이 생기면 주소 앞부분 기준으로 지역이 모여요.
                </div>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    color: "#eee",
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  {archiveExtInsights.followers.regions.map((r) => (
                    <li key={r.label}>
                      {r.label}{" "}
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>
                        (+{r.saves} 저장)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* 📈 이번 주 성장 피드백 */}
          <div style={{
            backgroundColor: "#34495E",
            padding: "20px",
            borderRadius: "12px",
            marginBottom: "30px",
            border: "1px solid #2C3E50"
          }}>
            <div style={{ 
              color: "white", 
              fontSize: "14px", 
              fontWeight: "bold",
              marginBottom: "15px"
            }}>
              📈 성장 추이 (지난주 대비)
            </div>
            
            {/* 그래프 영역 */}
            <div style={{ 
              backgroundColor: "rgba(255,255,255,0.1)", 
              borderRadius: "8px", 
              padding: "15px", 
              marginBottom: "15px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                <span>지난주</span>
                <span>이번주</span>
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                {/* 잔 기록 */}
                {(() => {
                  const nPlw = curatorStats.lastWeekStats?.newPlaces || 0;
                  const nPtw = curatorStats.weeklyStats?.newPlaces || 0;
                  const placesScale = Math.max(8, nPlw, nPtw);
                  return (
                <div style={{ flex: 1 }}>
                  <div style={{ color: "white", fontSize: "11px", marginBottom: "6px", textAlign: "center" }}>잔 기록</div>
                  <div style={{ overflow: "hidden", paddingTop: "24px" }}>
                  <div style={{ position: "relative", height: "80px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", overflow: "hidden" }}>
                    <svg style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      zIndex: 1,
                      overflow: "hidden"
                    }}>
                      <line
                        x1="20%"
                        y1={`${growthTrendLineYPercent(nPlw, placesScale)}%`}
                        x2="80%"
                        y2={`${growthTrendLineYPercent(nPtw, placesScale)}%`}
                        stroke="#E74C3C"
                        strokeWidth="2"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        style={{ animation: "lineDraw 1s ease-out 0.1s forwards" }}
                      />
                    </svg>
                    <div style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "rgba(231, 76, 60, 0.5)",
                      borderRadius: "50%",
                      border: "2px solid #E74C3C",
                      position: "relative",
                      zIndex: 2,
                      bottom: `${(nPlw / placesScale) * 52}px`,
                      animation: "bounce 0.6s ease-out"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.8)",
                        whiteSpace: "nowrap"
                      }}>
                        {nPlw}
                      </div>
                    </div>
                    <div style={{
                      width: "16px",
                      height: "16px",
                      backgroundColor: "#E74C3C",
                      borderRadius: "50%",
                      border: "3px solid rgba(255,255,255,0.3)",
                      position: "relative",
                      zIndex: 2,
                      bottom: `${(nPtw / placesScale) * 52}px`,
                      boxShadow: "0 0 10px rgba(231, 76, 60, 0.5)",
                      animation: "bounce 0.6s ease-out 0.2s both"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "10px",
                        color: "#E74C3C",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        animation: "fadeInUp 0.4s ease-out 0.5s both"
                      }}>
                        {nPtw > nPlw ? "▲" :
                         nPtw < nPlw ? "▼" : "─"}
                        {nPtw}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
                  );
                })()}
                {/* 잔 반응 */}
                {(() => {
                  const nSlw = curatorStats.lastWeekStats?.newSaves || 0;
                  const nStw = curatorStats.weeklyStats?.newSaves || 0;
                  const savesScale = Math.max(40, nSlw, nStw);
                  return (
                <div style={{ flex: 1 }}>
                  <div style={{ color: "white", fontSize: "11px", marginBottom: "6px", textAlign: "center" }}>잔 반응</div>
                  <div style={{ overflow: "hidden", paddingTop: "24px" }}>
                  <div style={{ position: "relative", height: "80px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", overflow: "hidden" }}>
                    <svg style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      zIndex: 1,
                      overflow: "hidden"
                    }}>
                      <line
                        x1="20%"
                        y1={`${growthTrendLineYPercent(nSlw, savesScale)}%`}
                        x2="80%"
                        y2={`${growthTrendLineYPercent(nStw, savesScale)}%`}
                        stroke="#F39C12"
                        strokeWidth="2"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        style={{ animation: "lineDraw 1s ease-out 0.3s forwards" }}
                      />
                    </svg>
                    <div style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "rgba(243, 156, 18, 0.5)",
                      borderRadius: "50%",
                      border: "2px solid #F39C12",
                      position: "relative",
                      zIndex: 2,
                      bottom: `${(nSlw / savesScale) * 52}px`
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.8)",
                        whiteSpace: "nowrap"
                      }}>
                        {nSlw}
                      </div>
                    </div>
                    <div style={{
                      width: "16px",
                      height: "16px",
                      backgroundColor: "#F39C12",
                      borderRadius: "50%",
                      border: "3px solid rgba(255,255,255,0.3)",
                      position: "relative",
                      zIndex: 2,
                      bottom: `${(nStw / savesScale) * 52}px`,
                      boxShadow: "0 0 10px rgba(243, 156, 18, 0.5)",
                      animation: "bounce 0.6s ease-out 0.4s both"
                    }}>
                      <div style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "10px",
                        color: "#F39C12",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                        animation: "fadeInUp 0.4s ease-out 0.7s both"
                      }}>
                        {nStw > nSlw ? "▲" :
                         nStw < nSlw ? "▼" : "─"}
                        {nStw}
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
                  );
                })()}
                {/* picked — 이번 주 신규 팔로워만 (picks 아님) */}
                {(() => {
                  const plw = curatorStats.lastWeekStats?.newFollowers || 0;
                  const ptw = curatorStats.weeklyStats?.newFollowers || 0;
                  const pickedScale = Math.max(5, plw, ptw);
                  return (
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "white", fontSize: "11px", marginBottom: "6px", textAlign: "center" }}>picked</div>
                      <div style={{ overflow: "hidden", paddingTop: "24px" }}>
                      <div style={{ position: "relative", height: "80px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", overflow: "hidden" }}>
                        <svg style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          zIndex: 1,
                          overflow: "hidden"
                        }}>
                          <line
                            x1="20%"
                            y1={`${growthTrendLineYPercent(plw, pickedScale)}%`}
                            x2="80%"
                            y2={`${growthTrendLineYPercent(ptw, pickedScale)}%`}
                            stroke="#9B59B6"
                            strokeWidth="2"
                            strokeDasharray="300"
                            strokeDashoffset="300"
                            style={{ animation: "lineDraw 1s ease-out 0.5s forwards" }}
                          />
                        </svg>
                        <div style={{
                          width: "12px",
                          height: "12px",
                          backgroundColor: "rgba(155, 89, 182, 0.5)",
                          borderRadius: "50%",
                          border: "2px solid #9B59B6",
                          position: "relative",
                          zIndex: 2,
                          bottom: `${(plw / pickedScale) * 52}px`
                        }}>
                          <div style={{
                            position: "absolute",
                            bottom: "20px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: "10px",
                            color: "rgba(255,255,255,0.8)",
                            whiteSpace: "nowrap"
                          }}>
                            {plw}
                          </div>
                        </div>
                        <div style={{
                          width: "16px",
                          height: "16px",
                          backgroundColor: "#9B59B6",
                          borderRadius: "50%",
                          border: "3px solid rgba(255,255,255,0.3)",
                          position: "relative",
                          zIndex: 2,
                          bottom: `${(ptw / pickedScale) * 52}px`,
                          boxShadow: "0 0 10px rgba(155, 89, 182, 0.5)",
                          animation: "bounce 0.6s ease-out 0.6s both"
                        }}>
                          <div style={{
                            position: "absolute",
                            bottom: "20px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: "10px",
                            color: "#9B59B6",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                            animation: "fadeInUp 0.4s ease-out 0.9s both"
                          }}>
                            {ptw > plw ? "▲" : ptw < plw ? "▼" : "─"}
                            {ptw}
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* CSS 애니메이션 스타일 - 완전히 제거 */}
            </div>
            
            <div style={{ 
              fontSize: "12px", 
              color: "white", 
              fontWeight: "bold",
              paddingTop: "10px",
              borderTop: "1px solid rgba(255,255,255,0.2)"
            }}>
              🔥 이번 주 최고 반응 잔
              <div style={{ fontSize: "11px", fontWeight: "normal", marginTop: "3px", lineHeight: 1.35 }}>
                {curatorStats.weekTopReactingPlace ? (
                  <>
                    → {curatorStats.weekTopReactingPlace} (저장{" "}
                    {curatorStats.weekTopReactingSaves})
                  </>
                ) : (curatorStats.weeklyStats?.newSaves || 0) > 0 ? (
                  <>→ 이번 주 저장 합계 {curatorStats.weeklyStats.newSaves}건</>
                ) : (
                  <>→ 이번 주 추천 잔에 새 저장이 없어요</>
                )}
              </div>
            </div>
          </div>
          </div>
      )}

      {liveStartConfirmOpen && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            backgroundColor: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            boxSizing: "border-box",
          }}
          onClick={() => setLiveStartConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-start-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "340px",
              backgroundColor: "#2a2a2a",
              borderRadius: "12px",
              padding: "20px 18px 16px",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
              textAlign: "left",
            }}
          >
            <button
              type="button"
              onClick={() => setLiveStartConfirmOpen(false)}
              title="닫기"
              aria-label="닫기"
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                width: "32px",
                height: "32px",
                padding: 0,
                margin: 0,
                border: "none",
                borderRadius: "8px",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.9)",
                fontSize: "22px",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
            <h2
              id="live-start-dialog-title"
              style={{
                margin: "0 36px 10px 0",
                fontSize: "17px",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              라이브 시작
            </h2>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              팔로워에게 알림을 보낼까요?
              <br />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                × 또는 바깥 영역을 누르면 취소됩니다.
              </span>
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={handleLiveStartWithNotification}
                style={{
                  padding: "10px 14px",
                  backgroundColor: "#3498DB",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                알림 보내고 시작
              </button>
              <button
                type="button"
                onClick={handleLiveStartWithoutNotification}
                style={{
                  padding: "10px 14px",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                알림 없이 라이브 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 잔 올리기 — 폴더 다중 선택 (SaveModal과 유사) */
const addPlaceFolderPickerStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
    width: "100%",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
    justifyItems: "stretch",
  },
  btnBase: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "4px",
    padding: "5px 6px",
    minHeight: "36px",
    borderRadius: "8px",
    borderStyle: "solid",
    borderWidth: 2,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxSizing: "border-box",
    minWidth: 0,
    width: "100%",
    font: "inherit",
    textAlign: "left",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
  },
  btnSelected: { transform: "scale(0.98)" },
  fIcon: { fontSize: "13px", lineHeight: 1, flexShrink: 0 },
  fName: {
    fontSize: "10px",
    fontWeight: "bold",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
  },
  addBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "4px",
    padding: "5px 6px",
    minHeight: "36px",
    border: "2px dashed rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.6)",
    boxSizing: "border-box",
    minWidth: 0,
    width: "100%",
    font: "inherit",
  },
  addIcon: { fontSize: "13px", lineHeight: 1, flexShrink: 0 },
  addText: {
    fontSize: "10px",
    fontWeight: "bold",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
    textAlign: "left",
  },
  newFolderBox: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
    border: "2px solid #3498DB",
    borderRadius: "8px",
    backgroundColor: "#1a1a1a",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  newFolderInput: {
    padding: "6px 8px",
    border: "1px solid #333",
    borderRadius: "4px",
    backgroundColor: "#252525",
    color: "#ffffff",
    fontSize: "12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  newFolderActions: { display: "flex", gap: "6px", justifyContent: "flex-end" },
  newFolderOk: {
    backgroundColor: "#3498DB",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  newFolderCancel: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
};

/** 잔 리스트 탭 — 내 저장 폴더 그리드 (낮은 행 · 제목과 개수 한 줄) */
const listSavedFolderStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    width: "100%",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
    justifyItems: "stretch",
    alignItems: "start",
  },
  folderDeleteBarWrap: {
    width: "100%",
    maxWidth: "320px",
    marginTop: "12px",
    marginLeft: "auto",
    marginRight: "auto",
    boxSizing: "border-box",
  },
  folderDeleteBarBtn: {
    width: "100%",
    margin: 0,
    padding: "10px 12px",
    border: "1px solid rgba(231,76,60,0.55)",
    borderRadius: "8px",
    background: "rgba(231,76,60,0.2)",
    color: "#ffb4a8",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.3,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "block",
    textAlign: "center",
    boxSizing: "border-box",
  },
  folderBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "4px",
    padding: "5px 6px",
    borderRadius: "8px",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "36px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
    position: "relative",
    zIndex: 10,
    boxSizing: "border-box",
    minWidth: 0,
    width: "100%",
    font: "inherit",
    textAlign: "left",
    borderStyle: "solid",
    borderWidth: 2,
  },
  folderBtnActive: { transform: "scale(0.95)" },
  fIcon: { fontSize: "13px", lineHeight: 1, flexShrink: 0 },
  fLabel: {
    fontSize: "10px",
    fontWeight: "bold",
    lineHeight: 1.2,
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
  },
  fCountInline: { fontWeight: 700, opacity: 0.92 },
  addBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "4px",
    padding: "5px 6px",
    border: "2px dashed rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    cursor: "pointer",
    minHeight: "36px",
    color: "rgba(255, 255, 255, 0.6)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    boxSizing: "border-box",
    minWidth: 0,
    width: "100%",
    font: "inherit",
  },
  addIcon: { fontSize: "13px", lineHeight: 1, flexShrink: 0 },
  addTextInline: {
    fontSize: "10px",
    fontWeight: "bold",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
    textAlign: "left",
  },
  newFolderBox: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
    border: "2px solid #3498DB",
    borderRadius: "8px",
    backgroundColor: "#1a1a1a",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  newFolderInput: {
    padding: "6px 8px",
    border: "1px solid #333",
    borderRadius: "4px",
    backgroundColor: "#252525",
    color: "#ffffff",
    fontSize: "12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  newFolderActions: { display: "flex", gap: "6px", justifyContent: "flex-end" },
  newFolderOk: {
    backgroundColor: "#3498DB",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  newFolderCancel: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  savedFoldersCollapseTrigger: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "4px 2px",
    margin: 0,
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    textAlign: "left",
  },
  savedFoldersChevron: {
    fontSize: "9px",
    lineHeight: 1,
    opacity: 0.65,
    flexShrink: 0,
  },
  editToggleBtn: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.88)",
    cursor: "pointer",
  },
  editPanel: {
    marginTop: "12px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
    maxWidth: "320px",
    marginLeft: "auto",
    marginRight: "auto",
    width: "100%",
    boxSizing: "border-box",
  },
  editHint: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.5)",
    margin: 0,
    lineHeight: 1.45,
  },
};

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
  archiveStatsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "auto auto",
    gap: "8px",
    marginBottom: "16px",
    width: "100%",
    maxWidth: "440px",
    marginLeft: "auto",
    marginRight: "auto",
    boxSizing: "border-box",
  },
  archiveStatCell: {
    backgroundColor: "#222",
    padding: "10px 10px 8px",
    borderRadius: "10px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.07)",
    minWidth: 0,
  },
  archiveStatValue: {
    fontSize: "20px",
    fontWeight: 800,
    lineHeight: 1.15,
    marginBottom: "4px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
  },
  archiveStatLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.88)",
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.02em",
  },
  archiveStatSub: {
    fontSize: "10px",
    color: "rgba(255,255,255,0.45)",
    marginTop: "3px",
    lineHeight: 1.2,
    fontWeight: 500,
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
