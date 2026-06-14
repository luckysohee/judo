import { useEffect, useState } from "react";

/** 지도만 준비됐을 때 스플래시 최소 노출(이후 마커 페인트 대기) */
export const ENTRY_SPLASH_MAP_READY_MIN_MS = 800;
export const ENTRY_SPLASH_FADE_MS = 550;
/** 지도·마커가 매우 느릴 때만 강제 해제 */
export const ENTRY_SPLASH_MAX_WAIT_MS = 14000;

const FADE_OUT_MS = ENTRY_SPLASH_FADE_MS;
const MAX_WAIT_MS = ENTRY_SPLASH_MAX_WAIT_MS;
/** map-ready 후 마커 SVG·클러스터 생성 여유 */
const MAP_READY_MARKERS_GRACE_MS = 2200;

/**
 * 앱 첫 마운트 시 블랙 배경 + JUDO — 핀 페인트 시 빠르게, 지도만이면 짧게, 최대 대기 후 페이드아웃.
 */
export default function EntrySplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    let dismissTargetAt = started + MAX_WAIT_MS;
    let fadeTimer = null;
    let hideTimer = null;
    let fadeStarted = false;

    const startFadeOut = () => {
      if (cancelled || fadeStarted) return;
      fadeStarted = true;
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
    };

    const armDismissTimer = () => {
      clearTimeout(fadeTimer);
      const remain = Math.max(0, dismissTargetAt - performance.now());
      fadeTimer = setTimeout(() => {
        if (cancelled) return;
        startFadeOut();
      }, remain);
    };

    const bumpDismiss = (minMsFromStart) => {
      const target = started + minMsFromStart;
      if (target < dismissTargetAt) {
        dismissTargetAt = target;
        armDismissTimer();
      }
    };

    const onMapReady = () => {
      bumpDismiss(
        performance.now() - started + MAP_READY_MARKERS_GRACE_MS
      );
    };
    const onMarkersPainted = () => {
      bumpDismiss(performance.now() - started);
    };

    if (typeof window !== "undefined" && window.__judoMarkersPainted) {
      onMarkersPainted();
    }

    armDismissTimer();
    window.addEventListener("judo:map-ready", onMapReady, { once: true });
    window.addEventListener(
      "judo:map-markers-painted",
      onMarkersPainted,
      { once: true }
    );

    return () => {
      cancelled = true;
      window.removeEventListener("judo:map-ready", onMapReady);
      window.removeEventListener("judo:map-markers-painted", onMarkersPainted);
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
