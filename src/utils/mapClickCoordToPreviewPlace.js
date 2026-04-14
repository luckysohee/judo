/**
 * 지도 클릭 좌표 → 카카오 Geocoder.coord2Address 로 주소만 해석.
 * Places categorySearch 등 “근처 업소 검색” 없이 클릭 지점 기준 카드용 객체 생성.
 */

function roundCoord(n, digits = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toFixed(digits);
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object>} PlacePreviewCard용 (kakao_place_id 없음, isMapCoordinatePick)
 */
export function mapClickCoordToPreviewPlace(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Promise.resolve(null);
  }

  const latR = roundCoord(lat, 6);
  const lngR = roundCoord(lng, 6);
  const stableId = `map_coord_${latR}_${lngR}`;

  const fallback = () => ({
    id: stableId,
    name: "선택한 위치",
    address: "",
    lat,
    lng,
    isKakaoPlace: false,
    isMapCoordinatePick: true,
    kakao_place_id: null,
  });

  if (!window.kakao?.maps?.services) {
    return Promise.resolve(fallback());
  }

  return new Promise((resolve) => {
    try {
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (
          status !== window.kakao.maps.services.Status.OK ||
          !result?.length
        ) {
          resolve(fallback());
          return;
        }
        const r = result[0];
        const road = r.road_address;
        const jibun = r.address;
        const roadLine = road?.address_name || "";
        const jibunLine = jibun?.address_name || "";
        const building =
          (road?.building_name && String(road.building_name).trim()) || "";
        const name =
          building ||
          roadLine ||
          jibunLine ||
          "선택한 위치";
        const address = roadLine || jibunLine || "";

        resolve({
          id: stableId,
          name,
          place_name: name,
          address,
          road_address_name: roadLine,
          address_name: jibunLine,
          lat,
          lng,
          x: String(lng),
          y: String(lat),
          isKakaoPlace: false,
          isMapCoordinatePick: true,
          kakao_place_id: null,
          category: "",
          category_name: "",
        });
      });
    } catch {
      resolve(fallback());
    }
  });
}
