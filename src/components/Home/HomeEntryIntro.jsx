import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import {
  ENTRY_SPLASH_FADE_MS,
  ENTRY_SPLASH_MAX_WAIT_MS,
} from "../SplashScreen/EntrySplash";
import { warmupHomeMapBoot } from "../../utils/warmupHomeMapBoot";

export const HOME_DUST_INTRO_STORAGE_KEY = "judo_home_center_dust_intro_v3";
export const HOME_DUST_INTRO_HOLD_MS = 2500;
const FADE_IN_MS = 400;
const FADE_OUT_MS = 500;
/** 멘트 최소 노출(페이드인 이후) — 핀이 먼저 준비돼도 읽을 시간 확보 */
const INTRO_MIN_HOLD_AFTER_FADE_IN_MS = 1200;
/** 핀 준비와 무관하게 인트로 강제 종료 */
const INTRO_MAX_MS = 6800;
export const HOME_DUST_INTRO_MS =
  FADE_IN_MS + HOME_DUST_INTRO_HOLD_MS + FADE_OUT_MS;

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 95000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 20px",
  cursor: "pointer",
};

const backdropStyle = {
  position: "absolute",
  inset: 0,
  background: "#000000",
};

const innerStyle = {
  position: "relative",
  zIndex: 1,
  textAlign: "center",
  maxWidth: 360,
  width: "100%",
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(19px, 4.8vw, 23px)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
  color: "#ffffff",
  lineHeight: 1.35,
};

function shouldSkipIntro() {
  if (typeof window === "undefined") return true;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return true;
    }
    return sessionStorage.getItem(HOME_DUST_INTRO_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * 홈(`/`) 첫 진입 — JUDO 스플래시 이후 body 포털로 "오늘은 어디서 한잔?" 표시.
 * 인트로 동안 뒤에서 지도·마커 부트를 돌리고, 핀 페인트 + 최소 노출 후 닫힘.
 */
export default function HomeEntryIntro() {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const [skip, setSkip] = useState(shouldSkipIntro);
  const [active, setActive] = useState(false);
  const [opaque, setOpaque] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setSkip(true);
    setActive(false);
    setOpaque(false);
    try {
      sessionStorage.setItem(HOME_DUST_INTRO_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onDismiss = () => finish();
    window.addEventListener("judo:dust-intro-dismiss", onDismiss);
    return () => window.removeEventListener("judo:dust-intro-dismiss", onDismiss);
  }, [finish]);

  useEffect(() => {
    if (!onHome || skip) return;

    warmupHomeMapBoot();
    void import("../../pages/Home/Home");

    let cancelled = false;
    const timers = [];
    let onMarkersPaintedListener = null;

    const runIntro = () => {
      if (cancelled || doneRef.current) return;

      let markersPainted =
        typeof window !== "undefined" && Boolean(window.__judoMarkersPainted);
      let holdEligible = false;

      const tryDismissIntro = () => {
        if (cancelled || doneRef.current) return;
        if (markersPainted && holdEligible) {
          setOpaque(false);
          timers.push(
            window.setTimeout(() => {
              if (!cancelled) finish();
            }, FADE_OUT_MS)
          );
        }
      };

      onMarkersPaintedListener = () => {
        markersPainted = true;
        tryDismissIntro();
      };

      setActive(true);
      setOpaque(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setOpaque(true);
        });
      });

      window.addEventListener(
        "judo:map-markers-painted",
        onMarkersPaintedListener,
        { once: true }
      );

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setOpaque(false);
        }, FADE_IN_MS + HOME_DUST_INTRO_HOLD_MS)
      );

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) holdEligible = true;
          tryDismissIntro();
        }, FADE_IN_MS + INTRO_MIN_HOLD_AFTER_FADE_IN_MS)
      );

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) finish();
        }, INTRO_MAX_MS)
      );
    };

    const onSplashHidden = () => {
      if (!cancelled) runIntro();
    };

    if (window.__judoSplashHidden) {
      runIntro();
    } else {
      window.addEventListener("judo:splash-hidden", onSplashHidden, { once: true });
      timers.push(
        window.setTimeout(
          onSplashHidden,
          ENTRY_SPLASH_MAX_WAIT_MS + ENTRY_SPLASH_FADE_MS + 300
        )
      );
    }

    return () => {
      cancelled = true;
      window.removeEventListener("judo:splash-hidden", onSplashHidden);
      if (onMarkersPaintedListener) {
        window.removeEventListener(
          "judo:map-markers-painted",
          onMarkersPaintedListener
        );
      }
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [onHome, skip, finish]);

  const handleTap = () => {
    try {
      window.dispatchEvent(new CustomEvent("judo:dust-intro-tap"));
    } catch {
      /* ignore */
    }
    finish();
  };

  if (!onHome || skip || !active || typeof document === "undefined") {
    return null;
  }

  const transition = `opacity ${opaque ? FADE_IN_MS : FADE_OUT_MS}ms ease`;

  return createPortal(
    <div
      style={overlayStyle}
      role="button"
      tabIndex={0}
      aria-label="검색창에서 답하기"
      onClick={handleTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleTap();
        }
      }}
    >
      <div
        aria-hidden
        style={{ ...backdropStyle, opacity: opaque ? 1 : 0, transition }}
      />
      <div style={{ ...innerStyle, opacity: opaque ? 1 : 0, transition }}>
        <p style={titleStyle}>오늘은 어디서 한잔?</p>
      </div>
    </div>,
    document.body
  );
}
