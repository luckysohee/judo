import { useEffect, useState } from "react";

const MIN_VISIBLE_MS = 800;
const FADE_OUT_MS = 420;

/**
 * 앱 첫 마운트 시 블랙 배경 + 로고 — 뒤에서 홈·지도가 로드되는 동안 체감 부드럽게.
 */
export default function EntrySplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), MIN_VISIBLE_MS);
    const t2 = setTimeout(() => setVisible(false), MIN_VISIBLE_MS + FADE_OUT_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
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
