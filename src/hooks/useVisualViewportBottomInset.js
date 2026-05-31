import { useEffect, useState } from "react";

/**
 * Mobile virtual keyboard — layout viewport bottom inset (px) and visible height.
 * @returns {{ bottomPx: number, visibleHeightPx: number, layoutHeightPx: number, open: boolean }}
 */
export function useVisualViewportBottomInset() {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return { bottomPx: 0, visibleHeightPx: 800, layoutHeightPx: 800, open: false };
    }
    const layoutH = window.innerHeight;
    return {
      bottomPx: 0,
      visibleHeightPx: layoutH,
      layoutHeightPx: layoutH,
      open: false,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const sync = () => {
      const layoutH = window.innerHeight;
      const vv = window.visualViewport;
      if (!vv) {
        setState({
          bottomPx: 0,
          visibleHeightPx: layoutH,
          layoutHeightPx: layoutH,
          open: false,
        });
        return;
      }

      const visibleH = vv.height;
      const bottomPx = Math.max(0, Math.round(layoutH - visibleH - vv.offsetTop));
      setState({
        bottomPx,
        visibleHeightPx: visibleH,
        layoutHeightPx: layoutH,
        open: bottomPx > 48,
      });
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return state;
}
