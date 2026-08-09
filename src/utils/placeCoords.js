export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordField(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(",", ".");
  return parseFloat(s);
}

/**
 * 카카오 로컬 API 및 DB 장소 공통: y=위도, x=경도.
 * y/x 가 빈 문자열이거나 NaN이면 lat/lng 로 폴백 (?? 는 "" 를 건너뛰지 않음).
 */
export function resolvePlaceWgs84(place) {
  if (!place || typeof place !== "object") return null;

  const latCandidates = [place.y, place.lat, place.latitude];
  const lngCandidates = [place.x, place.lng, place.longitude];
  let lat = NaN;
  let lng = NaN;
  for (const c of latCandidates) {
    const n = parseCoordField(c);
    if (Number.isFinite(n)) {
      lat = n;
      break;
    }
  }
  for (const c of lngCandidates) {
    const n = parseCoordField(c);
    if (Number.isFinite(n)) {
      lng = n;
      break;
    }
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
  }
  const gc = place.geometry?.coordinates ?? place.coordinates;
  if (Array.isArray(gc) && gc.length >= 2) {
    const lngG = parseCoordField(gc[0]);
    const latG = parseCoordField(gc[1]);
    if (Number.isFinite(latG) && Number.isFinite(lngG)) {
      if (latG === 0 && lngG === 0) return null;
      return { lat: latG, lng: lngG };
    }
  }
  return null;
}

/**
 * 지도 마커 표시용: 한반도·제주 대략 범위 (과거 서울 소구역 박스는 전국 업로드가 안 보여 제거)
 */
export function isLikelyKoreaWgs84(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 33.0 && lat <= 38.85 && lng >= 124.4 && lng <= 132.3;
}

/**
 * 체크인 거리 검증: y/x와 lat/lng가 둘 다 있으면서 어긋나면, 사용자 GPS에 더 가까운 쌍을 쓴다.
 * (지도·저장은 lat/lng가 맞는데 카카오 y/x만 오래된 경우 오탐 방지)
 */
export function pickCheckinPlaceCoordsNearUser(place, userLat, userLng) {
  if (!place || typeof place !== "object") return null;
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return null;
  const y = parseFloat(place.y);
  const x = parseFloat(place.x);
  const la = parseFloat(place.lat);
  const ln = parseFloat(place.lng);
  const hasYx = Number.isFinite(y) && Number.isFinite(x);
  const hasLL = Number.isFinite(la) && Number.isFinite(ln);
  if (!hasYx && !hasLL) return null;
  if (!hasLL) return { lat: y, lng: x };
  if (!hasYx) return { lat: la, lng: ln };
  const dYx = haversineMeters(userLat, userLng, y, x);
  const dLL = haversineMeters(userLat, userLng, la, ln);
  if (Math.abs(dYx - dLL) < 30) return { lat: y, lng: x };
  return dLL <= dYx ? { lat: la, lng: ln } : { lat: y, lng: x };
}

function parseCoordValue(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** `perform_check_in_nearby` allow_radius 상한과 맞춤 (140 + accuracy≤280) */
export const CHECKIN_ALLOW_RADIUS_M = 420;

/**
 * DB/카드에 좌표가 있고 사용자와 거리가 합리적이면 카카오 로컬 재조회 생략.
 */
export function shouldRefetchKakaoCoordsForCheckin(plat, plng, userLat, userLng) {
  if (!Number.isFinite(plat) || !Number.isFinite(plng)) return true;
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return false;
  const d = haversineMeters(userLat, userLng, plat, plng);
  if (d <= CHECKIN_ALLOW_RADIUS_M + 80) return false;
  if (d > 2000) return false;
  return true;
}

/**
 * 한잔 RPC용 장소 WGS84: props·place 객체·카카오 로컬을 합치고,
 * 사용자 GPS가 있으면 그에 더 가까운 좌표 세트를 선택한다.
 */
export async function resolveCheckinPlaceCoords({
  place,
  placeLat,
  placeLng,
  kakaoPlaceId,
  placeName,
  placeAddress,
  userLat,
  userLng,
  fetchKakaoCoords,
  /** 거리 오류 재시도 등 — 로컬 좌표가 있어도 카카오 1회 허용 */
  forceKakao = false,
}) {
  let plat = parseCoordValue(placeLat);
  let plng = parseCoordValue(placeLng);
  const wgs = resolvePlaceWgs84(place);
  if (plat == null && wgs) {
    plat = wgs.lat;
    plng = wgs.lng;
  } else if (wgs && Number.isFinite(userLat) && Number.isFinite(userLng)) {
    const dProps = haversineMeters(userLat, userLng, plat, plng);
    const dWgs = haversineMeters(userLat, userLng, wgs.lat, wgs.lng);
    if (Number.isFinite(dWgs) && (!Number.isFinite(dProps) || dWgs < dProps - 15)) {
      plat = wgs.lat;
      plng = wgs.lng;
    }
  }

  const kid =
    (kakaoPlaceId != null && String(kakaoPlaceId).trim() !== ""
      ? String(kakaoPlaceId).trim()
      : null) ?? kakaoNumericPlaceId(place);

  const needsKakao =
    kid &&
    typeof fetchKakaoCoords === "function" &&
    (forceKakao ||
      shouldRefetchKakaoCoordsForCheckin(plat, plng, userLat, userLng));

  if (needsKakao) {
    const fromKakao = await fetchKakaoCoords({
      kakaoPlaceId: kid,
      name: placeName,
      address: placeAddress,
    });
    if (fromKakao?.lat != null && fromKakao?.lng != null) {
      if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
        const dCurrent =
          Number.isFinite(plat) && Number.isFinite(plng)
            ? haversineMeters(userLat, userLng, plat, plng)
            : Infinity;
        const dKakao = haversineMeters(
          userLat,
          userLng,
          fromKakao.lat,
          fromKakao.lng
        );
        if (dKakao < dCurrent - 15) {
          plat = fromKakao.lat;
          plng = fromKakao.lng;
        }
      } else {
        plat = fromKakao.lat;
        plng = fromKakao.lng;
      }
    }
  }

  if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
    const picked = pickCheckinPlaceCoordsNearUser(place, userLat, userLng);
    if (picked) {
      plat = picked.lat;
      plng = picked.lng;
    }
  }

  return {
    lat: Number.isFinite(plat) ? plat : null,
    lng: Number.isFinite(plng) ? plng : null,
  };
}

/** 카카오 로컬 숫자 장소 id만 (UUID가 place_id에 들어간 행은 제외) */
export function kakaoNumericPlaceId(place) {
  if (!place || typeof place !== "object") return null;
  const candidates = [
    place.kakao_place_id,
    place.place_id,
    place.kakaoId,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const s = String(c).trim();
    if (/^\d+$/.test(s)) return s;
  }
  return null;
}
