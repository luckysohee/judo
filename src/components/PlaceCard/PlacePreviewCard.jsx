import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useDragControls } from "framer-motion";
import { FaBookmark, FaRegBookmark, FaGlassWhiskey, FaTimes } from "react-icons/fa";

const MotionCard = motion.div;
import CheckinButton from "../CheckinButton/CheckinButton";
import SaveModal from "../SaveModal/SaveModal";
import { useToast } from "../Toast/ToastProvider";
import { useAuth } from "../../context/AuthContext";
import { getKakaoPlaceBasicInfoViaProxy } from "../../utils/kakaoAPIProxy";
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
import { resolvePlaceWgs84 } from "../../utils/placeCoords";
import { buildKakaoStaticMapUrl } from "../../utils/kakaoStaticMapUrl";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
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
}) {
  const { user } = useAuth();
  const curatorPhotoInputRef = useRef(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [kakaoDetails, setKakaoDetails] = useState(null);
  const [isLoadingKakao, setIsLoadingKakao] = useState(false);
  const [curatorPhotoRows, setCuratorPhotoRows] = useState([]);
  const [curatorPhotosLoading, setCuratorPhotosLoading] = useState(false);
  const [curatorPhotoUploading, setCuratorPhotoUploading] = useState(false);
  const [curatorPhotoDeletingId, setCuratorPhotoDeletingId] = useState(null);
  const [googlePhotoUrls, setGooglePhotoUrls] = useState([]);
  const [googlePhotoAttributions, setGooglePhotoAttributions] = useState([]);
  const [googlePhotosLoading, setGooglePhotosLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const [sheetSwipeEnabled, setSheetSwipeEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setSheetSwipeEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onSheetDragEnd = useCallback(
    (_, info) => {
      if (info.offset.y > 88 || info.velocity.y > 420) {
        onClose?.();
      }
    },
    [onClose]
  );

  const extractedPlaceIdFromUrl = place?.place_url?.match(/\/place\/(\d+)/)?.[1] || null;
  const idAsKakao =
    place?.id != null &&
    (typeof place.id === "number" ||
      (typeof place.id === "string" && /^\d+$/.test(place.id.trim())))
      ? String(place.id).trim()
      : null;
  const rawKakaoPlaceId =
    place?.place_id ||
    place?.kakao_place_id ||
    place?.kakaoId ||
    extractedPlaceIdFromUrl ||
    idAsKakao ||
    null;
  const kakaoPlaceId =
    typeof rawKakaoPlaceId === "string" && /^\d+$/.test(rawKakaoPlaceId)
      ? rawKakaoPlaceId
      : typeof rawKakaoPlaceId === "number"
      ? String(rawKakaoPlaceId)
      : null;

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

  useEffect(() => {
    setGooglePhotoUrls([]);
    setGooglePhotoAttributions([]);
    setGooglePhotosLoading(false);
    setCuratorPhotoRows([]);
    setCuratorPhotosLoading(false);
  }, [place?.id, place?.place_id, kakaoPlaceId]);

  useEffect(() => {
    if (!place) return;
    if (!kakaoPlaceId && !internalPlaceIdForPhotos) return;
    let cancelled = false;
    setCuratorPhotosLoading(true);
    (async () => {
      const rows = await fetchCuratorPlacePhotoRows({
        kakaoPlaceId: kakaoPlaceId || undefined,
        internalPlaceId: internalPlaceIdForPhotos || undefined,
      });
      if (!cancelled) {
        setCuratorPhotoRows(rows);
        setCuratorPhotosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place, kakaoPlaceId, internalPlaceIdForPhotos]);

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
        });
    } else if (!kakaoPlaceId) {
      if (place?.mapClickNoVenue) return;
      console.warn("⚠️ 카카오 place id 없음 - 상세조회 생략", {
        id: place?.id,
        place_id: place?.place_id,
        kakao_place_id: place?.kakao_place_id,
        kakaoId: place?.kakaoId,
        place_url: place?.place_url,
      });
    }
  }, [
    kakaoPlaceId,
    place,
    kakaoDetails,
    kakaoKeywordQuery,
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

  /** 카카오 장소: API·저장소에서 온 사진 URL만 (지도 타일 제외) */
  const kakaoPreviewPhotoUrls = useMemo(() => {
    if (!(isKakaoPlace || kakaoDetails)) return [];
    const out = [];
    const pushU = (u) => {
      if (u && typeof u === "string" && !out.includes(u)) out.push(u);
    };
    const fromApi = kakaoDetails?.photo_urls;
    if (Array.isArray(fromApi)) {
      fromApi.forEach(pushU);
    }
    pushU(kakaoDetails?.thumbnail_url);
    pushU(place?.image);
    return out;
  }, [
    isKakaoPlace,
    kakaoDetails,
    place?.image,
    kakaoDetails?.thumbnail_url,
    kakaoDetails?.photo_urls,
  ]);

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

  const mergedKakaoCuratorPhotos = useMemo(() => {
    const out = [];
    const add = (u) => {
      if (typeof u === "string" && u && !out.includes(u)) out.push(u);
    };
    curatorPhotoUrls.forEach(add);
    if (isKakaoPlace || kakaoDetails) {
      kakaoPreviewPhotoUrls.forEach(add);
    }
    return out;
  }, [
    curatorPhotoUrls,
    kakaoPreviewPhotoUrls,
    isKakaoPlace,
    kakaoDetails,
  ]);

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

  /** 카카오·큐레이터 우선, 이어서 구글(카카오 썸네일만 있어도 구글 병렬 로드) */
  const allPreviewUrls = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (u) => {
      if (typeof u === "string" && u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    };
    mergedKakaoCuratorPhotos.forEach(add);
    googlePhotoUrls.forEach(add);
    return out;
  }, [mergedKakaoCuratorPhotos, googlePhotoUrls]);

  const [heroPreviewIndex, setHeroPreviewIndex] = useState(0);
  useEffect(() => {
    setHeroPreviewIndex(0);
  }, [place?.id, place?.place_id, kakaoPlaceId]);

  const heroPreviewUrl = allPreviewUrls[heroPreviewIndex] ?? allPreviewUrls[0];
  const stripPreviewUrls = allPreviewUrls.filter(
    (_, i) => i !== heroPreviewIndex
  );

  const previewHasKakaoOpenablePhoto = useMemo(
    () => allPreviewUrls.some((u) => photoClickOpensKakao(u)),
    [allPreviewUrls, kakaoPlacePageUrl, curatorPhotoUrlSet]
  );

  const showGooglePhotoCredit =
    googlePhotoUrls.length > 0 &&
    (mergedKakaoCuratorPhotos.length === 0 ||
      heroPreviewIndex >= mergedKakaoCuratorPhotos.length);
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

  /**
   * 큐레이터 사진 로딩으로 curatorPhotoUrls.length만 바뀌어도 이 효과가 돌면
   * 매번 setGooglePhotoUrls([])로 구글 URL이 지워져 사진이 안 뜨는 현상이 난다.
   * 장소·이름·주소·좌표가 바뀔 때만 다시 불러온다.
   */
  const googlePlacePhotosFetchKey = useMemo(
    () =>
      [
        String(place?.id ?? ""),
        String(place?.place_id ?? ""),
        String(kakaoKeywordQuery ?? "").trim(),
        resolvedPlaceAddressLine,
        displayLat != null && Number.isFinite(Number(displayLat))
          ? String(displayLat)
          : "",
        displayLng != null && Number.isFinite(Number(displayLng))
          ? String(displayLng)
          : "",
      ].join("\u001f"),
    [
      place?.id,
      place?.place_id,
      kakaoKeywordQuery,
      resolvedPlaceAddressLine,
      displayLat,
      displayLng,
    ]
  );

  useEffect(() => {
    const q = kakaoKeywordQuery.trim();
    if (!q) return;

    setGooglePhotoUrls([]);
    setGooglePhotoAttributions([]);
    const ac = new AbortController();
    setGooglePhotosLoading(true);

    const base = (
      import.meta.env.VITE_AI_API_BASE_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      ""
    )
      .toString()
      .replace(/\/$/, "");

    const params = new URLSearchParams({ name: q });
    if (resolvedPlaceAddressLine) {
      params.set("address", resolvedPlaceAddressLine.slice(0, 120));
    }
    if (
      displayLat != null &&
      displayLng != null &&
      Number.isFinite(Number(displayLat)) &&
      Number.isFinite(Number(displayLng))
    ) {
      params.set("lat", String(displayLat));
      params.set("lng", String(displayLng));
    }

    fetch(`${base}/api/google-place-photos?${params}`, { signal: ac.signal })
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          if (import.meta.env.DEV) {
            console.warn("[google-place-photos] JSON 아님", r.status, text.slice(0, 200));
          }
          return { ok: false, imageUrls: [] };
        }
      })
      .then((data) => {
        if (import.meta.env.DEV) {
          const n = Array.isArray(data?.imageUrls) ? data.imageUrls.length : 0;
          if (!data?.ok || n === 0) {
            console.warn("[google-place-photos]", {
              ok: data?.ok,
              count: n,
              error: data?.error,
              hint: data?.hint,
              googleHttpStatus: data?.googleHttpStatus,
              googleApiError: data?.googleApiError,
              requestUrl: `${base || "(same-origin)"}/api/google-place-photos?${params}`,
            });
          }
        }
        if (!data?.ok || !Array.isArray(data.imageUrls)) return;
        const urls = data.imageUrls
          .filter(
            (u) =>
              typeof u === "string" &&
              (u.startsWith("/") || /^https?:\/\//i.test(u))
          )
          .map((path) =>
            path.startsWith("/") && base ? `${base}${path}` : path
          );
        if (urls.length > 0) {
          setGooglePhotoUrls(urls);
          setGooglePhotoAttributions(
            Array.isArray(data.attributions) ? data.attributions : []
          );
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (import.meta.env.DEV) {
          console.warn("google-place-photos fetch 실패:", err?.message || err);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setGooglePhotosLoading(false);
      });

    return () => {
      ac.abort();
    };
    // 키에 이름·주소·좌표·장소 id가 모두 들어 있음 (curator 길이 제외)
  }, [googlePlacePhotosFetchKey]);

  const showKakaoPhotoLoading =
    allPreviewUrls.length === 0 &&
    (googlePhotosLoading ||
      curatorPhotosLoading ||
      ((isKakaoPlace || kakaoDetails) && isLoadingKakao));

  const canCuratorUploadPhoto =
    isCurator &&
    user &&
    (kakaoPlaceId || internalPlaceIdForPhotos);

  const reloadCuratorPlacePhotos = async () => {
    const rows = await fetchCuratorPlacePhotoRows({
      kakaoPlaceId: kakaoPlaceId || undefined,
      internalPlaceId: internalPlaceIdForPhotos || undefined,
    });
    setCuratorPhotoRows(rows);
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

  const getCuratorDisplayName = (curatorPlace) => {
    return (
      curatorPlace?.curators?.display_name ||
      curatorPlace?.curators?.username ||
      curatorPlace?.display_name ||
      curatorPlace?.curator_id ||
      ""
    );
  };

  const featuredCuratorPlace =
    (place.curatorPlaces || []).find((curatorPlace) => {
      const candidates = [
        curatorPlace?.curators?.display_name,
        curatorPlace?.curators?.username,
        curatorPlace?.display_name,
        curatorPlace?.curator_id,
      ].filter(Boolean);
      return candidates.some((candidate) => selectedCuratorNames.includes(candidate));
    }) || (place.curatorPlaces || [])[0];

  // 빠른저장 버튼 핸들러
  const handleQuickSaveClick = async () => {
    const userRole = getUserRole?.() || "user";
    console.log('🔍 빠른저장 클릭 - userRole:', userRole);
    
    // 큐레이터 또는 관리자일 경우 쾌속 잔 채우기
    if (userRole === "curator" || userRole === "admin") {
      console.log('🎯 큐레이터/관리자 - 쾌속 잔 채우기 실행');
      await handleSaveClick();
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
          alert('이미 잔 채우기 리스트에 있는 장소입니다');
        } else if (result === 'success') {
          showToast('잔 채우기 리스트에 임시저장되었습니다!', 'success');
        } else {
          alert('❌ 잔 채우기에 실패했습니다.');
        }
        
        return;
      }
      
      try {
        // 일반 장소는 기존 방식으로 저장
        const { supabase } = await import("../../lib/supabase");
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 잔 채우기 테이블에 저장 (curator_places 테이블)
          const { error } = await supabase
            .from('curator_places')
            .insert({
              curator_id: user.id,
              place_id: place.id
            });
            
          if (error) {
            console.error('잔 채우기 저장 실패:', error);
            alert('잔 채우기 저장에 실패했습니다.');
            return;
          }
          
          console.log('✅ 잔 채우기 리스트에 저장 완료');
          alert('✅ 잔 채우기 리스트에 저장되었습니다!');
        }
      } catch (error) {
        console.error('쾌속 잔 채우기 오류:', error);
        alert('쾌속 잔 채우기에 실패했습니다.');
      }
      return;
    }
    
    // 일반 사용자일 경우 기존 저장 모달 표시
    setShowSaveModal(true);
  };

  // 백그라운드 임시저장 함수
  const saveToCuratorDrafts = async (place) => {
    try {
      const { supabase } = await import("../../lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('⚠️ 로그인된 사용자 없음');
        return 'error';
      }
      
      console.log('📍 쾌속 잔 채우기 시작:', place.name);
      console.log('📍 카카오 장소 ID:', place.kakao_place_id || place.id);
      console.log('📍 현재 사용자 ID:', user.id);
      
      // 1. localStorage에서 기존 drafts 불러오기
      const existingDrafts = JSON.parse(localStorage.getItem('studio_drafts') || '[]');
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
      localStorage.setItem('studio_drafts', JSON.stringify(existingDrafts));
      
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
          maxHeight: "min(72vh, 520px)",
          minHeight: "min(46vh, 340px)",
          overflow: "hidden",
          overflowX: "hidden",
          overflowY: "hidden",
          display: "flex",
          flexDirection: "column",
        }
      : {}),
  };

  const swipeOn =
    sheetSwipeEnabled && !showSaveModal && typeof onClose === "function";

  return (
    <div style={styles.wrap}>
      <MotionCard
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
          <SaveModal
            embeddedInPlaceCard
            place={place}
            isOpen={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            onSaveComplete={() => {
              setShowSaveModal(false);
              onSavedToSupabase?.();
            }}
            firstSavedFrom="home"
            searchSessionIdRef={searchSessionIdRef}
          />
        ) : (
          <>
        {swipeOn ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            title="아래로 밀어 닫기"
            style={styles.sheetDragHandle}
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
                  onClick={onClose}
                  style={styles.closeButtonInline}
                  aria-label="닫기"
                  title="닫기"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={styles.closeButtonInline}
                aria-label="닫기"
                title="닫기"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        </div>
        {allPreviewUrls.length > 0 && heroPreviewUrl ? (
          <div style={styles.kakaoPreviewSection}>
            <div style={styles.photoHeroWrap}>
              {photoClickOpensKakao(heroPreviewUrl) ? (
                <button
                  type="button"
                  onClick={handleKakaoView}
                  style={styles.kakaoPhotoHeroBtn}
                  title="카카오맵에서 열기"
                >
                  <div style={styles.imageFrame}>
                    <img
                      key={heroPreviewUrl}
                      src={heroPreviewUrl}
                      alt=""
                      style={styles.imageFill}
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        setHeroPreviewIndex((i) =>
                          i + 1 < allPreviewUrls.length ? i + 1 : i
                        );
                      }}
                    />
                  </div>
                </button>
              ) : (
                <div
                  style={styles.kakaoPhotoHeroStatic}
                  role="img"
                  aria-label="장소 사진"
                >
                  <div style={styles.imageFrame}>
                    <img
                      key={heroPreviewUrl}
                      src={heroPreviewUrl}
                      alt=""
                      style={styles.imageFill}
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        setHeroPreviewIndex((i) =>
                          i + 1 < allPreviewUrls.length ? i + 1 : i
                        );
                      }}
                    />
                  </div>
                </div>
              )}
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
                    {photoClickOpensKakao(src) ? (
                      <button
                        type="button"
                        onClick={handleKakaoView}
                        style={styles.kakaoPreviewThumbBtn}
                        title="카카오맵에서 열기"
                      >
                        <img
                          src={src}
                          alt=""
                          style={styles.kakaoPreviewThumbImg}
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div
                        style={styles.kakaoPreviewThumbStatic}
                        role="img"
                        aria-label="큐레이터 등록 사진"
                      >
                        <img
                          src={src}
                          alt=""
                          style={styles.kakaoPreviewThumbImg}
                          loading="lazy"
                        />
                      </div>
                    )}
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
            {showGooglePhotoCredit && googlePhotoAttributions.length > 0 ? (
              <div style={styles.googlePhotoCredit}>
                {googlePhotoAttributions.join(" · ")}
              </div>
            ) : null}
          </div>
        ) : showKakaoPhotoLoading ? (
          <div style={styles.kakaoPreviewLoading}>미리보기 불러오는 중…</div>
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
                <div
                  style={{
                    ...styles.savedDot,
                    backgroundColor: savedFolderColor || "#2ECC71",
                  }}
                />
              ) : null}
            </div>
          </div>

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
                  <span style={styles.rating}>⭐ {kakaoDetails.rating}</span>
                )}
                {kakaoDetails?.review_count && (
                  <span style={styles.reviewCount}>({kakaoDetails.review_count}리뷰)</span>
                )}
                {/* 큐레이터 추천 코멘트 추가 - DB 데이터 사용 */}
                {featuredCuratorPlace && (
                  <div style={styles.curatorComment}>
                    💬 <span style={styles.curatorCommentText}>
                      {getCuratorDisplayName(featuredCuratorPlace)}님 추천
                    </span>
                    <span style={styles.curatorReason}>
                      "{featuredCuratorPlace?.one_line_reason || ""}"
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
                {/* 큐레이터 추천 코멘트 추가 - DB 데이터 사용 */}
                {featuredCuratorPlace && (
                  <div style={styles.curatorComment}>
                    💬 <span style={styles.curatorCommentText}>
                      {getCuratorDisplayName(featuredCuratorPlace)}님 추천
                    </span>
                    <span style={styles.curatorReason}>
                      "{featuredCuratorPlace?.one_line_reason || ""}"
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

          <div style={styles.curatorRow}>
            <div style={styles.curatorScrollContainer}>
              {place.curatorPlaces?.map((curatorPlace, index) => {
                // curatorPlaces에서 직접 데이터 가져오기
                const curatorName = curatorPlace.curators?.display_name || curatorPlace.display_name || curatorPlace.curator_id;
                const curatorReason = curatorPlace.one_line_reason || "";
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
                      {curatorReason && (
                        <div style={styles.curatorReason}>
                          "{curatorReason}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.actionRow}>
            <CheckinButton
              compact
              place={place}
              placeId={place.id}
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
            />

            {isCurator ? (
              /* 큐레이터용 버튼 */
              <button
                type="button"
                onClick={handleQuickSaveClick}
                style={styles.curatorSaveButton}
              >
                <span style={styles.curatorQuickSaveLine1}>⚡쾌속⚡</span>
                <span style={styles.curatorQuickSaveLine2}>잔채우기</span>
              </button>
            ) : (
              /* 일반 사용자용 버튼 */
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                style={styles.quickSaveButton}
              >
                빠른저장
              </button>
            )}

            <button
              type="button"
              onClick={() => handleShare(place)}
              style={styles.shareButton}
            >
              공유하기
            </button>
          </div>
        </div>
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
    pointerEvents: "auto",
  },
  card: {
    width: "92%",
    maxWidth: "400px",
    maxHeight: "min(50vh, 360px)",
    overflowX: "hidden",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    backgroundColor: "rgba(18,18,18,0.96)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    boxShadow: "0 14px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(12px)",
    animation: "judoCardUp 220ms ease-out",
    position: "relative",
    transition: "all 0.3s ease"
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
    gap: "6px",
    padding: "4px 6px 6px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerPhotoCloseCluster: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },
  closeButtonInline: {
    border: "none",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#fff",
    borderRadius: "999px",
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
    backgroundColor: "#242424",
  },
  imageFrameStandalone: {
    position: "relative",
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    overflow: "hidden",
    backgroundColor: "#242424",
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
    backgroundColor: "#242424",
    color: "#8a8a8a",
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
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.12) 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
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
    border: "none",
    borderRadius: "999px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.55)",
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
    border: "none",
    borderRadius: "999px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    backgroundColor: "rgba(192,57,43,0.92)",
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
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "10px",
    overflow: "hidden",
    cursor: "pointer",
    background: "rgba(0,0,0,0.35)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
  kakaoPreviewThumbStatic: {
    flex: "0 0 auto",
    width: "88px",
    height: "58px",
    padding: 0,
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "10px",
    overflow: "hidden",
    cursor: "default",
    background: "rgba(0,0,0,0.35)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
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
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "-0.02em",
    lineHeight: 1.35,
  },
  googlePhotoCredit: {
    marginTop: "4px",
    fontSize: "9px",
    color: "rgba(255,255,255,0.35)",
    lineHeight: 1.3,
  },
  kakaoPreviewLoading: {
    width: "100%",
    height: "clamp(104px, 36vw, 168px)",
    backgroundColor: "#242424",
    color: "#8a8a8a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
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
    backgroundColor: "rgba(52, 152, 219, 0.1)",
    border: "1px solid rgba(52, 152, 219, 0.28)",
  },
  blogInsightLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
    marginBottom: "6px",
    letterSpacing: "-0.02em",
  },
  blogInsightSummary: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#e8f4ff",
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
    color: "#a8d8ff",
    border: "1px solid rgba(168,216,255,0.35)",
    borderRadius: "999px",
    padding: "3px 9px",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  blogInsightPillMuted: {
    fontSize: "11px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "999px",
    padding: "3px 9px",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  blogInsightEmpty: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.4,
  },
  liveBadge: {
    height: "20px",
    padding: "0 10px",
    borderRadius: "999px",
    backgroundColor: "#34D17A",
    color: "#111111",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.5px",
    display: "flex",
    alignItems: "center",
  },
  savedDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  meta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#a9a9a9",
  },
  comment: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#e8e8e8",
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
    color: "#f3f3f3",
    backgroundColor: "#202020",
    border: "1px solid #343434",
    borderRadius: "999px",
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
    "&::-webkit-scrollbar": {
      display: "none" // Chrome/Safari 스크롤바 숨김
    }
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
    color: "#3498db",
    backgroundColor: "rgba(52, 152, 219, 0.1)",
    padding: "8px 12px",
    borderRadius: "8px",
    marginTop: "8px",
    border: "1px solid rgba(52, 152, 219, 0.2)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  curatorCommentText: {
    fontWeight: "600",
    color: "#3498db",
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
    color: "#3498db",
    fontSize: "11px",
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: "3px",
    textDecoration: "underline",
    transition: "all 0.2s"
  },
  curatorPhotoUploadBtn: {
    background: "rgba(46, 204, 113, 0.2)",
    border: "1px solid rgba(46, 204, 113, 0.55)",
    color: "#2ECC71",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "6px",
    whiteSpace: "nowrap",
  },
  category: {
    fontSize: "13px",
    color: "#3498db",
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
    color: "#999",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
  },
  addressLineCont: {
    fontSize: "12px",
    color: "#999",
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
    color: "#999",
    lineHeight: 1.45,
    marginBottom: "2px",
  },
  rating: {
    fontSize: "12px",
    color: "#f39c12",
    marginRight: "4px",
  },
  reviewCount: {
    fontSize: "11px",
    color: "#999",
  },
  distance: {
    fontSize: "12px",
    color: "#9cc8ff",
    marginLeft: "8px",
  },
  walkingTime: {
    fontSize: "12px",
    color: "#9cc8ff",
    marginLeft: "6px",
  },
  loadingText: {
    fontSize: "11px",
    color: "#999",
    fontStyle: "italic",
  },
  curatorSaveButton: {
    flex: 1,
    minHeight: "40px",
    minWidth: 0,
    padding: "5px 6px",
    borderRadius: "10px",
    border: "1px solid #2a8f55",
    backgroundColor: "#2ECC71",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1px",
    lineHeight: 1.15,
    cursor: "pointer",
  },
  curatorQuickSaveLine1: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "-0.02em",
  },
  curatorQuickSaveLine2: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "-0.01em",
  },
  curatorChip: {
    fontSize: "11px",
    borderRadius: "999px",
    border: "1px solid #343434",
    backgroundColor: "#171717",
    color: "#d4d4d4",
    padding: "5px 9px",
    alignSelf: "flex-start",
    whiteSpace: "nowrap", // 텍스트 줄바꿈 방지
  },
  curatorReason: {
    fontSize: "12px",
    color: "#e8e8e8",
    fontStyle: "italic",
    lineHeight: 1.3,
    whiteSpace: "nowrap", // 텍스트 줄바꿈 방지
    maxWidth: "200px", // 최대 너비 제한
    overflow: "hidden",
    textOverflow: "ellipsis", // 넘치는 텍스트 ...으로 표시
  },
  actionRow: {
    marginTop: "10px",
    display: "flex",
    gap: "8px",
    alignItems: "stretch",
  },
  saveButton: {
    flex: 1,
    height: "36px",
    borderRadius: "10px",
    border: "1px solid #343434",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
  },
  quickSaveButton: {
    flex: 1,
    minWidth: 0,
    minHeight: "40px",
    borderRadius: "10px",
    border: "1px solid #343434",
    backgroundColor: "#2ECC71",
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
  shareButton: {
    flex: 1,
    minWidth: 0,
    minHeight: "40px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#3498DB",
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
  mapEmptyPrimaryBtn: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#2ECC71",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  mapEmptySecondaryBtn: {
    width: "100%",
    minHeight: "42px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#eee",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
};