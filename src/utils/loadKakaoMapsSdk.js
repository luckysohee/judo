const KAKAO_SDK_SCRIPT_SELECTOR = 'script[data-kakao-maps-sdk="true"]';

/** Vite env name — Vercel에도 동일 키로 넣어야 함 (REST 키와 다름) */
export const KAKAO_JAVASCRIPT_ENV_KEY = "VITE_KAKAO_JAVASCRIPT_KEY";

/** @returns {string} Kakao Maps JavaScript app key from build-time env */
export function getKakaoJavascriptAppKey() {
  return String(import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ?? "").trim();
}

/** @param {string} appKey */
export function buildKakaoMapsSdkScriptSrc(appKey) {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    appKey
  )}&autoload=false&libraries=services,clusterer`;
}

function logKakaoEnvDiagnostics(context) {
  const key = getKakaoJavascriptAppKey();
  console.error(`[Kakao Maps SDK] ${context}`, {
    envKey: KAKAO_JAVASCRIPT_ENV_KEY,
    keyPresent: Boolean(key),
    keyLength: key.length,
    mode: import.meta.env.MODE,
    production: import.meta.env.PROD,
  });
}

function logKakaoSdkScriptError(scriptEl, context) {
  const src = scriptEl?.src || "(no src)";
  console.error(`[Kakao Maps SDK] script.onerror (${context}) src:`, src);
  logKakaoEnvDiagnostics(context);
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
  const appKey = String(rawAppKey ?? getKakaoJavascriptAppKey()).trim();

  return new Promise((resolve, reject) => {
    if (!appKey) {
      logKakaoEnvDiagnostics("VITE_KAKAO_JAVASCRIPT_KEY is missing");
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
          () => {
            logKakaoSdkScriptError(existing, "existing script");
            reject(new Error("Failed to load Kakao Maps SDK"));
          },
          { once: true }
        );
        return;
      }
    }

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-kakao-maps-sdk", "true");
    script.src = buildKakaoMapsSdkScriptSrc(appKey);
    script.onload = () => finish();
    script.onerror = () => {
      script.setAttribute("data-kakao-maps-error", "1");
      logKakaoSdkScriptError(script, "new script");
      reject(new Error("Failed to load Kakao Maps SDK"));
    };
    document.head.appendChild(script);
  });
}
