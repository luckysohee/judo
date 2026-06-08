import { lazy } from "react";

const CHUNK_RELOAD_KEY = "judo_chunk_reload_v1";

/**
 * 배포 직후 예전 index.html 이 삭제된 lazy chunk 를 요청할 때 — 1회 새로고침 후 재시도
 * @param {() => Promise<{ default: React.ComponentType }>} factory
 */
export function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch((err) => {
      const msg = String(err?.message || err || "");
      const isChunk =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module");

      if (isChunk && typeof window !== "undefined" && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
        return new Promise(() => {});
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      }
      throw err;
    })
  );
}

/** 앱 정상 마운트 후 호출 — 청크 리로드 플래그 제거 */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}
