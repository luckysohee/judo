/** Kakao 지도 level 기준 뷰포트 근사 bbox — getBounds() 전 마커 로드용 */
export function approxBoundsFromKakaoMapCenter(lat, lng, level = 4) {
  const lv = Math.max(1, Math.min(14, Number(level) || 4));
  const halfLat = 0.0018 * 2 ** (lv - 1);
  const halfLng = halfLat / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
  return {
    sw: { lat: lat - halfLat, lng: lng - halfLng },
    ne: { lat: lat + halfLat, lng: lng + halfLng },
  };
}

function tryWatchPosition(resolve, reject, { timeout = 12000 } = {}) {
  if (!navigator.geolocation?.watchPosition) {
    reject(new Error("GEO_WATCH_UNSUPPORTED"));
    return;
  }
  let watchId = null;
  let settled = false;
  const finish = (fn, arg) => {
    if (settled) return;
    settled = true;
    if (watchId != null) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
    }
    clearTimeout(timer);
    fn(arg);
  };
  const timer = setTimeout(() => {
    const err = new Error("GEO_TIMEOUT");
    err.code = 3;
    finish(reject, err);
  }, timeout);
  watchId = navigator.geolocation.watchPosition(
    (pos) =>
      finish(resolve, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }),
    (err) => finish(reject, err),
    { enableHighAccuracy: true, maximumAge: 0 }
  );
}

/** @returns {Promise<{ lat: number, lng: number }>} */
export function getDeviceLocation(opts = {}) {
  const {
    timeout = 12000,
    maximumAge = 180000,
    enableHighAccuracy = false,
    highAccuracyRetry = true,
    watchFallback = true,
  } = opts;

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GEO_UNSUPPORTED"));
      return;
    }

    const onFinalErr = (error) => {
      // 권한 거부는 watch로도 동일하게 실패 — 바로 전달
      if (Number(error?.code) === 1 || !watchFallback) {
        reject(error);
        return;
      }
      tryWatchPosition(resolve, reject, { timeout });
    };

    const onErr = (error, didRetry) => {
      if (Number(error?.code) === 3 && highAccuracyRetry && !didRetry) {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          (e) => onErr(e, true),
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 600000,
          }
        );
        return;
      }
      onFinalErr(error);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (error) => onErr(error, false),
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
}
