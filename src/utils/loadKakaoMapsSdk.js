const KAKAO_SDK_SCRIPT_SELECTOR = 'script[data-kakao-maps-sdk="true"]';

function buildKakaoSdkSrc(appKey) {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    appKey
  )}&autoload=false&libraries=services,clusterer`;
}

function runKakaoMapsLoadCallback() {
  return new Promise((resolve, reject) => {
    const maps = window.kakao?.maps;
    if (!maps || typeof maps.load !== "function") {
      reject(new Error("kakao.maps.load 를 사용할 수 없습니다."));
      return;
    }
    if (typeof maps.Map === "function" && maps.readyState === 2) {
      resolve();
      return;
    }
    try {
      maps.load(() => {
        if (typeof maps.Map !== "function") {
          reject(new Error("카카오 Map 생성자를 찾지 못했습니다."));
          return;
        }
        resolve();
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Loads Kakao Maps JavaScript SDK once (shared by MapView, PlacePreviewCard, etc.)
 * @param {{ appKey?: string }} [opts]
 */
export function loadKakaoMapsSdk({ appKey: rawAppKey } = {}) {
  const appKey = String(rawAppKey || "").trim();

  return new Promise((resolve, reject) => {
    if (!appKey) {
      reject(new Error("VITE_KAKAO_JAVASCRIPT_KEY is missing"));
      return;
    }

    const finish = () => {
      runKakaoMapsLoadCallback().then(resolve).catch(reject);
    };

    if (window.kakao?.maps) {
      finish();
      return;
    }

    const existing = document.querySelector(KAKAO_SDK_SCRIPT_SELECTOR);
    if (existing) {
      if (existing.getAttribute("data-kakao-maps-error") === "1") {
        existing.remove();
      } else if (existing.complete) {
        finish();
        return;
      } else {
        existing.addEventListener("load", () => finish(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Kakao Maps SDK")),
          { once: true }
        );
        return;
      }
    }

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-kakao-maps-sdk", "true");
    script.src = buildKakaoSdkSrc(appKey);
    script.onload = () => finish();
    script.onerror = () => {
      script.setAttribute("data-kakao-maps-error", "1");
      reject(new Error("Failed to load Kakao Maps SDK"));
    };
    document.head.appendChild(script);
  });
}
