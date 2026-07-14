import { useEffect, useState } from "react";

function readLayoutViewportHeight() {
  if (typeof window === "undefined") return 800;
  const vv = window.visualViewport;
  const h = vv?.height ?? window.innerHeight;
  return Math.max(320, Math.round(h));
}

function readVisualViewportFrame() {
  if (typeof window === "undefined") {
    return { topPx: 0, heightPx: 800 };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { topPx: 0, heightPx: Math.max(320, Math.round(window.innerHeight)) };
  }
  return {
    topPx: Math.max(0, Math.round(vv.offsetTop || 0)),
    heightPx: Math.max(320, Math.round(vv.height)),
  };
}

/**
 * 실제로 보이는 레이아웃 높이(px) — 기기·주소창·PWA마다 `window.innerHeight`와 다를 수 있음.
 */
export function useLayoutViewportHeight() {
  const [heightPx, setHeightPx] = useState(readLayoutViewportHeight);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const sync = () => setHeightPx(readLayoutViewportHeight());

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, []);

  return heightPx;
}

/**
 * 모바일 주소창·키보드에 맞춘 fixed 셸용 프레임 (top + height).
 * @returns {{ topPx: number, heightPx: number }}
 */
export function useVisualViewportFrame() {
  const [frame, setFrame] = useState(readVisualViewportFrame);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const sync = () => setFrame(readVisualViewportFrame());

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, []);

  return frame;
}
