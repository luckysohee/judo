import { useEffect, useRef } from "react";

import {
  fetchPlaceDetail,
  fetchPlaceUuidByKakaoPlaceId,
} from "../../../api/places";
import {
  AI_API_BASE,
  attachCuratorsToCuratorPlaceRows,
  mergeDbPlaceDetailForPreview,
} from "../homeModule.js";
import { buildFormattedPlacesFromJoin } from "../../../utils/buildFormattedPlacesFromJoin";
import { normalizeKakaoPlaceId } from "../../../utils/mergePickedPlaceWithCuratorCatalog";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 미리보기에 떠있는 `selectedPlace`의 id 3종(uuid / place_id / kakao_place_id)이
 * 바뀔 때마다 Supabase `places` 행 + `curator_places` 행을 가져와 병합한다.
 *
 * - 같은 venue 내부 필드만 갱신될 땐 재요청하지 않는다
 * - 응답이 늦게 도착해도 venue가 바뀌었으면 setter가 prev 그대로 반환
 *
 * @param {object|null} selectedPlace - 현재 미리보기 중인 장소
 * @param {(updater: ((prev: any) => any)) => void} setSelectedPlace - setSelectedPlace setter
 * @param {{ current: any[] }} curatorAttachRowsRef - 큐레이터 join용 원본 행 ref
 */
export function usePlaceDetailEnrichment(
  selectedPlace,
  setSelectedPlace,
  curatorAttachRowsRef,
) {
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!selectedPlace) return undefined;

    const seq = ++requestSeqRef.current;
    let cancelled = false;

    (async () => {
      let uuid = null;
      const idStr =
        selectedPlace?.id != null ? String(selectedPlace.id) : "";
      if (UUID_RE.test(idStr)) {
        uuid = idStr;
      } else {
        const kid = normalizeKakaoPlaceId(selectedPlace);
        if (!kid) return;
        uuid = await fetchPlaceUuidByKakaoPlaceId(kid);
        if (!uuid) return;
      }

      if (cancelled || seq !== requestSeqRef.current) return;

      try {
        const { place: detail, curatorPlaceRows } = await fetchPlaceDetail(
          uuid,
          AI_API_BASE,
        );
        if (cancelled || seq !== requestSeqRef.current) return;

        const joinRows = (curatorPlaceRows || []).map((cp) => ({
          ...cp,
          places: { ...detail },
        }));
        const attached = attachCuratorsToCuratorPlaceRows(
          joinRows,
          curatorAttachRowsRef.current,
        );
        const formatted = buildFormattedPlacesFromJoin(attached);
        const enriched = formatted[0] ?? null;

        setSelectedPlace((prev) => {
          if (!prev) return prev;
          if (cancelled || seq !== requestSeqRef.current) return prev;

          const prevUuid =
            prev?.id != null && UUID_RE.test(String(prev.id))
              ? String(prev.id)
              : null;
          const prevKid = normalizeKakaoPlaceId(prev);
          const detailKid = normalizeKakaoPlaceId(detail);

          const sameVenue =
            (prevUuid && prevUuid === uuid) ||
            (prevKid && detailKid && prevKid === detailKid);
          if (!sameVenue) return prev;

          return mergeDbPlaceDetailForPreview(prev, detail, enriched);
        });
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("fetchPlaceDetail:", e?.message ?? e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    /** 같은 venue 내부 필드 변화로는 재요청하지 않음 — id 3종에만 반응 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPlace?.id,
    selectedPlace?.place_id,
    selectedPlace?.kakao_place_id,
  ]);
}
