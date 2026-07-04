import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const PAD = 10;
const HOLE_RADIUS = 14;
const OVERLAY_Z = 30000;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {DOMRect} rect
 */
function paddedHole(rect) {
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
}

/**
 * 홈 첫 진입 — 어두운 오버레이 + 구역 스포트라이트 + 짧은 설명
 */
export default function HomeOnboardingCoach({
  open,
  step,
  stepIndex,
  stepCount,
  onNext,
  onSkip,
}) {
  const [hole, setHole] = useState(null);

  useLayoutEffect(() => {
    if (!open || !step?.target) {
      setHole(null);
      return undefined;
    }

    const selector = `[data-judo-coach="${step.target}"]`;

    const measure = () => {
      const el = document.querySelector(selector);
      if (!el || el.getClientRects().length === 0) {
        setHole(null);
        return;
      }
      setHole(paddedHole(el.getBoundingClientRect()));
    };

    measure();
    const t = window.setTimeout(measure, 120);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    const el = document.querySelector(selector);
    const ro =
      typeof ResizeObserver !== "undefined" && el
        ? new ResizeObserver(measure)
        : null;
    if (ro && el) ro.observe(el);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      ro?.disconnect();
    };
  }, [open, step?.target, stepIndex]);

  if (!open || !step || typeof document === "undefined") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let tooltipStyle = {
    position: "fixed",
    left: 16,
    right: 16,
    maxWidth: 360,
    margin: "0 auto",
    zIndex: OVERLAY_Z + 2,
    pointerEvents: "auto",
  };

  if (hole) {
    const cardH = 148;
    if (step.placement === "above") {
      tooltipStyle = {
        ...tooltipStyle,
        top: clamp(hole.top - cardH - 14, 12, vh - cardH - 12),
        left: clamp(hole.left, 12, vw - 372),
        right: "auto",
        width: Math.min(360, vw - 24),
      };
    } else {
      tooltipStyle = {
        ...tooltipStyle,
        top: clamp(hole.top + hole.height + 14, 12, vh - cardH - 12),
        left: clamp(hole.left, 12, vw - 372),
        right: "auto",
        width: Math.min(360, vw - 24),
      };
    }
  } else {
    tooltipStyle = {
      ...tooltipStyle,
      top: "50%",
      transform: "translateY(-50%)",
    };
  }

  const maskId = `judo-coach-mask-${stepIndex}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judo-coach-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: OVERLAY_Z,
        pointerEvents: "auto",
      }}
    >
      <svg
        width={vw}
        height={vh}
        style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {hole ? (
              <rect
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx={HOLE_RADIUS}
                ry={HOLE_RADIUS}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.78)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {hole ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            borderRadius: HOLE_RADIUS,
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.55), 0 0 24px rgba(255,255,255,0.22)",
            pointerEvents: "none",
            zIndex: OVERLAY_Z + 1,
          }}
        />
      ) : null}

      <div
        style={{
          ...tooltipStyle,
          borderRadius: 16,
          padding: "16px 16px 14px",
          background: "rgba(22, 22, 24, 0.94)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.48)",
            marginBottom: 6,
          }}
        >
          {stepIndex + 1} / {stepCount}
        </div>
        <div
          id="judo-coach-title"
          style={{
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          {step.title}
        </div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {step.body}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onSkip}
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "8px 4px",
            }}
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={onNext}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              background: "rgba(255,255,255,0.94)",
              color: "#111",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {stepIndex >= stepCount - 1 ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
