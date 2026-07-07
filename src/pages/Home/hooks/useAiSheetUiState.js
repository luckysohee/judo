import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getApiAuthHeaders } from "../../../utils/apiAuthHeaders.js";
import { buildKakaoStaticMapUrl } from "../../../utils/kakaoStaticMapUrl";
import { getKakaoPlaceBasicInfoViaProxy } from "../../../utils/kakaoAPIProxy";
import { resolvePlaceWgs84 } from "../../../utils/placeCoords";
import { normalizeKakaoPlaceId } from "../../../utils/mergePickedPlaceWithCuratorCatalog";

export const AI_SHEET_PAGE_SIZE = 5;

/**
 * AI 추천 결과 바텀시트의 UI 상태(페이지네이션, 펼친 사유, 사진 프리패치, 라이트박스).
 *
 * - `aiSheetPage`: 페이지 인덱스 (시트 닫힘/검색 새로 시작 시 외부에서 0으로 리셋)
 * - `aiSheetExpandedReasonByKey`: 카드별 「추천 사유 더 보기」 펼침 상태
 * - `aiSheetPhotoByKey`: 카드별 비동기로 가져온 사진 URL (kakao → google fallback)
 * - photoViewer*: 썸네일 클릭 시 떠오르는 풀스크린 뷰어
 *
 * 시트 닫힘 / 페이지 초과 / ESC / 라이트박스 닫기 후 잔여 탭 차단 등을 캡슐화.
 *
 * @param {{
 *   aiSheetOpen: boolean,
 *   aiBottomSheetPlaces: Array<any>,
 * }} args
 */
export function useAiSheetUiState({ aiSheetOpen, aiBottomSheetPlaces }) {
  const [aiSheetPage, setAiSheetPage] = useState(0);
  const [aiSheetExpandedReasonByKey, setAiSheetExpandedReasonByKey] = useState(
    {},
  );
  const [aiSheetPhotoByKey, setAiSheetPhotoByKey] = useState({});
  const [aiSheetPhotoViewerOpen, setAiSheetPhotoViewerOpen] = useState(false);
  const [aiSheetPhotoViewerIndex, setAiSheetPhotoViewerIndex] = useState(0);

  /** 배경 탭으로 닫은 뒤 같은 포인터 이벤트가 썸네일로 떨어져 라이트박스가 즉시 다시 열리는 것 방지 */
  const aiSheetPhotoViewerSuppressOpenUntilRef = useRef(0);

  const closeAiSheetPhotoViewer = useCallback(() => {
    setAiSheetPhotoViewerOpen(false);
    aiSheetPhotoViewerSuppressOpenUntilRef.current = Date.now() + 480;
  }, []);

  const aiSheetTotalPages = Math.max(
    1,
    Math.ceil((aiBottomSheetPlaces?.length || 0) / AI_SHEET_PAGE_SIZE),
  );

  const aiBottomSheetPagedPlaces = useMemo(() => {
    const start = aiSheetPage * AI_SHEET_PAGE_SIZE;
    return (aiBottomSheetPlaces || []).slice(start, start + AI_SHEET_PAGE_SIZE);
  }, [aiBottomSheetPlaces, aiSheetPage]);

  const aiSheetPlacePreviewKey = useCallback((place) => {
    const id = String(place?.id || "").trim();
    if (id) return id;
    const nm = String(place?.name || place?.place_name || "").trim();
    const ad = String(place?.address || place?.address_name || "").trim();
    return `${nm}__${ad}`;
  }, []);

  const aiSheetPhotoViewerItems = useMemo(() => {
    const out = [];
    for (const p of aiBottomSheetPagedPlaces || []) {
      const key = aiSheetPlacePreviewKey(p);
      const enrichedPhoto = key ? aiSheetPhotoByKey[key] : "";
      const previewImageUrl = [
        enrichedPhoto,
        p?.thumbnail,
        p?.thumbnail_url,
        p?.image,
        p?.image_url,
        p?.photo,
        p?.photo_url,
        p?.picture,
      ]
        .map((v) => String(v || "").trim())
        .find((v) => /^https?:\/\//i.test(v) || v.startsWith("/api/"));
      const wgs = resolvePlaceWgs84(p);
      const lat = Number(wgs?.lat);
      const lng = Number(wgs?.lng);
      const fallbackStaticMapUrl =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? buildKakaoStaticMapUrl(lat, lng, { w: 900, h: 640, level: 4 })
          : "";
      const src = previewImageUrl || fallbackStaticMapUrl || "";
      if (!src) continue;
      out.push({
        key,
        src,
        title: String(p?.name || p?.place_name || "장소 사진").trim(),
      });
    }
    return out;
  }, [aiBottomSheetPagedPlaces, aiSheetPhotoByKey, aiSheetPlacePreviewKey]);

  /** 시트가 닫히면 라이트박스도 같이 닫음 */
  useEffect(() => {
    if (!aiSheetOpen) {
      /** 시트 닫힘 시 라이트박스 정리 — 의도된 setState */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiSheetPhotoViewerOpen(false);
    }
  }, [aiSheetOpen]);

  /** 라이트박스 떠 있을 때 ESC로 닫기 */
  useEffect(() => {
    if (!aiSheetPhotoViewerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeAiSheetPhotoViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiSheetPhotoViewerOpen, closeAiSheetPhotoViewer]);

  /** 결과 개수 변동으로 현재 페이지가 마지막을 넘으면 보정 */
  useEffect(() => {
    if (aiSheetPage >= aiSheetTotalPages) {
      /** 페이지 초과 시 마지막 페이지로 클램프 — 의도된 setState */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAiSheetPage(Math.max(0, aiSheetTotalPages - 1));
    }
  }, [aiSheetPage, aiSheetTotalPages]);

  /** 시트가 열리면 상위 8개 카드의 사진을 비동기로 채워 넣음 (kakao 상세 → google 폴백) */
  useEffect(() => {
    if (
      !aiSheetOpen ||
      !Array.isArray(aiBottomSheetPlaces) ||
      aiBottomSheetPlaces.length === 0
    ) {
      return undefined;
    }
    const ac = new AbortController();

    const run = async () => {
      for (const p of aiBottomSheetPlaces.slice(0, 8)) {
        if (ac.signal.aborted) break;
        const key = aiSheetPlacePreviewKey(p);
        if (!key || aiSheetPhotoByKey[key]) continue;
        const name = String(p?.name || p?.place_name || "").trim();
        if (!name) continue;
        const address = String(p?.address || p?.address_name || "").trim();
        const wgs = resolvePlaceWgs84(p);
        const lat = Number(wgs?.lat);
        const lng = Number(wgs?.lng);
        const kakaoId = normalizeKakaoPlaceId(p);
        // 1) 카카오 상세 썸네일 우선 시도 (가게 사진 체감이 가장 자연스러움)
        if (kakaoId) {
          try {
            const kakaoInfo = await getKakaoPlaceBasicInfoViaProxy(kakaoId, {
              query: name,
              ...(Number.isFinite(lng) ? { x: lng } : {}),
              ...(Number.isFinite(lat) ? { y: lat } : {}),
            });
            const kakaoThumb = String(kakaoInfo?.thumbnail_url || "").trim();
            if (kakaoThumb) {
              setAiSheetPhotoByKey((prev) =>
                prev[key] ? prev : { ...prev, [key]: kakaoThumb },
              );
              continue;
            }
          } catch {
            /* no-op */
          }
        }
        const qs = new URLSearchParams({ name });
        if (address) qs.set("address", address);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          qs.set("lat", String(lat));
          qs.set("lng", String(lng));
        }
        try {
          const res = await fetch(
            `/api/google-place-photos?${qs.toString()}`,
            {
              signal: ac.signal,
              headers: await getApiAuthHeaders(),
            },
          );
          const data = await res.json().catch(() => null);
          const first = Array.isArray(data?.imageUrls)
            ? String(data.imageUrls[0] || "").trim()
            : "";
          if (first) {
            setAiSheetPhotoByKey((prev) =>
              prev[key] ? prev : { ...prev, [key]: first },
            );
          }
        } catch {
          /* no-op */
        }
      }
    };
    void run();
    return () => ac.abort();
  }, [aiSheetOpen, aiBottomSheetPlaces, aiSheetPlacePreviewKey, aiSheetPhotoByKey]);

  return {
    aiSheetPage,
    setAiSheetPage,
    aiSheetTotalPages,
    aiBottomSheetPagedPlaces,
    aiSheetExpandedReasonByKey,
    setAiSheetExpandedReasonByKey,
    aiSheetPhotoByKey,
    aiSheetPlacePreviewKey,
    aiSheetPhotoViewerOpen,
    setAiSheetPhotoViewerOpen,
    aiSheetPhotoViewerIndex,
    setAiSheetPhotoViewerIndex,
    aiSheetPhotoViewerSuppressOpenUntilRef,
    aiSheetPhotoViewerItems,
    closeAiSheetPhotoViewer,
  };
}
