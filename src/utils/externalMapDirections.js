/**
 * 1차→2차 도보 길찾기 (외부 앱·웹). 주도는 흐름만 보여주고 실제 네비는 외부로.
 */

function enc(s) {
  return encodeURIComponent(String(s || "").trim() || "장소");
}

/** 구글 지도 도보 길찾기 (웹, 한국 포함 동작) */
export function buildGoogleMapsWalkingDirectionsUrl(from, to) {
  const oLat = Number(from?.lat);
  const oLng = Number(from?.lng);
  const dLat = Number(to?.lat);
  const dLng = Number(to?.lng);
  if (
    ![oLat, oLng, dLat, dLng].every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    return "";
  }
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", `${oLat},${oLng}`);
  u.searchParams.set("destination", `${dLat},${dLng}`);
  u.searchParams.set("travelmode", "walking");
  return u.toString();
}

/** 카카오맵 웹: 출발·도착 마커 링크 (앱 설치 시 앱으로 열릴 수 있음) */
export function buildKakaoMapFromToUrls(from, to) {
  const oLat = Number(from?.lat);
  const oLng = Number(from?.lng);
  const dLat = Number(to?.lat);
  const dLng = Number(to?.lng);
  const oName = enc(from?.name || from?.place_name);
  const dName = enc(to?.name || to?.place_name);
  if (
    ![oLat, oLng, dLat, dLng].every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    return { fromUrl: "", toUrl: "" };
  }
  return {
    fromUrl: `https://map.kakao.com/link/from/${oName},${oLat},${oLng}`,
    toUrl: `https://map.kakao.com/link/to/${dName},${dLat},${dLng}`,
  };
}

export function openInNewTab(url) {
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}
