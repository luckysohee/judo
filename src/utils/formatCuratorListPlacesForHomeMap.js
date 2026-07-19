import { formatCuratorProfilePlacesForHomeMap } from "./formatCuratorProfilePlacesForHomeMap";

/**
 * 맛집첩 장소 행 → 홈 지도 핀용
 * @param {unknown[]} listPlaceRows fetchCuratorListPlaces 결과
 * @param {string} curatorAuthUserId
 */
export function formatCuratorListPlacesForHomeMap(listPlaceRows, curatorAuthUserId) {
  const places = (Array.isArray(listPlaceRows) ? listPlaceRows : []).map(
    (row, index) => {
      const embedded =
        row?.places && typeof row.places === "object" ? row.places : null;
      return {
        id: row?.place_id || embedded?.id || row?.id,
        name: row?.place_name || embedded?.name || embedded?.place_name,
        address: row?.place_address || embedded?.address,
        category: embedded?.category,
        category_name: embedded?.category_name,
        lat: row?.lat ?? embedded?.lat,
        lng: row?.lng ?? embedded?.lng,
        kakao_place_id: row?.kakao_place_id || embedded?.kakao_place_id,
        image_url: row?.image_url || embedded?.image_url || null,
        comment: row?.memo || "",
        is_public: true,
        /** 맛집첩 펼침 핀 — 사진 원형 마커·클러스터 제외 */
        isListSpreadPin: true,
        listOrderIndex:
          Number.isFinite(Number(row?.order_index))
            ? Number(row.order_index)
            : index,
      };
    }
  );
  return formatCuratorProfilePlacesForHomeMap(places, curatorAuthUserId);
}
