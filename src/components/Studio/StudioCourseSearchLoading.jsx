import { useEffect, useMemo, useState } from "react";

const KEYFRAMES_ID = "studio-course-search-loading-kf";

const KEYFRAMES = `
@keyframes studioCourseSearchPulse {
  0%, 100% { opacity: 0.45; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
}
@keyframes studioCourseSearchDash {
  to { stroke-dashoffset: -28; }
}
@keyframes studioCourseSearchShimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
}
@keyframes studioCourseSearchFade {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
@keyframes studioCourseSearchOrbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

const TIP_BY_PHASE = [
  {
    match: /의도|파악/,
    tips: [
      "검색어에서 동네·분위기를 읽고 있어요",
      "코스에 맞는 키워드로 넓히는 중",
    ],
  },
  {
    match: /지도|블로그|찾는/,
    tips: [
      "지도에서 후보를 모으고 있어요",
      "블로그 후기도 같이 훑는 중 — 조금만 기다려 주세요",
      "실존 장소만 골라 담는 중이에요",
    ],
  },
  {
    match: /보강|후보/,
    tips: [
      "빠진 골목 가게를 더 채우는 중",
      "동선이 맞는 집끼리 모으고 있어요",
    ],
  },
  {
    match: /잔 리스트/,
    tips: ["올려둔 잔 리스트도 후보에 섞는 중"],
  },
  {
    match: /초안|작성|조합/,
    tips: [
      "고른 집 사이로 동선을 짜는 중",
      "왜 이 집인지 한 줄씩 쓰는 중",
    ],
  },
  {
    match: /저장|등록|드래프트/,
    tips: ["에디터로 넘길 드래프트를 만드는 중"],
  },
];

const FALLBACK_TIPS = [
  "좋은 코스는 조금 더 기다려 줄 가치가 있어요",
  "후보를 고르고 이유를 붙이는 중이에요",
  "거의 다 왔어요",
];

function tipsForPhase(phaseMsg) {
  const msg = String(phaseMsg || "");
  for (const row of TIP_BY_PHASE) {
    if (row.match.test(msg)) return row.tips;
  }
  return FALLBACK_TIPS;
}

const styles = {
  wrap: {
    marginTop: "12px",
    padding: "14px 12px 12px",
    borderRadius: "12px",
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(129,140,248,0.22)",
    overflow: "hidden",
  },
  visual: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0",
    marginBottom: "12px",
    minHeight: "44px",
  },
  stop: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "rgba(165,180,252,0.95)",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.28)",
    animation: "studioCourseSearchPulse 1.4s ease-in-out infinite",
    flexShrink: 0,
  },
  pathSvg: {
    width: "36px",
    height: "14px",
    margin: "0 2px",
    overflow: "visible",
  },
  phase: {
    margin: "0 0 4px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "rgba(199,210,254,0.95)",
    animation: "studioCourseSearchFade 2.2s ease-in-out infinite",
  },
  tip: {
    margin: 0,
    fontSize: "11px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.48)",
    minHeight: "32px",
  },
  barTrack: {
    marginTop: "12px",
    height: "3px",
    borderRadius: "999px",
    background: "rgba(99,102,241,0.18)",
    overflow: "hidden",
    position: "relative",
  },
  barShine: {
    position: "absolute",
    inset: "0 auto 0 0",
    width: "42%",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, transparent, rgba(165,180,252,0.85), transparent)",
    animation: "studioCourseSearchShimmer 1.6s ease-in-out infinite",
  },
  orbit: {
    width: "18px",
    height: "18px",
    marginRight: "8px",
    borderRadius: "50%",
    border: "2px solid rgba(129,140,248,0.25)",
    borderTopColor: "rgba(165,180,252,0.95)",
    animation: "studioCourseSearchOrbit 0.85s linear infinite",
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0 },
  row: { display: "flex", alignItems: "flex-start", gap: "2px" },
};

/**
 * AI 코스 검색·초안 작성 중 대기 UI
 * @param {{ phaseMsg?: string, mode?: "loading" | "saving" }} props
 */
export default function StudioCourseSearchLoading({
  phaseMsg = "",
  mode = "loading",
}) {
  const [tipIndex, setTipIndex] = useState(0);
  const tips = useMemo(() => tipsForPhase(phaseMsg), [phaseMsg]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (document.getElementById(KEYFRAMES_ID)) return undefined;
    const el = document.createElement("style");
    el.id = KEYFRAMES_ID;
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
    return undefined;
  }, []);

  useEffect(() => {
    setTipIndex(0);
  }, [phaseMsg]);

  useEffect(() => {
    if (tips.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [tips]);

  const label =
    String(phaseMsg || "").trim() ||
    (mode === "saving" ? "저장 중…" : "장소 찾는 중…");

  return (
    <div style={styles.wrap} role="status" aria-live="polite" aria-busy="true">
      <div style={styles.visual} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            <span
              style={{
                ...styles.stop,
                animationDelay: `${i * 0.22}s`,
                background:
                  i === 1
                    ? "rgba(250,204,21,0.9)"
                    : "rgba(165,180,252,0.95)",
              }}
            />
            {i < 2 ? (
              <svg style={styles.pathSvg} viewBox="0 0 36 14" fill="none">
                <path
                  d="M2 7 H34"
                  stroke="rgba(165,180,252,0.55)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="5 5"
                  style={{ animation: "studioCourseSearchDash 0.9s linear infinite" }}
                />
              </svg>
            ) : null}
          </span>
        ))}
      </div>
      <div style={styles.row}>
        <div style={styles.orbit} aria-hidden />
        <div style={styles.textCol}>
          <p style={styles.phase}>{label}</p>
          <p style={styles.tip} key={`${label}-${tipIndex}`}>
            {tips[tipIndex % tips.length]}
          </p>
        </div>
      </div>
      <div style={styles.barTrack} aria-hidden>
        <div style={styles.barShine} />
      </div>
    </div>
  );
}
