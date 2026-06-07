import { useEffect, useState } from "react";

/** JUDO 로고 최소 노출 — 지도가 빨리 떠도 이 시간은 채움 */
export const ENTRY_SPLASH_MIN_MS = 3000;
export const ENTRY_SPLASH_FADE_MS = 550;
/** 지도 SDK가 매우 느릴 때만 강제 해제 */
export const ENTRY_SPLASH_MAX_WAIT_MS = 14000;

const MIN_VISIBLE_MS = ENTRY_SPLASH_MIN_MS;
const FADE_OUT_MS = ENTRY_SPLASH_FADE_MS;
const MAX_WAIT_MS = ENTRY_SPLASH_MAX_WAIT_MS;

/**
 * 앱 첫 마운트 시 블랙 배경 + JUDO — 지도 로드와 별개로 충분히 보여 준 뒤 페이드아웃.
 */
export default function EntrySplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    let fadeTimer = null;
    let hideTimer = null;

    const scheduleDismiss = () => {
      if (cancelled || fadeTimer) return;
      const remain = Math.max(0, MIN_VISIBLE_MS - (performance.now() - started));
      fadeTimer = setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        hideTimer = setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          try {
            if (typeof window !== "undefined") {
              window.__judoSplashHidden = true;
            }
            window.dispatchEvent(new CustomEvent("judo:splash-hidden"));
          } catch {
            /* ignore */
          }
        }, FADE_OUT_MS);
      }, remain);
    };

    window.addEventListener("judo:map-ready", scheduleDismiss, { once: true });
    const maxTimer = setTimeout(scheduleDismiss, MAX_WAIT_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("judo:map-ready", scheduleDismiss);
      clearTimeout(maxTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden={fading}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <span
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif',
          fontSize: "clamp(36px, 10vw, 56px)",
          fontWeight: 900,
          letterSpacing: "-0.06em",
          color: "#fff",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        JUDO
      </span>
    </div>
  );
}
