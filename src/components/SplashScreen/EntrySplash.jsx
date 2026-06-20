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
/** 탭 세션당 1회 — JUDO 홈 버튼·재진입 시 스플래시 생략 */
export const ENTRY_SPLASH_SEEN_SESSION_KEY = "judo_entry_splash_seen_v1";
/** JUDO 노출 후 먼지처럼 사라지는 페이드아웃 */
const LOGO_HOLD_MS = 2000;
const LOGO_DUST_FADE_MS = 1000;
const QUESTION_FADE_IN_MS = 480;
/** 로고 흩어짐 + 질문 노출 최소 시간 — 마커 선도착 시에도 문구까지 보이게 */
const QUESTION_MIN_HOLD_MS = 900;
const MIN_SPLASH_TEXT_SEQUENCE_MS =
  LOGO_HOLD_MS + LOGO_DUST_FADE_MS + QUESTION_FADE_IN_MS + QUESTION_MIN_HOLD_MS;

const logoStyle = {
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
};

const questionStyle = {
  margin: 0,
  padding: "0 12px",
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif',
  fontSize: "clamp(19px, 4.8vw, 24px)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
  color: "#fff",
  lineHeight: 1.35,
  userSelect: "none",
  textAlign: "center",
  maxWidth: 320,
};

function shouldSkipEntrySplash() {
  if (typeof window === "undefined") return true;
  try {
    if (window.__judoSplashHidden) return true;
    return sessionStorage.getItem(ENTRY_SPLASH_SEEN_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * 앱 첫 마운트 시 블랙 배경 + JUDO → 질문 문구 — 핀 페인트 시 빠르게, 지도만이면 짧게, 최대 대기 후 페이드아웃.
 */
export default function EntrySplash() {
  const [visible, setVisible] = useState(() => !shouldSkipEntrySplash());
  const [fading, setFading] = useState(false);
  const [logoDissolving, setLogoDissolving] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);

  useEffect(() => {
    if (!visible && typeof window !== "undefined") {
      window.__judoSplashHidden = true;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    let dissolveTimer = null;
    let questionTimer = null;

    if (reduceMotion) {
      setShowQuestion(true);
    } else {
      dissolveTimer = setTimeout(() => {
        if (!cancelled) setLogoDissolving(true);
      }, LOGO_HOLD_MS);
      questionTimer = setTimeout(() => {
        if (!cancelled) setShowQuestion(true);
      }, LOGO_HOLD_MS + LOGO_DUST_FADE_MS);
    }

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
            try {
              sessionStorage.setItem(ENTRY_SPLASH_SEEN_SESSION_KEY, "1");
            } catch {
              /* ignore */
            }
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
      const target =
        started + Math.max(minMsFromStart, MIN_SPLASH_TEXT_SEQUENCE_MS);
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
      clearTimeout(dissolveTimer);
      clearTimeout(questionTimer);
      window.removeEventListener("judo:map-ready", onMapReady);
      window.removeEventListener("judo:map-markers-painted", onMarkersPainted);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

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
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "min(320px, 88vw)",
          minHeight: "clamp(36px, 10vw, 56px)",
        }}
      >
        <span
          style={{
            ...logoStyle,
            opacity: logoDissolving ? 0 : 1,
            filter: logoDissolving ? "blur(10px)" : "blur(0px)",
            transform: logoDissolving
              ? "scale(1.08) translateY(-10px)"
              : "scale(1) translateY(0)",
            transition: `opacity ${LOGO_DUST_FADE_MS}ms ease-out, filter ${LOGO_DUST_FADE_MS}ms ease-out, transform ${LOGO_DUST_FADE_MS}ms ease-out`,
            pointerEvents: "none",
            willChange: logoDissolving ? "opacity, filter, transform" : "auto",
          }}
        >
          JUDO
        </span>
        <span
          style={{
            ...questionStyle,
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: showQuestion ? 1 : 0,
            transition: `opacity ${QUESTION_FADE_IN_MS}ms ease-in`,
            pointerEvents: "none",
          }}
        >
          오늘은 어디서 한잔하지?
        </span>
      </div>
    </div>
  );
}
