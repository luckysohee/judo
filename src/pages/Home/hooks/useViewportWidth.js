import { useEffect, useState } from "react";

/**
 * 현재 브라우저 뷰포트 너비를 반응형으로 추적.
 * 데스크톱/모바일 분기, 사이드 패널 노출 결정 등에 사용.
 */
export function useViewportWidth() {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return viewportWidth;
}
