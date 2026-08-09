import { resolvePlaceWgs84 } from "./placeCoords";

/**
 * 맛집첩 장소 행 → 홈 지도 핀용.
 * bounds 포맷터(주소·좌표 불일치 필터)를 거치지 않는다 — 첩에 담긴 장소는 그대로 핀으로 올린다.
 * @param {unknown[]} listPlaceRows fetchCuratorListPlaces 결과
 * @param {string} curatorAuthUserId
 */
export function formatCuratorListPlacesForHomeMap(listPlaceRows, curatorAuthUserId) {
  const cid = String(curatorAuthUserId ?? "").trim();
  return (Array.isArray(listPlaceRows) ? listPlaceRows : [])
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const embedded =
        row.places && typeof row.places === "object" ? row.places : null;
      const id = String(
        row.place_id || embedded?.id || row.id || ""
      ).trim();
      if (!id) return null;

      const name = String(
        row.place_name || embedded?.name || embedded?.place_name || ""
      ).trim();
      const address = String(
        row.place_address || embedded?.address || ""
      ).trim();
      const w = resolvePlaceWgs84({
        lat: row.lat ?? embedded?.lat,
        lng: row.lng ?? embedded?.lng,
        y: embedded?.y,
        x: embedded?.x,
      });
      if (!w) return null;

      const comment =
        row.memo != null && String(row.memo).trim()
          ? String(row.memo).trim()
          : "";
      const kakao =
        row.kakao_place_id || embedded?.kakao_place_id || null;
      const image_url = row.image_url || embedded?.image_url || null;

      return {
        id,
        name: name || "이름 없음",
        address,
        category: embedded?.category,
        category_name: embedded?.category_name,
        lat: w.lat,
        lng: w.lng,
        x: String(w.lng),
        y: String(w.lat),
        kakao_place_id: kakao,
        image_url,
        comment,
        is_public: true,
        /** 맛집첩 펼침 핀 — 사진 원형 마커·클러스터 제외 */
        isListSpreadPin: true,
        listOrderIndex: Number.isFinite(Number(row.order_index))
          ? Number(row.order_index)
          : index,
        curatorCount: cid ? 1 : 0,
        curatorPlaces: cid
          ? [
              {
                curator_id: cid,
                one_line_reason: comment || null,
              },
            ]
          : [],
      };
    })
    .filter(Boolean);
}
