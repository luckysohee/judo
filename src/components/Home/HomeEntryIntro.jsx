import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import {
  ENTRY_SPLASH_FADE_MS,
  ENTRY_SPLASH_MIN_MS,
} from "../SplashScreen/EntrySplash";

export const HOME_DUST_INTRO_STORAGE_KEY = "judo_home_center_dust_intro_v3";
export const HOME_DUST_INTRO_HOLD_MS = 3000;
const FADE_IN_MS = 400;
const FADE_OUT_MS = 500;
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
  background: "rgba(248, 250, 252, 0.72)",
  WebkitBackdropFilter: "blur(20px) saturate(1.08)",
  backdropFilter: "blur(20px) saturate(1.08)",
};

const innerStyle = {
  position: "relative",
  zIndex: 1,
  textAlign: "center",
  maxWidth: 360,
  width: "100%",
};

const cardStyle = {
  margin: "0 auto",
  padding: "22px 26px",
  borderRadius: 20,
  background: "#ffffff",
  boxShadow:
    "0 4px 24px rgba(15, 23, 42, 0.12), 0 16px 48px rgba(15, 23, 42, 0.14)",
  border: "1px solid rgba(255, 255, 255, 0.95)",
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(19px, 4.8vw, 23px)",
  fontWeight: 800,
  letterSpacing: "-0.035em",
  color: "#0f172a",
  lineHeight: 1.35,
};

const subStyle = {
  margin: "12px 0 0",
  fontSize: 13,
  fontWeight: 600,
  color: "#475569",
  lineHeight: 1.45,
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
 * Home lazy-load와 무관하게 App에서 마운트.
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

    let cancelled = false;
    const timers = [];

    const runIntro = () => {
      if (cancelled || doneRef.current) return;
      setActive(true);
      setOpaque(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setOpaque(true);
        });
      });
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setOpaque(false);
        }, FADE_IN_MS + HOME_DUST_INTRO_HOLD_MS)
      );
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) finish();
        }, HOME_DUST_INTRO_MS)
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
          ENTRY_SPLASH_MIN_MS + ENTRY_SPLASH_FADE_MS + 300
        )
      );
    }

    return () => {
      cancelled = true;
      window.removeEventListener("judo:splash-hidden", onSplashHidden);
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
        <div style={cardStyle}>
          <p style={titleStyle}>오늘은 어디서 한잔?</p>
          <p style={subStyle}>
            예: 합정 1차 어디로 — 탭하면 검색에 써 보세요
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
