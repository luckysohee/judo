import { useEffect, useState } from "react";

function readLayoutViewportHeight() {
  if (typeof window === "undefined") return 800;
  const vv = window.visualViewport;
  const h = vv?.height ?? window.innerHeight;
  return Math.max(320, Math.round(h));
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
