import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useDragControls } from "framer-motion";
import {
  FaBookmark,
  FaRegBookmark,
  FaGlassWhiskey,
  FaShareAlt,
  FaTimes,
} from "react-icons/fa";

const MotionCard = motion.div;
import { supabase } from "../../lib/supabase";
import CheckinButton from "../CheckinButton/CheckinButton";
import { PlacePickButton } from "../PlacePick/PlacePickButton";
import { PlacePickDetailSummary } from "../PlacePick/PlacePickDetailSummary";
import SaveModal from "../SaveModal/SaveModal";
import { useToast } from "../Toast/ToastProvider";
import { useAuth } from "../../context/AuthContext";
import { getKakaoPlaceBasicInfoViaProxy } from "../../utils/kakaoAPIProxy";
import { fetchPlacePhotos } from "../../api/placePhotos";
import {
  curatorPhotoPublicUrl,
  deleteCuratorPlacePhoto,
  fetchCuratorPlacePhotoRows,
  uploadCuratorPlacePhoto,
} from "../../utils/curatorPlacePhotos";
import {
  isAcceptableRasterImageFile,
  prepareImageFileForUpload,
} from "../../utils/prepareImageFileForUpload";
import { resolvePlaceWgs84, kakaoNumericPlaceId } from "../../utils/placeCoords";
import { buildKakaoStaticMapUrl } from "../../utils/kakaoStaticMapUrl";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
import {
  normalizeHanjanStats,
  pickHanjanSocialLines,
} from "../../utils/hanjanSocialCopy";
import { readStudioDrafts, writeStudioDrafts } from "../../utils/studioDraftsLocal";
import { createPerfTrace } from "../../utils/devPerfTrace.js";

function mergeUniqueUrls(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const u of list || []) {
      if (typeof u === "string" && u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

export default function PlacePreviewCard({
  place,
  isSaved,
  savedFolderColor,
  liveCuratorNameSet,
  selectedCurators = [],
  /** SaveModal(Supabase) 저장 성공 후 부모에서 목록 갱신 등 */
  onSavedToSupabase,
  onOpenCurator,
  onClose,
  getUserRole,
  searchSessionIdRef,
  /** 직전 검색 feedback 컨텍스트 — 저장 시 `search_place_feedback.save_count` */
  searchFeedbackContextRef = null,
  /** 지도 카드: 1차 반영 후 2차 후보 펄스까지 한 번에 (폴더 저장과 무관) */
  onCourseMapFindSecond,
  courseMapFindSecondEnabled = false,
  courseMapFindSecondBusy = false,
  /** 펄스 2차 후보 카드에서 확정 시 호출 */
  onConfirmCourseSecondHere,
  /** 홈 지도에서 잡은 내 위치 — 있으면 길찾기 출발지로 우선 사용 */
  userLocation = null,
  /** 내 위치→이 장소 도보 경로를 주도 지도(폴리라인)로 표시 */
  onShowArrivalWalkingOnMap,
  /** 지도에 도착 도보 경로가 떠 있을 때 — 넓은 화면에서도 핸들 스와이프로 카드 닫기 */
  arrivalWalkingRouteShown = false,
  /** 낮 모드 등에서 한잔 불가 시 false — 버튼은 보이되 비활성 느낌 */
  canCheckIn = true,
  /** 코스 따라가기 — 한잔 성공 시 도장 연동 */
  courseIdHint = "",
  onCourseStampProgress = null,
}) {
  const { user } = useAuth();
  const curatorPhotoInputRef = useRef(null);
  const cardRef = useRef(null);
  const placeOpenPerfRef = useRef(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [kakaoDetails, setKakaoDetails] = useState(null);
  const [isLoadingKakao, setIsLoadingKakao] = useState(false);
  const [curatorPhotoRows, setCuratorPhotoRows] = useState([]);
  const [placePhotoUrls, setPlacePhotoUrls] = useState([]);
  const [placePhotoAttributions, setPlacePhotoAttributions] = useState([]);
  const [placePhotoSources, setPlacePhotoSources] = useState([]);
  const [placePhotosLoading, setPlacePhotosLoading] = useState(false);
  const [curatorPhotoUploading, setCuratorPhotoUploading] = useState(false);
  const [curatorPhotoDeletingId, setCuratorPhotoDeletingId] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!place?.id) return undefined;
    const trace = createPerfTrace("place:card", {
      placeId: String(place.id),
      name: place?.name || place?.place_name || "",
      kakaoPlaceId: kakaoNumericPlaceId(place),
    });
    placeOpenPerfRef.current = trace;
    return () => {
      placeOpenPerfRef.current?.end({ phase: "place_changed" });
      placeOpenPerfRef.current = null;
    };
  }, [place?.id, place?.name, place?.place_name, place?.kakao_place_id, place?.place_id]);
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const [sheetSwipeEnabled, setSheetSwipeEnabled] = useState(false);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [quickSavePicked, setQuickSavePicked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setSheetSwipeEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setQuickSavePicked(false);
  }, [place?.id, place?.place_id, place?.kakao_place_id]);

  const onSheetDragEnd = useCallback(
    (_, info) => {
      if (info.offset.y > 88 || info.velocity.y > 420) {
        onClose?.();
      }
    },
    [onClose]
  );

  const kakaoPlaceId = kakaoNumericPlaceId(place);

  /** check_ins·한잔함 통계 키 — 카카오 ID 우선 */
  const checkinPlaceKey = useMemo(() => {
    if (kakaoPlaceId) return String(kakaoPlaceId);
    const id = place?.id;
    if (id != null && String(id).trim() !== "") return String(id).trim();
    return null;
  }, [kakaoPlaceId, place?.id]);

  const [hanjanStatsNorm, setHanjanStatsNorm] = useState(null);

  useEffect(() => {
    if (!checkinPlaceKey) {
      setHanjanStatsNorm(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_place_hanjan_stats", {
        p_place_id: String(checkinPlaceKey),
      });
      if (cancelled) return;
      if (!error) setHanjanStatsNorm(normalizeHanjanStats(data));
      else setHanjanStatsNorm(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkinPlaceKey]);

  const refetchHanjanStats = useCallback(() => {
    if (!checkinPlaceKey) return;
    void supabase
      .rpc("get_place_hanjan_stats", { p_place_id: String(checkinPlaceKey) })
      .then(({ data, error }) => {
        if (!error) setHanjanStatsNorm(normalizeHanjanStats(data));
      });
  }, [checkinPlaceKey]);

  const hanjanSocialLines = useMemo(
    () =>
      pickHanjanSocialLines({
        savedCount: place?.savedCount,
        stats: hanjanStatsNorm,
        maxLines: 2,
      }),
    [place?.savedCount, hanjanStatsNorm]
  );
  const primaryHanjanLine = hanjanSocialLines[0] || "";
  const secondaryHanjanLines = hanjanSocialLines.slice(1);

  const internalPlaceIdForPhotos =
    typeof place?.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      place.id
    )
      ? place.id
      : null;

  const isKakaoPlace = place?.isKakaoPlace || false;
  const userRole = getUserRole?.() || "user";
  const isCurator = userRole === "curator" || userRole === "admin";

  const checkinWgs = useMemo(() => resolvePlaceWgs84(place), [place]);

  /** 검색·AI 리스트는 place_name만 있고 name이 비는 경우가 많음 → 카카오 keyword / 구글 사진 공통 */
  const kakaoKeywordQuery = useMemo(() => {
    if (!place) return "";
    const n =
      (typeof place.name === "string" && place.name.trim()) ||
      (typeof place.place_name === "string" && place.place_name.trim()) ||
      "";
    if (n) return n;
    const addr =
      (typeof place.address === "string" && place.address.trim()) ||
      (typeof place.road_address_name === "string" &&
        place.road_address_name.trim()) ||
      (typeof place.address_name === "string" && place.address_name.trim()) ||
      "";
    if (addr) return addr.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
    return "";
  }, [
    place?.name,
    place?.place_name,
    place?.address,
    place?.road_address_name,
    place?.address_name,
  ]);

  // 장소가 바뀔 때 이전 카카오 상세 데이터 초기화
  useEffect(() => {
    setKakaoDetails(null);
  }, [place?.id, place?.place_id, place?.kakao_place_id]);

  const [failedPhotoUrls, setFailedPhotoUrls] = useState(() => new Set());

  const markPhotoUrlFailed = useCallback((url) => {
    if (typeof url !== "string" || !url) return;
    setFailedPhotoUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  /**
   * 카카오 ID가 있으면 UUID·이름 보강과 무관하게 동일 venue로 취급 (enrichment 후 키 변경 → 사진 초기화 방지)
   */
  const venuePhotoKey = useMemo(() => {
    const kid = String(kakaoPlaceId ?? "").trim();
    if (kid) return `k:${kid}`;
    const pid = String(internalPlaceIdForPhotos ?? "").trim();
    if (pid) return `p:${pid}`;
    const q = String(kakaoKeywordQuery ?? "").trim();
    return q ? `q:${q}` : "";
  }, [kakaoPlaceId, internalPlaceIdForPhotos, kakaoKeywordQuery]);

  const photoQueryRef = useRef({
    placeId: "",
    kakaoPlaceId: "",
    name: "",
    address: "",
    lat: null,
    lng: null,
  });

  useEffect(() => {
    setPlacePhotoUrls([]);
    setPlacePhotoAttributions([]);
    setPlacePhotoSources([]);
    setPlacePhotosLoading(false);
    setCuratorPhotoRows([]);
    setFailedPhotoUrls(new Set());
    setHeroPreviewIndex(0);
  }, [venuePhotoKey]);

  // 카카오 place id가 있으면 기본정보 조회 (공식 REST에 detail.json 없음 → 서버에서 keyword 검색 후 id 매칭)
  useEffect(() => {
    if (kakaoPlaceId && !kakaoDetails) {
      if (!kakaoKeywordQuery.trim()) {
        setKakaoDetails({
          place_name: place?.place_name || place?.name || "",
          address:
            place?.address ||
            place?.road_address_name ||
            place?.address_name ||
            "",
          phone: place?.phone || place?.contact,
          category_name: place?.category_name || place?.category || "정보 없음",
        });
        return;
      }
      setIsLoadingKakao(true);
      const lookupLat =
        checkinWgs?.lat ??
        (Number.isFinite(Number(place?.lat)) ? Number(place.lat) : null) ??
        (Number.isFinite(Number(place?.y)) ? Number(place.y) : null);
      const lookupLng =
        checkinWgs?.lng ??
        (Number.isFinite(Number(place?.lng)) ? Number(place.lng) : null) ??
        (Number.isFinite(Number(place?.x)) ? Number(place.x) : null);

      getKakaoPlaceBasicInfoViaProxy(kakaoPlaceId, {
        query: kakaoKeywordQuery,
        x: lookupLng ?? undefined,
        y: lookupLat ?? undefined,
      })
        .then((details) => {
          if (details) {
            setKakaoDetails(details);
          } else {
            console.warn("⚠️ 카카오 상세 응답 없음 — place 기본값 사용");
            setKakaoDetails({
              place_name: place?.place_name || place?.name,
              address: place?.address,
              phone: place?.phone || place?.contact,
              category_name: place?.category_name || place?.category || "정보 없음",
            });
          }
        })
        .catch((error) => {
          console.error("❌ 카카오 장소 정보 로딩 실패 (프록시):", error);
          setKakaoDetails({
            place_name: place?.place_name || place?.name,
            address: place?.address,
            phone: place?.phone || place?.contact,
            category_name: place?.category_name || place?.category || "정보 없음",
          });
        })
        .finally(() => {
          setIsLoadingKakao(false);
          placeOpenPerfRef.current?.mark("kakao_proxy_done");
        });
    } else if (!kakaoPlaceId) {
      if (place?.mapClickNoVenue) return;
      // DB UUID 장소 — keyword·큐레이터 사진 폴백으로 보강하므로 경고 생략
      if (internalPlaceIdForPhotos && kakaoKeywordQuery.trim()) return;
      if (import.meta.env.DEV) {
        console.warn("⚠️ 카카오 place id 없음 - 상세조회 생략", {
          id: place?.id,
          place_id: place?.place_id,
          kakao_place_id: place?.kakao_place_id,
          kakaoId: place?.kakaoId,
          place_url: place?.place_url,
        });
      }
    }
  }, [
    kakaoPlaceId,
    place,
    kakaoDetails,
    kakaoKeywordQuery,
    internalPlaceIdForPhotos,
    checkinWgs?.lat,
    checkinWgs?.lng,
  ]);

  // 카카오 place id가 없는 저장 장소는 장소명으로 기본정보 보강 조회
  useEffect(() => {
    if (kakaoPlaceId || kakaoDetails || !kakaoKeywordQuery.trim()) return;
    if (!window.kakao?.maps?.services) return;

    const placesService = new window.kakao.maps.services.Places();
    const keyword = `${kakaoKeywordQuery} ${place?.address || ""}`.trim();

    placesService.keywordSearch(keyword, (data, status) => {
      if (status !== window.kakao.maps.services.Status.OK || !data?.length) return;
      const best = data[0];
      setKakaoDetails({
        place_name: best.place_name || place?.place_name || place?.name,
        place_id: best.id,
        address: best.road_address_name || best.address_name || place.address,
        phone: best.phone || place.contact || place.phone,
        category_name: best.category_name || place.category_name || place.category,
        x: best.x,
        y: best.y,
        place_url: best.place_url,
      });
    });
  }, [
    kakaoPlaceId,
    kakaoDetails,
    kakaoKeywordQuery,
    place?.address,
    place?.contact,
    place?.phone,
    place?.category_name,
    place?.category,
    place?.name,
    place?.place_name,
  ]);

  // 카카오 장소 카테고리 정제
  const cleanCategory = (categoryName) => {
    if (!categoryName) return '';
    const parts = categoryName.split(' > ');
    return parts[parts.length - 1];
  };

  /** 도로명·지번 분리 표시, 없으면 단일 address 문자열 (긴 주소는 줄바꿈 허용) */
  const addressBlockLines = useMemo(() => {
    const road = String(
      place?.road_address_name || kakaoDetails?.road_address_name || ""
    ).trim();
    const jibun = String(
      place?.address_name || kakaoDetails?.address_name || ""
    ).trim();
    if (road && jibun && road !== jibun) return [road, jibun];
    if (road) return [road];
    if (jibun) return [jibun];
    const single = String(
      kakaoDetails?.address || place?.address || ""
    ).trim();
    return single ? [single] : [];
  }, [
    place?.road_address_name,
    place?.address_name,
    place?.address,
    kakaoDetails?.road_address_name,
    kakaoDetails?.address_name,
    kakaoDetails?.address,
  ]);

  // 상호명만 추출하는 함수
  const extractDisplayName = (fullName) => {
    if (!fullName) return '';
    
    // 구 이름 제거 (강동구, 성북구, 용산구 등)
    const withoutDistrict = fullName.replace(/^[가-힣]+구\s+/, '');
    
    // "테라스", "야장", "루프탑" 등이 포함된 경우, 그 앞까지를 상호명으로 간주
    const placeTypePatterns = ['테라스', '야장', '루프탑', '펍', '바', '가든', '카페', '집', '골목'];
    for (const pattern of placeTypePatterns) {
      const index = withoutDistrict.indexOf(pattern);
      if (index > -1) {
        return withoutDistrict.substring(0, index + pattern.length).trim();
      }
    }
    
    // 패턴이 없으면 전체 반환
    return withoutDistrict.trim();
  };

  const displayPhone = useMemo(() => {
    const raw = place?.phone ?? place?.contact ?? kakaoDetails?.phone ?? "";
    const s =
      typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
    return s || null;
  }, [place?.phone, place?.contact, kakaoDetails?.phone]);

  /** 2차 후보 카드: 1차 장소 기준 직선 거리·도보 추정(약 67m/분) */
  const courseSecondFromFirstCaption = useMemo(() => {
    if (!place?.courseSecondCandidatePick) return null;
    const m = place.courseSecondDistanceFromFirstMeters;
    if (!Number.isFinite(m) || m <= 0) return null;
    const distPart =
      m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
    const walkMin = Math.max(1, Math.round(m / 67));
    const firstName = String(place.courseSecondFromFirstPlaceName || "").trim();
    return { firstName, distPart, walkMin };
  }, [
    place?.courseSecondCandidatePick,
    place?.courseSecondDistanceFromFirstMeters,
    place?.courseSecondFromFirstPlaceName,
  ]);

  // 카카오맵 상세보기 URL
  const handleKakaoView = () => {
    const placeUrl = isKakaoPlace ? place.place_url : kakaoDetails?.place_url;
    if (placeUrl) {
      window.open(placeUrl, '_blank');
    }
  };
  /** DB·지도에서 온 좌표 (큐레이터 전용 장소는 kakaoDetails 없어도 lat/lng만으로 구글 편향 가능) */
  const displayLat =
    checkinWgs?.lat ??
    (kakaoDetails?.y != null ? Number(kakaoDetails.y) : null) ??
    (Number.isFinite(Number(place?.lat)) ? Number(place.lat) : null) ??
    (Number.isFinite(Number(place?.y)) ? Number(place.y) : null);
  const displayLng =
    checkinWgs?.lng ??
    (kakaoDetails?.x != null ? Number(kakaoDetails.x) : null) ??
    (Number.isFinite(Number(place?.lng)) ? Number(place.lng) : null) ??
    (Number.isFinite(Number(place?.x)) ? Number(place.x) : null);
  const buildStaticMapUrl = (w, h, level) =>
    buildKakaoStaticMapUrl(displayLat, displayLng, { w, h, level });

  const curatorPhotoUrls = useMemo(
    () =>
      curatorPhotoRows
        .map((r) => curatorPhotoPublicUrl(r.storage_path))
        .filter(Boolean),
    [curatorPhotoRows]
  );

  const curatorPhotoUrlSet = useMemo(
    () => new Set(curatorPhotoUrls.filter((u) => typeof u === "string" && u)),
    [curatorPhotoUrls]
  );

  const curatorRowByPublicUrl = useMemo(() => {
    const m = new Map();
    for (const row of curatorPhotoRows) {
      const url = curatorPhotoPublicUrl(row.storage_path);
      if (url) m.set(url, row);
    }
    return m;
  }, [curatorPhotoRows]);

  const canUserDeleteCuratorPhotoUrl = (url) => {
    if (!user?.id || typeof url !== "string") return false;
    const row = curatorRowByPublicUrl.get(url);
    return Boolean(row && row.curator_id === user.id);
  };

  const kakaoPlacePageUrl = (isKakaoPlace || kakaoDetails)
    ? isKakaoPlace
      ? place.place_url
      : kakaoDetails?.place_url
    : null;

  /** 서버 프록시 구글 장소 사진 — 클릭 시 카카오맵으로 보내지 않음 */
  const isGoogleProxyPhotoUrl = (url) =>
    typeof url === "string" &&
    (url.includes("/api/google-place-photo-media") ||
      url.includes("/api/google-place-photo-legacy"));

  /** 큐레이터·구글 프록시 사진은 카카오맵 링크로 열지 않음 */
  const photoClickOpensKakao = (url) =>
    Boolean(
      kakaoPlacePageUrl &&
        typeof url === "string" &&
        !curatorPhotoUrlSet.has(url) &&
        !isGoogleProxyPhotoUrl(url)
    );

  /** 서버 `/api/place-photos` 통합 응답 */
  const allPreviewUrls = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const u of placePhotoUrls) {
      if (typeof u === "string" && u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
    return out;
  }, [placePhotoUrls]);

  const visiblePreviewUrls = useMemo(
    () => allPreviewUrls.filter((u) => !failedPhotoUrls.has(u)),
    [allPreviewUrls, failedPhotoUrls]
  );

  const [heroPreviewIndex, setHeroPreviewIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const photoFetchSeqRef = useRef(0);

  useEffect(() => {
    if (heroPreviewIndex < visiblePreviewUrls.length) return;
    setHeroPreviewIndex(0);
  }, [heroPreviewIndex, visiblePreviewUrls.length]);

  const heroPreviewUrl =
    visiblePreviewUrls[heroPreviewIndex] ?? visiblePreviewUrls[0];
  const stripPreviewUrls = visiblePreviewUrls.filter(
    (_, i) => i !== heroPreviewIndex
  );

  const showGooglePhotoCredit =
    placePhotoAttributions.length > 0 &&
    heroPreviewUrl &&
    isGoogleProxyPhotoUrl(heroPreviewUrl);

  const previewHasKakaoOpenablePhoto = useMemo(
    () => visiblePreviewUrls.some((u) => photoClickOpensKakao(u)),
    [visiblePreviewUrls, kakaoPlacePageUrl, curatorPhotoUrlSet]
  );

  const handlePreviewPhotoError = useCallback(
    (url) => {
      markPhotoUrlFailed(url);
      setHeroPreviewIndex((idx) => idx + 1);
    },
    [markPhotoUrlFailed]
  );

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") {
        setLightboxIndex((idx) =>
          visiblePreviewUrls.length
            ? (idx + 1) % visiblePreviewUrls.length
            : idx
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((idx) =>
          visiblePreviewUrls.length
            ? (idx - 1 + visiblePreviewUrls.length) % visiblePreviewUrls.length
            : idx
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, visiblePreviewUrls.length]);

  const openPhotoLightbox = useCallback(
    (index) => {
      if (!visiblePreviewUrls.length) return;
      const safeIndex =
        Number.isFinite(index) && index >= 0 && index < visiblePreviewUrls.length
          ? index
          : 0;
      setLightboxIndex(safeIndex);
      setLightboxOpen(true);
    },
    [visiblePreviewUrls]
  );

  const showCuratorPhotoBadge = curatorPhotoUrls.length > 0;

  /** 구글 장소 검색 보강용 주소 한 줄 */
  const resolvedPlaceAddressLine = useMemo(() => {
    if (typeof place?.address === "string" && place.address.trim()) {
      return place.address.trim();
    }
    if (
      typeof place?.road_address_name === "string" &&
      place.road_address_name.trim()
    ) {
      return place.road_address_name.trim();
    }
    if (typeof place?.address_name === "string" && place.address_name.trim()) {
      return place.address_name.trim();
    }
    if (typeof place?.region === "string" && place.region.trim()) {
      return place.region.trim();
    }
    return "";
  }, [
    place?.address,
    place?.road_address_name,
    place?.address_name,
    place?.region,
  ]);

  photoQueryRef.current = {
    placeId: String(internalPlaceIdForPhotos ?? "").trim(),
    kakaoPlaceId: String(kakaoPlaceId ?? "").trim(),
    name: String(kakaoKeywordQuery ?? "").trim(),
    address: resolvedPlaceAddressLine,
    lat: displayLat,
    lng: displayLng,
  };

  useEffect(() => {
    if (!venuePhotoKey) return undefined;

    const seq = ++photoFetchSeqRef.current;
    let cancelled = false;
    setPlacePhotosLoading(true);

    void (async () => {
      const q = photoQueryRef.current;

      // 1) 큐레이터 — Supabase 직접 (Railway 왕복 없이 빠르게)
      try {
        const rows = await fetchCuratorPlacePhotoRows({
          kakaoPlaceId: q.kakaoPlaceId || undefined,
          internalPlaceId: q.placeId || undefined,
        });
        if (cancelled || seq !== photoFetchSeqRef.current) return;
        if (rows.length > 0) {
          const urls = rows
            .map((r) => curatorPhotoPublicUrl(r.storage_path))
            .filter(Boolean);
          setCuratorPhotoRows(rows);
          if (urls.length > 0) {
            setPlacePhotoUrls(urls);
            setPlacePhotosLoading(false);
          }
        }
      } catch {
        /* ignore */
      }

      // 2) 서버 — 카카오 og / 구글 보강 (기존 URL은 유지·병합)
      try {
        const data = await fetchPlacePhotos({
          placeId: q.placeId || undefined,
          kakaoPlaceId: q.kakaoPlaceId || undefined,
          name: q.name,
          address: q.address,
          lat: q.lat,
          lng: q.lng,
        });
        if (cancelled || seq !== photoFetchSeqRef.current) return;
        setPlacePhotoUrls((prev) => mergeUniqueUrls(prev, data.urls));
        if (data.attributions.length > 0) {
          setPlacePhotoAttributions(data.attributions);
        }
        if (data.sources.length > 0) {
          setPlacePhotoSources(data.sources);
        }
        if (data.curatorPhotos.length > 0) {
          setCuratorPhotoRows(
            data.curatorPhotos.map((row) => ({
              id: row.id,
              curator_id: row.curator_id,
              storage_path: row.storage_path,
              created_at: row.created_at,
            }))
          );
        }
        placeOpenPerfRef.current?.mark("place_photos_done");
        placeOpenPerfRef.current?.end({ phase: "photos_settled" });
        placeOpenPerfRef.current = null;
      } catch (err) {
        if (cancelled || seq !== photoFetchSeqRef.current) return;
        if (import.meta.env.DEV) {
          console.warn("[place-photos]", err?.message || err);
        }
      } finally {
        if (!cancelled && seq === photoFetchSeqRef.current) {
          setPlacePhotosLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [venuePhotoKey]);

  const showPhotoSkeleton =
    placePhotosLoading && visiblePreviewUrls.length === 0;

  const canCuratorUploadPhoto =
    isCurator &&
    user &&
    (kakaoPlaceId || internalPlaceIdForPhotos);

  const reloadCuratorPlacePhotos = async () => {
    try {
      const data = await fetchPlacePhotos({
        placeId: internalPlaceIdForPhotos || undefined,
        kakaoPlaceId: kakaoPlaceId || undefined,
        name: kakaoKeywordQuery,
        address: resolvedPlaceAddressLine,
        lat: displayLat,
        lng: displayLng,
      });
      setPlacePhotoUrls(data.urls);
      setPlacePhotoAttributions(data.attributions);
      setPlacePhotoSources(data.sources);
      setCuratorPhotoRows(
        data.curatorPhotos.map((row) => ({
          id: row.id,
          curator_id: row.curator_id,
          storage_path: row.storage_path,
          created_at: row.created_at,
        }))
      );
      setHeroImageLoaded(false);
    } catch (err) {
      const rows = await fetchCuratorPlacePhotoRows({
        kakaoPlaceId: kakaoPlaceId || undefined,
        internalPlaceId: internalPlaceIdForPhotos || undefined,
      });
      setCuratorPhotoRows(rows);
      if (import.meta.env.DEV) {
        console.warn("reloadCuratorPlacePhotos", err?.message || err);
      }
    }
  };

  const handleDeleteCuratorPhoto = async (row) => {
    if (!row?.id || !user || row.curator_id !== user.id) return;
    if (!window.confirm("이 사진을 삭제할까요?")) return;
    setCuratorPhotoDeletingId(row.id);
    try {
      await deleteCuratorPlacePhoto({
        id: row.id,
        storagePath: row.storage_path,
      });
      await reloadCuratorPlacePhotos();
      showToast("사진을 삭제했습니다.", "success");
    } catch (err) {
      showToast(err?.message || "삭제에 실패했습니다.", "error");
    } finally {
      setCuratorPhotoDeletingId(null);
    }
  };

  const handleCuratorPhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!kakaoPlaceId && !internalPlaceIdForPhotos) {
      showToast("이 장소에는 사진을 연결할 수 없습니다.", "error");
      return;
    }
    if (!isAcceptableRasterImageFile(file)) {
      showToast("이미지 파일만 업로드할 수 있습니다.", "error");
      return;
    }
    setCuratorPhotoUploading(true);
    try {
      const fileToUpload = await prepareImageFileForUpload(file);
      await uploadCuratorPlacePhoto({
        file: fileToUpload,
        curatorId: user.id,
        kakaoPlaceId: kakaoPlaceId || null,
        placeId: internalPlaceIdForPhotos,
      });
      await reloadCuratorPlacePhotos();
      showToast("사진을 등록했습니다.", "success");
    } catch (err) {
      showToast(err?.message || "업로드에 실패했습니다.", "error");
    } finally {
      setCuratorPhotoUploading(false);
    }
  };

  const staticMapImage = buildStaticMapUrl(800, 360, 3);
  const displayImage =
    isKakaoPlace || kakaoDetails ? null : place?.image || staticMapImage;

  const handleRoadviewOpen = () => {
    if (!displayLat || !displayLng) return;
    window.open(`https://map.kakao.com/link/roadview/${displayLat},${displayLng}`, "_blank");
  };
  const liveSet = liveCuratorNameSet instanceof Set ? liveCuratorNameSet : new Set();
  const isLive = (place.curators || []).some((name) => liveSet.has(name));
  const selectedCuratorNames = Array.isArray(selectedCurators) ? selectedCurators : [];

  /** `curators.name`(한글 별명) → display_name/displayName → @username — 장소 행의 name 필드는 쓰지 않음 */
  const getCuratorDisplayName = (curatorPlace) => {
    const c = curatorPlace?.curators;
    if (c && typeof c === "object") {
      const byName = String(c.name ?? "").trim();
      if (byName) return byName;
      const byDisp = String(
        c.display_name ?? c.displayName ?? ""
      ).trim();
      if (byDisp) return byDisp;
      const byUser = String(c.username ?? "").trim();
      if (byUser) return byUser;
      const bySlug = String(c.slug ?? "").trim();
      if (bySlug) return bySlug;
    }
    return String(curatorPlace?.curator_id ?? "").trim();
  };

  const selectedCuratorLower = new Set(
    selectedCuratorNames
      .map((s) => String(s ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const curatorPlaceMatchesSelected = (curatorPlace) => {
    const candidates = [
      curatorPlace?.curators?.name,
      curatorPlace?.curators?.display_name,
      curatorPlace?.curators?.displayName,
      curatorPlace?.curators?.username,
      curatorPlace?.curator_id,
    ].filter(Boolean);
    return candidates.some((candidate) =>
      selectedCuratorLower.has(String(candidate).trim().toLowerCase())
    );
  };

  const oneLineTrim = (curatorPlace) =>
    String(
      curatorPlace?.one_line_reason ??
        curatorPlace?.menu_reason ??
        curatorPlace?.one_line_review ??
        ""
    ).trim();

  const hasOneLine = (curatorPlace) => oneLineTrim(curatorPlace).length > 0;

  // 상단 한줄평 박스: (1) 선택된 큐레이터 중 한줄평 있는 사람 (2) 아니면 아무나 한줄평 있는 첫 큐레이터
  const featuredCuratorCommentPlace =
    (place.curatorPlaces || []).find(
      (cp) => curatorPlaceMatchesSelected(cp) && hasOneLine(cp)
    ) ||
    (place.curatorPlaces || []).find(hasOneLine) ||
    null;

  const featuredOneLineReason = oneLineTrim(featuredCuratorCommentPlace);
  const showFeaturedCuratorCommentBox = featuredOneLineReason.length > 0;

  // 빠른저장 버튼 핸들러
  const handleQuickSaveClick = async () => {
    const userRole = getUserRole?.() || "user";
    console.log('🔍 빠른저장 클릭 - userRole:', userRole);
    
    // 큐레이터 또는 관리자일 경우 쾌속 잔 채우기
    if (userRole === "curator" || userRole === "admin") {
      console.log('🎯 큐레이터/관리자 - 쾌속 잔 채우기 실행');
      const ok = await handleSaveClick();
      if (ok) setQuickSavePicked(true);
    } else {
      console.log('👥 일반 사용자 - 저장 모달 열기');
      // 일반 사용자는 저장 모달 열기
      setShowSaveModal(true);
    }
  };

  const handleSaveClick = async () => {
    const userRole = getUserRole?.() || "user"; // 기본값 user
    console.log('🔍 handleSaveClick - userRole:', userRole, 'isKakaoPlace:', place.isKakaoPlace);
    
    // 큐레이터 또는 관리자일 경우 쾌속 잔 채우기
    if (userRole === "curator" || userRole === "admin") {
      // 카카오 장소·지도 탭 후 좌표만(근처 POI 없음)은 잔 채우기 드래프트로
      if (place.isKakaoPlace || place.mapClickNoVenue) {
        console.log('📍 잔 채우기 임시저장 (카카오 또는 좌표만)');
        
        // 백그라운드에서 임시저장 시도 (사용자에게는 토스트만 표시)
        const result = await saveToCuratorDrafts(place);
        
        // 결과에 따른 토스트 메시지 표시
        if (result === 'duplicate') {
          showToast('이미 잔 채우기 리스트에 저장된 장소예요.', 'info');
          return true;
        } else if (result === 'success') {
          showToast('잔 채우기 리스트에 임시저장되었습니다!', 'success');
          return true;
        } else {
          alert('❌ 잔 채우기에 실패했습니다.');
          return false;
        }
      }
      
      try {
        // 일반 장소는 기존 방식으로 저장
        const { supabase } = await import("../../lib/supabase");
        if (user?.id) {
          // 잔 채우기 테이블에 저장 (curator_places 테이블)
          const { error } = await supabase
            .from('curator_places')
            .insert({
              curator_id: user.id,
              place_id: place.id
            });
            
          if (error) {
            if (error.code === "23505") {
              showToast("이미 잔 채우기 리스트에 저장된 장소예요.", "info");
              return true;
            }
            console.error('잔 채우기 저장 실패:', error);
            alert('잔 채우기 저장에 실패했습니다.');
            return false;
          }
          
          console.log('✅ 잔 채우기 리스트에 저장 완료');
          alert('✅ 잔 채우기 리스트에 저장되었습니다!');
          return true;
        }
      } catch (error) {
        console.error('쾌속 잔 채우기 오류:', error);
        alert('쾌속 잔 채우기에 실패했습니다.');
        return false;
      }
      return false;
    }
    
    // 일반 사용자일 경우 기존 저장 모달 표시
    setShowSaveModal(true);
    return false;
  };

  // 백그라운드 임시저장 함수
  const saveToCuratorDrafts = async (place) => {
    try {
      if (!user?.id) {
        console.log('⚠️ 로그인된 사용자 없음');
        return 'error';
      }
      
      console.log('📍 쾌속 잔 채우기 시작:', place.name);
      console.log('📍 카카오 장소 ID:', place.kakao_place_id || place.id);
      console.log('📍 현재 사용자 ID:', user.id);
      
      // 1. localStorage에서 기존 drafts 불러오기 (계정별 키)
      const existingDrafts = readStudioDrafts(user.id);
      console.log('📍 기존 drafts:', existingDrafts.length, '개');
      
      // 2. 중복 체크 — 숫자 카카오 ID 우선, 없으면 좌표(지도 클릭 픽 등)
      const dupKeyDraft = (d) => {
        const k = d.kakao_place_id;
        if (k != null && String(k).trim() !== "" && /^\d+$/.test(String(k)))
          return `k:${k}`;
        if (d.place_lat != null && d.place_lng != null)
          return `ll:${Number(d.place_lat).toFixed(5)}_${Number(d.place_lng).toFixed(5)}`;
        return `id:${d.id}`;
      };
      const dupKeyPlace = (p) => {
        const k = p.kakao_place_id;
        if (k != null && String(k).trim() !== "" && /^\d+$/.test(String(k)))
          return `k:${k}`;
        if (p.lat != null && p.lng != null)
          return `ll:${Number(p.lat).toFixed(5)}_${Number(p.lng).toFixed(5)}`;
        return `id:${p.id}`;
      };
      const pk = dupKeyPlace(place);
      const isDuplicate = existingDrafts.some(
        (draft) =>
          draft.curator_id === user.id && dupKeyDraft(draft) === pk
      );
      
      if (isDuplicate) {
        console.log('📍 이미 잔 채우기 리스트에 있는 장소');
        return 'duplicate';
      }
      
      // 3. 새로운 draft 데이터 생성
      const numericKakaoId =
        place.kakao_place_id != null &&
        String(place.kakao_place_id).trim() !== "" &&
        /^\d+$/.test(String(place.kakao_place_id).trim())
          ? String(place.kakao_place_id).trim()
          : null;
      const newDraft = {
        id: `draft_${Date.now()}`,
        curator_id: user.id,
        kakao_place_id: numericKakaoId,
        place_name: place.name,
        place_address: place.address,
        place_lat: place.lat,
        place_lng: place.lng,
        category: place.category || '기타',
        phone: place.phone,
        status: 'draft',
        source: 'quick_save',
        created_at: new Date().toISOString(),
        // 스튜디오 형식에 맞게 구조화
        basicInfo: {
          name_address: place.name,
          category: place.category || '기타',
          alcohol_type: '소주',
          price_range: '중간',
          operating_hours: '정보 없음',
          contact_info: place.phone || '정보 없음'
        },
        alcohol_type: '소주',
        draft_status: 'draft',
        tags: []
      };
      
      // 4. localStorage에 저장
      existingDrafts.push(newDraft);
      writeStudioDrafts(user.id, existingDrafts);
      
      console.log('✅ 잔 채우기 리스트에 임시저장 완료:', newDraft);
      return 'success';
      
    } catch (error) {
      console.error('쾌속 잔 채우기 오류:', error);
      return 'error';
    }
  };
  // 버튼 텍스트 결정
  const getSaveButtonText = () => {
    const userRole = getUserRole?.() || "user"; // 기본값 user
    
    // 큐레이터 또는 관리자일 경우
    if (userRole === "curator" || userRole === "admin") {
      return "쾌속 잔 채우기";
    }
    
    // 일반 사용자일 경우
    return isSaved ? "저장 폴더" : "저장";
  };

  const openWalkingDirections = useCallback(() => {
    const dLat = checkinWgs?.lat;
    const dLng = checkinWgs?.lng;
    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      showToast("이 장소 좌표가 없어 길찾기를 열 수 없습니다.", "error");
      return;
    }
    if (typeof onShowArrivalWalkingOnMap !== "function") {
      showToast("지도에서 길찾기를 쓸 수 없는 화면이에요.", "error");
      return;
    }

    const ul = userLocation;
    const fromProp =
      ul != null &&
      Number.isFinite(Number(ul.lat)) &&
      Number.isFinite(Number(ul.lng))
        ? { lat: Number(ul.lat), lng: Number(ul.lng) }
        : null;

    if (fromProp) {
      onShowArrivalWalkingOnMap({
        fromLat: fromProp.lat,
        fromLng: fromProp.lng,
        toLat: dLat,
        toLng: dLng,
      });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      showToast("이 기기에서 위치를 사용할 수 없습니다.", "error");
      return;
    }

    setDirectionsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDirectionsLoading(false);
        onShowArrivalWalkingOnMap({
          fromLat: pos.coords.latitude,
          fromLng: pos.coords.longitude,
          toLat: dLat,
          toLng: dLng,
        });
      },
      (err) => {
        setDirectionsLoading(false);
        if (err?.code === 1) {
          showToast("위치 권한이 필요합니다. 지도에서 내 위치를 켜 주세요.", "error");
        } else if (err?.code === 3) {
          showToast("위치 확인이 시간 초과되었습니다. 다시 시도해 주세요.", "error");
        } else {
          showToast("현재 위치를 가져올 수 없습니다.", "error");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, [checkinWgs, userLocation, showToast, onShowArrivalWalkingOnMap]);

  const handleShare = (place) => {
    const shareUrl = `${window.location.origin}/place/${place.id}`;
    const shareText = `${place.name} - ${place.curators?.join(', ')} 추천 장소!`;
    
    if (navigator.share) {
      // 모바일 공유 기능
      navigator.share({
        title: place.name,
        text: shareText,
        url: shareUrl
      }).catch(err => console.log('공유 실패:', err));
    } else {
      // 클립보드 복사
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        alert('링크가 복사되었습니다!');
      }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        // 폴백: 프롬프트로 보여주기
        prompt('링크를 복사하세요:', `${shareText}\n${shareUrl}`);
      });
    }
  };

  if (!place) return null;

  const cardBaseStyle = {
    ...styles.card,
    ...(showSaveModal
      ? {
          backgroundColor: "transparent",
          border: "none",
          boxShadow: "none",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          overflow: "visible",
        }
      : {}),
  };

  const swipeOn =
    (sheetSwipeEnabled || arrivalWalkingRouteShown) &&
    !showSaveModal &&
    typeof onClose === "function";

  useEffect(() => {
    if (showSaveModal) return;
    const el = cardRef.current;
    if (!el) return;
    // SaveModal에서 돌아온 직후 카드 스크롤이 잠기는 케이스 방지
    el.style.overflowX = "hidden";
    el.style.overflowY = "auto";
    el.style.touchAction = "auto";
  }, [showSaveModal]);

  return (
    <div style={styles.wrap}>
      <MotionCard
        ref={cardRef}
        style={cardBaseStyle}
        drag={swipeOn ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 300 }}
        dragElastic={{ top: 0, bottom: 0.38 }}
        dragMomentum={false}
        onDragEnd={swipeOn ? onSheetDragEnd : undefined}
      >
        {showSaveModal ? (
          <div style={styles.saveModalFrame}>
            <SaveModal
              embeddedInPlaceCard
              place={place}
              isOpen={showSaveModal}
              onClose={() => setShowSaveModal(false)}
              onDismissAll={() => {
                setShowSaveModal(false);
                onClose?.();
              }}
              onSaveComplete={() => {
                setShowSaveModal(false);
                onSavedToSupabase?.();
              }}
              firstSavedFrom="home"
              searchSessionIdRef={searchSessionIdRef}
              searchFeedbackContextRef={searchFeedbackContextRef}
            />
          </div>
        ) : (
          <>
        {swipeOn ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            title={
              arrivalWalkingRouteShown
                ? "아래로 밀어 닫기 · 지도에서 도보 경로를 볼 수 있어요"
                : "아래로 밀어 닫기"
            }
            style={{
              ...styles.sheetDragHandle,
              ...(arrivalWalkingRouteShown
                ? { paddingTop: "10px", paddingBottom: "10px" }
                : {}),
            }}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span style={styles.sheetDragHandleBar} aria-hidden />
          </div>
        ) : null}
        {place.mapClickNoVenue ? (
          <>
            <div style={styles.header}>
              <button
                type="button"
                onClick={onClose}
                style={styles.closeButtonInline}
                aria-label="닫기"
                title="닫기"
              >
                <FaTimes size={14} />
              </button>
            </div>
            <div style={{ ...styles.body, padding: "16px 14px 22px" }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: "#fff",
                }}
              >
                {extractDisplayName(
                  place?.name || place?.place_name || "이 위치"
                )}
              </div>
              <p
                style={{
                  margin: "0 0 14px",
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                근처에서 등록 가능한 장소를 찾지 못했어요. 스튜디오에서 직접
                올리거나, 큐레이터는 좌표만 잔 채우기에 넣을 수 있어요.
              </p>
              {place.address ? (
                <div
                  style={{
                    fontSize: 14,
                    color: "#e0e0e0",
                    marginBottom: 16,
                  }}
                >
                  📍 {place.address}
                </div>
              ) : null}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <button
                  type="button"
                  onClick={() => navigate("/studio")}
                  style={styles.mapEmptyPrimaryBtn}
                >
                  직접 등록하기
                </button>
                {isCurator ? (
                  <button
                    type="button"
                    onClick={() => handleQuickSaveClick()}
                    style={styles.mapEmptySecondaryBtn}
                  >
                    ⚡ 좌표만 잔 채우기
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  style={styles.mapEmptySecondaryBtn}
                >
                  다시 선택
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
        <div style={styles.header}>
          <div style={styles.headerRight}>
            {/* 카카오맵 상세보기 링크 */}
            {(isKakaoPlace || kakaoDetails) && (
              <button
                type="button"
                onClick={handleKakaoView}
                style={styles.kakaoLink}
              >
                카카오맵에서 열기
              </button>
            )}
            {(displayLat && displayLng) && (
              <button onClick={handleRoadviewOpen} style={styles.kakaoLink}>
                로드뷰
              </button>
            )}
            {/* 로딩 상태 표시 */}
            {isLoadingKakao && (
              <span style={styles.loadingText}>로딩 중...</span>
            )}
            {canCuratorUploadPhoto ? (
              <div style={styles.headerPhotoCloseCluster}>
                <input
                  ref={curatorPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                  style={{ display: "none" }}
                  onChange={handleCuratorPhotoFileChange}
                />
                <button
                  type="button"
                  disabled={curatorPhotoUploading}
                  onClick={() => curatorPhotoInputRef.current?.click()}
                  style={styles.curatorPhotoUploadBtn}
                >
                  {curatorPhotoUploading ? "업로드 중…" : "사진 올리기"}
                </button>
                <button
                  type="button"
                  onClick={() => handleShare(place)}
                  style={styles.headerShareBtn}
                  aria-label="공유"
                  title="공유"
                >
                  <FaShareAlt size={13} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={styles.closeButtonInline}
                  aria-label="닫기"
                  title="닫기"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            ) : (
              <div style={styles.headerPhotoCloseCluster}>
                <button
                  type="button"
                  onClick={() => handleShare(place)}
                  style={styles.headerShareBtn}
                  aria-label="공유"
                  title="공유"
                >
                  <FaShareAlt size={13} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={styles.closeButtonInline}
                  aria-label="닫기"
                  title="닫기"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        {visiblePreviewUrls.length > 0 && heroPreviewUrl ? (
          <div style={styles.kakaoPreviewSection}>
            <div style={styles.photoHeroWrap}>
              <button
                type="button"
                onClick={() => openPhotoLightbox(heroPreviewIndex)}
                style={styles.kakaoPhotoHeroBtn}
                title="사진 크게 보기"
              >
                <div style={styles.imageFrame}>
                  <img
                    src={heroPreviewUrl}
                    alt=""
                    style={styles.imageFill}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      handlePreviewPhotoError(heroPreviewUrl);
                    }}
                  />
                </div>
              </button>
              {canUserDeleteCuratorPhotoUrl(heroPreviewUrl) ? (
                <button
                  type="button"
                  style={styles.curatorPhotoDeleteOverlay}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const row = curatorRowByPublicUrl.get(heroPreviewUrl);
                    if (row) handleDeleteCuratorPhoto(row);
                  }}
                  disabled={curatorPhotoDeletingId != null}
                  aria-label="내 사진 삭제"
                  title="삭제"
                >
                  <FaTimes style={{ fontSize: 13 }} />
                </button>
              ) : null}
            </div>
            {stripPreviewUrls.length > 0 ? (
              <div
                style={{ ...styles.kakaoPreviewStrip, marginTop: 8 }}
                aria-label="장소 사진"
              >
                {stripPreviewUrls.map((src, i) => (
                  <div
                    key={`${src.slice(0, 48)}-${i}`}
                    style={styles.previewThumbWrap}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const idxInAll = visiblePreviewUrls.indexOf(src);
                        openPhotoLightbox(idxInAll >= 0 ? idxInAll : 0);
                      }}
                      style={styles.kakaoPreviewThumbBtn}
                      title="사진 크게 보기"
                    >
                      <img
                        src={src}
                        alt=""
                        style={styles.kakaoPreviewThumbImg}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          handlePreviewPhotoError(src);
                        }}
                      />
                    </button>
                    {canUserDeleteCuratorPhotoUrl(src) ? (
                      <button
                        type="button"
                        style={styles.curatorPhotoDeleteThumb}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const row = curatorRowByPublicUrl.get(src);
                          if (row) handleDeleteCuratorPhoto(row);
                        }}
                        disabled={curatorPhotoDeletingId != null}
                        aria-label="내 사진 삭제"
                        title="삭제"
                      >
                        <FaTimes style={{ fontSize: 10 }} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div style={styles.kakaoPreviewHint}>
              {showGooglePhotoCredit
                ? "Google Places로 자동 매칭된 이미지 · 동일 업체가 아닐 수 있음"
                : showCuratorPhotoBadge && (isKakaoPlace || kakaoDetails)
                ? previewHasKakaoOpenablePhoto
                  ? "큐레이터 등록 사진 포함 · 카카오 사진 탭 시 상세로 이동"
                  : "큐레이터 등록 사진 · 지도는 상단 「카카오맵에서 열기」"
                : showCuratorPhotoBadge
                ? "큐레이터 등록 사진"
                : isKakaoPlace || kakaoDetails
                ? previewHasKakaoOpenablePhoto
                  ? "사진 · 더 보려면 「카카오맵에서 열기」"
                  : "지도는 상단 「카카오맵에서 열기」"
                : ""}
            </div>
            {showGooglePhotoCredit && placePhotoAttributions.length > 0 ? (
              <div style={styles.googlePhotoCredit}>
                {placePhotoAttributions.join(" · ")}
              </div>
            ) : null}
          </div>
        ) : showPhotoSkeleton ? (
          <div style={styles.photoHeroSkeletonStandalone} aria-hidden>
            {staticMapImage ? (
              <img
                src={staticMapImage}
                alt=""
                style={styles.photoSkeletonMap}
              />
            ) : null}
          </div>
        ) : displayImage ? (
          <div style={styles.imageFrameStandalone}>
            <img
              src={displayImage}
              alt={place.name}
              style={styles.imageFill}
            />
          </div>
        ) : (isKakaoPlace || kakaoDetails) ? (
          <div style={styles.imageFallback}>
            사진 없음 · 큐레이터는 「사진 올리기」 또는 카카오맵에서 확인
          </div>
        ) : (
          <div style={styles.imageFallback}>이미지 없음</div>
        )}

        <div style={styles.body}>
          <div style={styles.titleRow}>
            <div>
              <div style={styles.title}>
                {extractDisplayName(place?.name || place?.place_name || "")}
              </div>
              {place.mapClickResolvedPlace ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.55)",
                    marginTop: 6,
                    lineHeight: 1.35,
                  }}
                >
                  지도를 탭해 찾은 장소예요. 주도에 올리거나 저장해 보세요.
                </div>
              ) : null}
            </div>

            <div style={styles.titleRight}>
              {isLive ? <div style={styles.liveBadge}>LIVE</div> : null}

              {isSaved ? (
                <div style={styles.savedDot} aria-label="저장됨" title="저장됨" />
              ) : null}
            </div>
          </div>

          {courseSecondFromFirstCaption ? (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.62)",
                marginTop: 8,
                lineHeight: 1.45,
              }}
              aria-label="1차 장소와의 거리"
            >
              {courseSecondFromFirstCaption.firstName ? (
                <>
                  1차 ·{" "}
                  <span style={{ color: "rgba(255,255,255,0.88)" }}>
                    {courseSecondFromFirstCaption.firstName}
                  </span>
                  에서 직선 약 {courseSecondFromFirstCaption.distPart} · 도보 약{" "}
                  {courseSecondFromFirstCaption.walkMin}분
                </>
              ) : (
                <>
                  1차에서 직선 약 {courseSecondFromFirstCaption.distPart} · 도보
                  약 {courseSecondFromFirstCaption.walkMin}분
                </>
              )}
            </div>
          ) : null}

          {place.courseSecondCandidatePick &&
          place.liquorSteerRequested &&
          !place.liquorCategoryMatched ? (
            <div
              style={{
                fontSize: 11.5,
                color: "rgba(255,255,255,0.55)",
                marginTop: 6,
                lineHeight: 1.4,
              }}
              aria-label="주종 대안 안내"
            >
              근처에 해당 주종 맞춤 장소가 부족해 대안으로 추천했어요.
            </div>
          ) : null}

          {place.courseSecondCandidatePick ? (
            <div style={styles.mapCourseActionRow}>
              <button
                type="button"
                onClick={() => onConfirmCourseSecondHere?.(place)}
                title="이 가게를 코스 2차로 확정하고 길 안내를 열어요"
                style={styles.mapConfirmSecondButton}
              >
                2차는 여기로
              </button>
              <button
                type="button"
                onClick={openWalkingDirections}
                disabled={directionsLoading}
                title="주도 지도에 내 위치에서 이 장소까지 도보 경로 표시"
                style={{
                  ...styles.directionsButton,
                  ...(directionsLoading ? { opacity: 0.65, cursor: "wait" } : {}),
                }}
              >
                {directionsLoading ? "위치 확인…" : "도착 길찾기"}
              </button>
            </div>
          ) : (
            <div style={styles.mapCourseActionRow}>
              <button
                type="button"
                disabled={
                  !courseMapFindSecondEnabled ||
                  Boolean(courseMapFindSecondBusy)
                }
                onClick={() => void onCourseMapFindSecond?.()}
                title={
                  courseMapFindSecondEnabled
                    ? "이 장소를 1차로 넣고, 주변 2차 후보를 지도에서 깜빡여 보여줘요"
                    : "지금은 2차 찾기를 쓸 수 없어요"
                }
                style={{
                  ...styles.mapFindSecondFullButton,
                  ...(!courseMapFindSecondEnabled || courseMapFindSecondBusy
                    ? styles.mapCollectButtonDisabled
                    : {}),
                }}
              >
                {courseMapFindSecondBusy ? "찾는 중…" : "2차 찾기"}
              </button>
              <button
                type="button"
                onClick={openWalkingDirections}
                disabled={directionsLoading}
                title="주도 지도에 내 위치에서 이 장소까지 도보 경로 표시"
                style={{
                  ...styles.directionsButton,
                  ...(directionsLoading ? { opacity: 0.65, cursor: "wait" } : {}),
                }}
              >
                {directionsLoading ? "위치 확인…" : "도착 길찾기"}
              </button>
            </div>
          )}

          {place.blogInsight && place.blogInsight.reviewCount > 0 ? (
            <div style={styles.blogInsightBlock} aria-label="블로그 기반 정보">
              <div style={styles.blogInsightLabel}>
                블로그에서 묻어난 정보 · 근거 {place.blogInsight.reviewCount}건
              </div>
              {typeof place.blogInsight.summary === "string" &&
              place.blogInsight.summary.trim() ? (
                <div style={styles.blogInsightSummary}>
                  {place.blogInsight.summary.trim()}
                </div>
              ) : null}
              {[
                place.blogInsight.atmosphere,
                place.blogInsight.menu,
                place.blogInsight.purpose,
                place.blogInsight.drink,
              ].some((a) => Array.isArray(a) && a.length > 0) ? (
                <div style={styles.blogInsightPills}>
                  {(place.blogInsight.atmosphere || []).map((t) => (
                    <span key={`bi-a-${t}`} style={styles.blogInsightPillMuted}>
                      분위기 · {t}
                    </span>
                  ))}
                  {(place.blogInsight.purpose || []).map((t) => (
                    <span key={`bi-p-${t}`} style={styles.blogInsightPill}>
                      상황 · {t}
                    </span>
                  ))}
                  {(place.blogInsight.menu || []).map((t) => (
                    <span key={`bi-m-${t}`} style={styles.blogInsightPillMuted}>
                      메뉴 · {t}
                    </span>
                  ))}
                  {(place.blogInsight.drink || []).map((t) => (
                    <span key={`bi-d-${t}`} style={styles.blogInsightPill}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={styles.blogInsightEmpty}>
                  본문에서 분위기·상황 키워드는 아직 못 찾았어요. (블로그 본문은 AI
                  시트에서 확인)
                </div>
              )}
            </div>
          ) : null}

          <div style={styles.meta}>
            {(isKakaoPlace || kakaoDetails) ? (
              <>
                {/* 카카오 장소 정보 */}
                {(kakaoDetails?.category_name ||
                  place.category_name ||
                  (place.category && place.category !== "미분류")) && (
                  <span style={styles.category}>
                    {cleanCategory(
                      kakaoDetails?.category_name ||
                        place.category_name ||
                        place.category
                    )}
                  </span>
                )}
                {addressBlockLines.length > 0 && (
                  <div style={styles.addressBlock}>
                    {addressBlockLines.map((line, idx) => (
                      <div
                        key={idx}
                        style={
                          idx === 0
                            ? styles.addressLineFirst
                            : styles.addressLineCont
                        }
                      >
                        {idx === 0 ? "📍 " : ""}
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                {displayPhone && (
                  <div style={styles.phoneLine}>📞 {displayPhone}</div>
                )}
                {Number.isFinite(place?.distance) && (
                  <span style={styles.distance}>🚶 {place.distance}m</span>
                )}
                {Number.isFinite(place?.walkingTime) && place.walkingTime > 0 && (
                  <span style={styles.walkingTime}>도보 약 {place.walkingTime}분</span>
                )}
                {/* 카카오 장소 평점 정보 */}
                {kakaoDetails?.rating && (
                  <span style={styles.rating}>
                    ★ {kakaoDetails.rating}
                  </span>
                )}
                {kakaoDetails?.review_count && (
                  <span style={styles.reviewCount}>({kakaoDetails.review_count}리뷰)</span>
                )}
                {/* 큐레이터 한줄평: 내용 있을 때만 상단 박스 (아래 curatorRow 칩은 유지) */}
                {showFeaturedCuratorCommentBox && (
                  <div style={styles.curatorComment}>
                    💬 <span style={styles.curatorCommentText}>
                      {getCuratorDisplayName(featuredCuratorCommentPlace)}
                    </span>
                    <span style={styles.curatorReason}>
                      "{featuredOneLineReason}"
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 일반 장소 정보 */}
                <div>
                  {place.region} · 저장 {place.savedCount}
                </div>
                {addressBlockLines.length > 0 && (
                  <div style={styles.addressBlock}>
                    {addressBlockLines.map((line, idx) => (
                      <div
                        key={idx}
                        style={
                          idx === 0
                            ? styles.addressLineFirst
                            : styles.addressLineCont
                        }
                      >
                        {idx === 0 ? "📍 " : ""}
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                {displayPhone && (
                  <div style={styles.phoneLine}>📞 {displayPhone}</div>
                )}
                {/* 큐레이터 한줄평: 내용 있을 때만 상단 박스 (아래 curatorRow 칩은 유지) */}
                {showFeaturedCuratorCommentBox && (
                  <div style={styles.curatorComment}>
                    💬 <span style={styles.curatorCommentText}>
                      {getCuratorDisplayName(featuredCuratorCommentPlace)}
                    </span>
                    <span style={styles.curatorReason}>
                      "{featuredOneLineReason}"
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 카카오 장소는 comment 대신 카테고리 정보 표시 */}
          {!isKakaoPlace && (
            <div style={styles.comment}>{place.comment}</div>
          )}

          <div style={styles.tagRow}>
            {filterPlaceTagsForDisplay(place.tags || [])
              .slice(0, 4)
              .map((tag) => (
                <span key={tag} style={styles.tag}>
                  #{tag}
                </span>
              ))}
          </div>

          <div className="hide-scrollbar" style={styles.curatorRow}>
            <div style={styles.curatorScrollContainer}>
              {place.curatorPlaces?.map((curatorPlace, index) => {
                // 큐레이터 표시는 curators.name 우선
                const curatorName =
                  getCuratorDisplayName(curatorPlace) || curatorPlace.curator_id;
                const curatorReason =
                  curatorPlace.one_line_reason ||
                  curatorPlace.menu_reason ||
                  curatorPlace.one_line_review ||
                  "";
                const isLast = index === place.curatorPlaces.length - 1;

                return (
                  <div 
                    key={curatorPlace.id || curatorName} 
                    style={{
                      ...styles.curatorInfo,
                      paddingRight: isLast ? "20px" : "0px" // 마지막 아이템에 padding-right 추가
                    }}
                  >
                    <div style={styles.curatorNameAndReason}>
                      <button
                        type="button"
                        onClick={() => onOpenCurator?.(curatorName)}
                        style={styles.curatorChip}
                      >
                        {curatorName} 추천
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.socialSummaryInlineRow}>
            <PlacePickDetailSummary
              place={place}
              theme="darkMono"
              compact
              showAvatars={false}
            />
            {primaryHanjanLine ? (
              <span style={styles.socialSummaryInlineSlash}>·</span>
            ) : null}
            {primaryHanjanLine ? (
              <span style={styles.socialSummaryInlineText}>{primaryHanjanLine}</span>
            ) : null}
          </div>

          {secondaryHanjanLines.length > 0 && (
            <div
              style={{
                marginTop: "10px",
                marginBottom: "2px",
                padding: "8px 10px",
                borderRadius: "10px",
                backgroundColor: "#222222",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              aria-label="한잔함 요약"
            >
              {secondaryHanjanLines.map((line, idx) => (
                <div
                  key={`${idx}-${line}`}
                  style={{
                    color: "#ffffff",
                    fontSize: "12px",
                    lineHeight: 1.45,
                    fontWeight: 600,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          <div style={styles.actionRow}>
            <div style={styles.actionCell}>
              <PlacePickButton place={place} variant="blackPink" />
            </div>

            <div style={styles.actionCell}>
              {isCurator ? (
                <button
                  type="button"
                  onClick={handleQuickSaveClick}
                  style={
                    quickSavePicked
                      ? { ...styles.quickSaveOutlineButton, ...styles.quickSaveOutlineButtonPicked }
                      : styles.quickSaveOutlineButton
                  }
                  title="스튜디오·내 폴더에만 반영됩니다. 공개 픽과 무관합니다."
                  aria-label="스튜디오 잔 채우기, 내 폴더만"
                >
                  {quickSavePicked ? "🗂️" : "📁 잔 채우기"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  style={styles.saveOutlineButton}
                  title="내 저장 폴더에만 넣습니다. 공개 픽과 무관합니다."
                  aria-label="내 폴더에 저장"
                >
                  📁 저장
                </button>
              )}
            </div>

            <div style={styles.actionCell}>
              <CheckinButton
                compact
                neutralCompact
                hideHint
                canCheckIn={canCheckIn}
                place={place}
                placeId={checkinPlaceKey ?? String(place.id ?? "")}
                placeName={place.name}
                placeAddress={
                  place.address ??
                  place.road_address_name ??
                  place.address_name ??
                  place.road_address ??
                  ""
                }
                placeLat={checkinWgs?.lat}
                placeLng={checkinWgs?.lng}
                kakaoPlaceId={
                  place.place_id ??
                  place.kakao_place_id ??
                  place.kakaoId ??
                  null
                }
                hanjanStats={hanjanStatsNorm}
                onHanjanRecorded={refetchHanjanStats}
                courseIdHint={courseIdHint}
                onCourseStampProgress={onCourseStampProgress}
                userLocation={userLocation}
              />
            </div>
          </div>
        </div>
        {lightboxOpen && visiblePreviewUrls.length > 0 ? (
          <div style={styles.photoLightbox} onClick={() => setLightboxOpen(false)}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
              }}
              style={styles.photoLightboxClose}
              aria-label="사진 닫기"
              title="닫기"
            >
              <FaTimes size={16} />
            </button>
            {visiblePreviewUrls.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((idx) =>
                    (idx - 1 + visiblePreviewUrls.length) % visiblePreviewUrls.length
                  );
                }}
                style={styles.photoLightboxNavLeft}
                aria-label="이전 사진"
              >
                ‹
              </button>
            ) : null}
            <img
              src={visiblePreviewUrls[lightboxIndex]}
              alt="장소 사진 크게 보기"
              style={styles.photoLightboxImage}
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.currentTarget.onerror = null;
                handlePreviewPhotoError(visiblePreviewUrls[lightboxIndex]);
              }}
            />
            {visiblePreviewUrls.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((idx) => (idx + 1) % visiblePreviewUrls.length);
                }}
                style={styles.photoLightboxNavRight}
                aria-label="다음 사진"
              >
                ›
              </button>
            ) : null}
          </div>
        ) : null}
          </>
        )}
          </>
        )}
        </MotionCard>
    </div>
  );
}

const styles = {
  wrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },
  card: {
    pointerEvents: "auto",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    width: "min(92vw, 600px)",
    height: "clamp(380px, 62vh, 560px)",
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    /* 큐레이터 스튜디오 톤: 셀 #1a1a1a 계열 · 보더 #222 · 가벼운 글래스 블러 */
    backgroundColor: "rgba(26, 26, 26, 0.94)",
    border: "1px solid #222222",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    animation: "judoCardUp 220ms ease-out",
    position: "relative",
  },
  saveModalFrame: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    pointerEvents: "auto",
  },
  sheetDragHandle: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "6px",
    paddingBottom: "2px",
    touchAction: "none",
    cursor: "grab",
    flexShrink: 0,
  },
  sheetDragHandleBar: {
    width: "40px",
    height: "4px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: "8px",
    padding: "8px 10px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxSizing: "border-box",
  },
  headerPhotoCloseCluster: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },
  closeButtonInline: {
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.88)",
    borderRadius: "999px",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    width: "28px",
    height: "28px",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
  },
  headerShareBtn: {
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.88)",
    borderRadius: "999px",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    width: "28px",
    height: "28px",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
  },
  /** 프레임 높이 고정 + img는 cover로 채워 비율 유지(버튼 내부 img 찌그러짐 방지) */
  imageFrame: {
    position: "relative",
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    overflow: "hidden",
    borderRadius: "10px",
    backgroundColor: "#222222",
  },
  imageFrameStandalone: {
    position: "relative",
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    overflow: "hidden",
    backgroundColor: "#222222",
  },
  imageFill: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
  },
  imageFallback: {
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    backgroundColor: "#1a1a1a",
    color: "#bdbdbd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    padding: "0 12px",
    textAlign: "center",
    boxSizing: "border-box",
  },
  kakaoPreviewSection: {
    padding: "8px 10px 6px",
    backgroundColor: "#222222",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  kakaoPhotoHeroBtn: {
    display: "block",
    width: "100%",
    padding: 0,
    margin: 0,
    border: "none",
    cursor: "pointer",
    background: "transparent",
    WebkitTapHighlightColor: "transparent",
  },
  kakaoPhotoHeroStatic: {
    display: "block",
    width: "100%",
    padding: 0,
    margin: 0,
    border: "none",
    cursor: "default",
    background: "transparent",
    WebkitTapHighlightColor: "transparent",
  },
  photoHeroWrap: {
    position: "relative",
    width: "100%",
  },
  curatorPhotoDeleteOverlay: {
    position: "absolute",
    top: "8px",
    right: "8px",
    zIndex: 3,
    width: "30px",
    height: "30px",
    padding: 0,
    borderRadius: "999px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    backgroundColor: "#333333",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
  },
  previewThumbWrap: {
    position: "relative",
    flex: "0 0 auto",
    width: "88px",
    height: "58px",
    flexShrink: 0,
  },
  curatorPhotoDeleteThumb: {
    position: "absolute",
    top: "2px",
    right: "2px",
    zIndex: 2,
    width: "22px",
    height: "22px",
    padding: 0,
    borderRadius: "999px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    backgroundColor: "#333333",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
  },
  kakaoPreviewStrip: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "thin",
    paddingBottom: "2px",
  },
  kakaoPreviewThumbBtn: {
    flex: "0 0 auto",
    width: "88px",
    height: "58px",
    padding: 0,
    border: "1px solid #333333",
    borderRadius: "10px",
    overflow: "hidden",
    cursor: "pointer",
    background: "#1a1a1a",
    boxShadow: "none",
  },
  kakaoPreviewThumbStatic: {
    flex: "0 0 auto",
    width: "88px",
    height: "58px",
    padding: 0,
    border: "1px solid #333333",
    borderRadius: "10px",
    overflow: "hidden",
    cursor: "default",
    background: "#1a1a1a",
    boxShadow: "none",
    flexShrink: 0,
  },
  kakaoPreviewThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
    flexShrink: 0,
    pointerEvents: "none",
  },
  kakaoPreviewHint: {
    marginTop: "6px",
    fontSize: "10px",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "-0.02em",
    lineHeight: 1.35,
  },
  googlePhotoCredit: {
    marginTop: "4px",
    fontSize: "9px",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.3,
  },
  kakaoPreviewLoading: {
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    backgroundColor: "#1a1a1a",
    color: "#bdbdbd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  photoHeroSkeleton: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#1f1f1f",
  },
  photoHeroSkeletonStandalone: {
    position: "relative",
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  photoSkeletonMap: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.35,
    filter: "blur(1px)",
  },
  body: {
    padding: "8px 10px 10px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  titleRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  title: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.25,
  },
  blogInsightBlock: {
    marginTop: "10px",
    padding: "8px 10px",
    borderRadius: "10px",
    backgroundColor: "#222222",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  blogInsightLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.55)",
    marginBottom: "6px",
    letterSpacing: "-0.02em",
  },
  blogInsightSummary: {
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.45,
    marginBottom: "8px",
  },
  blogInsightPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  blogInsightPill: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "4px 8px",
    backgroundColor: "#333333",
  },
  blogInsightPillMuted: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#bdbdbd",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "12px",
    padding: "4px 8px",
    backgroundColor: "#222222",
  },
  blogInsightEmpty: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.4,
  },
  liveBadge: {
    height: "20px",
    padding: "0 10px",
    borderRadius: "8px",
    backgroundColor: "rgba(46, 204, 113, 0.12)",
    color: "#2ECC71",
    border: "1px solid rgba(46, 204, 113, 0.45)",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.4px",
    display: "flex",
    alignItems: "center",
  },
  savedDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
    backgroundColor: "#2ECC71",
    border: "1px solid rgba(46, 204, 113, 0.55)",
    boxSizing: "border-box",
  },
  meta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#bdbdbd",
  },
  comment: {
    marginTop: "8px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.76)",
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  tagRow: {
    marginTop: "10px",
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  tag: {
    fontSize: "11px",
    color: "#ffffff",
    backgroundColor: "#333333",
    border: "none",
    borderRadius: "12px",
    padding: "5px 8px",
  },
  curatorRow: {
    marginTop: "12px",
    overflowX: "auto", // 가로 스크롤 활성화
    overflowY: "hidden", // 세로 스크롤 숨김
    whiteSpace: "nowrap", // 아이템들이 한 줄로 표시
    scrollbarWidth: "none", // Firefox 스크롤바 숨김
    msOverflowStyle: "none", // IE/Edge 스크롤바 숨김
    WebkitOverflowScrolling: "touch", // iOS 스크롤 부드럽게
    // WebKit 스크롤바는 className `hide-scrollbar`(index.css)로 처리
  },
  curatorScrollContainer: {
    display: "flex",
    gap: "12px",
    padding: "4px 0px 4px 4px",
    minWidth: "max-content", // 내용물에 맞는 최소 너비
  },
  curatorInfo: {
    flexShrink: 0, // 크기 고정
  },
  curatorNameAndReason: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-start",
  },
  curatorComment: {
    fontSize: "12px",
    color: "#ffffff",
    backgroundColor: "#222222",
    padding: "8px 12px",
    borderRadius: "10px",
    marginTop: "8px",
    border: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  curatorCommentText: {
    fontWeight: "600",
    color: "#2ECC71",
  },
  headerRight: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "6px",
    flexShrink: 0,
  },
  kakaoLink: {
    background: "none",
    border: "none",
    color: "#bdbdbd",
    fontSize: "11px",
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: "3px",
    textDecoration: "underline",
    transition: "all 0.2s"
  },
  curatorPhotoUploadBtn: {
    backgroundColor: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "rgba(255,255,255,0.88)",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: "8px",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    whiteSpace: "nowrap",
  },
  category: {
    fontSize: "13px",
    color: "#bdbdbd",
    fontWeight: "500",
    marginRight: "8px",
  },
  addressBlock: {
    display: "block",
    width: "100%",
    marginTop: "4px",
    marginBottom: "4px",
  },
  addressLineFirst: {
    fontSize: "12px",
    color: "#bdbdbd",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
  },
  addressLineCont: {
    fontSize: "12px",
    color: "#bdbdbd",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    paddingLeft: "1.35em",
    marginTop: "3px",
  },
  phoneLine: {
    display: "block",
    width: "100%",
    fontSize: "12px",
    color: "#bdbdbd",
    lineHeight: 1.45,
    marginBottom: "2px",
  },
  rating: {
    fontSize: "12px",
    color: "#ffffff",
    marginRight: "4px",
  },
  reviewCount: {
    fontSize: "11px",
    color: "#bdbdbd",
  },
  distance: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginLeft: "8px",
  },
  walkingTime: {
    fontSize: "12px",
    color: "#bdbdbd",
    marginLeft: "6px",
  },
  loadingText: {
    fontSize: "11px",
    color: "#bdbdbd",
    fontStyle: "italic",
  },
  saveOutlineButton: {
    width: "100%",
    height: "44px",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  quickSaveOutlineButton: {
    width: "100%",
    height: "44px",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #60a5fa",
    backgroundColor: "#0f172a",
    color: "#dbeafe",
    fontSize: "12px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  quickSaveOutlineButtonPicked: {
    background: "linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)",
    color: "#f0f9ff",
    border: "1px solid #67e8f9",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 1px rgba(34,211,238,0.32)",
  },
  actionCell: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "stretch",
  },
  curatorChip: {
    fontSize: "11px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#333333",
    color: "#ffffff",
    padding: "5px 9px",
    alignSelf: "flex-start",
    whiteSpace: "nowrap", // 텍스트 줄바꿈 방지
  },
  curatorReason: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
    lineHeight: 1.4,
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    maxWidth: "min(72vw, 260px)",
  },
  actionRow: {
    marginTop: "10px",
    display: "flex",
    gap: "8px",
    alignItems: "stretch",
  },
  socialSummaryInlineRow: {
    marginTop: "2px",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: "6px",
    rowGap: "2px",
  },
  socialSummaryInlineSlash: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.38)",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  socialSummaryInlineText: {
    fontSize: "11px",
    color: "#bdbdbd",
    fontWeight: 600,
    lineHeight: 1.35,
  },
  directionsButton: {
    flex: 1,
    minWidth: 0,
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  photoLightbox: {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    background: "rgba(0,0,0,0.86)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  photoLightboxImage: {
    maxWidth: "min(100%, 980px)",
    maxHeight: "86vh",
    borderRadius: "12px",
    objectFit: "contain",
    boxShadow: "0 18px 36px rgba(0,0,0,0.45)",
  },
  photoLightboxClose: {
    position: "absolute",
    right: "16px",
    top: "16px",
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "none",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  photoLightboxNavLeft: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "none",
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: "28px",
    lineHeight: 1,
    cursor: "pointer",
  },
  photoLightboxNavRight: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "none",
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: "28px",
    lineHeight: 1,
    cursor: "pointer",
  },
  saveButton: {
    flex: 1,
    height: "36px",
    borderRadius: "12px",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
  },
  mapEmptyPrimaryBtn: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #2ECC71",
    backgroundColor: "#2ECC71",
    color: "#111111",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  mapEmptySecondaryBtn: {
    width: "100%",
    minHeight: "42px",
    borderRadius: "12px",
    border: "1px solid #444444",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  mapCourseActionRow: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  },
  mapFindSecondFullButton: {
    flex: 1,
    minWidth: 0,
    minHeight: "44px",
    borderRadius: "12px",
    border: "2px solid #7bed9f",
    backgroundColor: "#1a1a1a",
    color: "#7bed9f",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  mapCollectButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    backgroundColor: "#1a1a1a",
    color: "#bdbdbd",
    border: "1px solid #333333",
  },
  mapConfirmSecondButton: {
    flex: 1,
    minWidth: 0,
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #2ECC71",
    backgroundColor: "#2ECC71",
    color: "#111111",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    boxSizing: "border-box",
  },
};