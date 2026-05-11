import { useCallback, useEffect, useState } from "react";

/**
 * IntersectionObserver: viewport 진입을 1회만 감지.
 *
 * @param {{
 *   rootMargin?: string,
 *   threshold?: number | number[],
 *   disabled?: boolean,
 * }} [opts]
 */
export function useIntersectionOnce({
  rootMargin = "0px",
  threshold = 0.15,
  disabled = false,
} = {}) {
  const [node, setNode] = useState(null);
  const [seen, setSeen] = useState(Boolean(disabled));

  const ref = useCallback((el) => {
    setNode(el || null);
  }, []);

  useEffect(() => {
    if (disabled) {
      setSeen(true);
      return undefined;
    }
    if (seen) return undefined;
    if (typeof window === "undefined") {
      setSeen(true);
      return undefined;
    }
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return undefined;
    }
    if (!node) return undefined;

    let alive = true;
    const obs = new window.IntersectionObserver(
      (entries) => {
        if (!alive) return;
        const e = entries && entries[0];
        if (!e) return;
        if (e.isIntersecting || e.intersectionRatio > 0) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin, threshold },
    );
    obs.observe(node);
    return () => {
      alive = false;
      try {
        obs.disconnect();
      } catch {
        /* noop */
      }
    };
  }, [disabled, node, rootMargin, seen, threshold]);

  return { ref, seen };
}

