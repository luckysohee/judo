import { useEffect, useRef, useState } from "react";

/**
 * Intersection 기반 lazy mount.
 *
 * - 기본은 placeholder(빈 div)만 렌더 → 첫 페인트를 가볍게.
 * - viewport 근처(rootMargin)로 들어오면 children 을 한 번만 mount.
 * - IntersectionObserver 미지원 환경에서는 즉시 mount.
 *
 * @param {{
 *   children: any,
 *   placeholder?: any,
 *   rootMargin?: string,
 *   threshold?: number | number[],
 *   minHeight?: number | string,
 *   disabled?: boolean,
 * }} props
 */
export default function IntersectionMount({
  children,
  placeholder = null,
  rootMargin = "240px 0px",
  threshold = 0.01,
  minHeight = 0,
  disabled = false,
}) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(disabled);

  useEffect(() => {
    if (disabled) {
      setMounted(true);
      return undefined;
    }
    if (mounted) return undefined;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setMounted(true);
      return undefined;
    }
    const node = ref.current;
    if (!node) {
      setMounted(true);
      return undefined;
    }

    let done = false;
    const obs = new window.IntersectionObserver(
      (entries) => {
        if (done) return;
        const e = entries && entries[0];
        if (!e) return;
        if (e.isIntersecting || e.intersectionRatio > 0) {
          done = true;
          setMounted(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin, threshold },
    );
    obs.observe(node);
    return () => {
      done = true;
      try {
        obs.disconnect();
      } catch {
        /* noop */
      }
    };
  }, [disabled, mounted, rootMargin, threshold]);

  if (mounted) return children;

  const ph =
    placeholder ?? (
      <div
        aria-hidden="true"
        style={{
          width: "100%",
          minHeight,
        }}
      />
    );

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {ph}
    </div>
  );
}

