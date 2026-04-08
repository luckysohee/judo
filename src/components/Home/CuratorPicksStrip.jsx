import { useMemo } from "react";

/**
 * 검색창 위: 큐레이터 추천 장소 미니 칩 — 좌측 무한 흐름(마퀴).
 */
export default function CuratorPicksStrip({ places, onPick, visible }) {
  const marqueeItems = useMemo(() => {
    if (!places?.length) return [];
    const minRepeat = Math.max(2, Math.ceil(16 / places.length));
    const repeated = Array.from({ length: minRepeat }, () => places).flat();
    return [...repeated, ...repeated];
  }, [places]);

  if (!visible || !places?.length) return null;

  const durationSec = Math.min(56, Math.max(22, places.length * 9));

  return (
    <>
      <style>{`
        @keyframes judoCuratorMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .judo-curator-marquee-mask {
          overflow: hidden;
          width: 100%;
          margin-bottom: 6px;
          mask-image: linear-gradient(
            90deg,
            transparent 0%,
            black 6%,
            black 94%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0%,
            black 6%,
            black 94%,
            transparent 100%
          );
        }
        .judo-curator-marquee-track {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 6px;
          width: max-content;
          animation: judoCuratorMarquee ${durationSec}s linear infinite;
        }
        .judo-curator-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .judo-curator-marquee-track {
            animation: none;
            flex-wrap: wrap;
            row-gap: 4px;
            width: 100%;
            max-width: 100%;
          }
          .judo-curator-marquee-mask {
            mask-image: none;
            -webkit-mask-image: none;
          }
        }
      `}</style>
      <div
        className="judo-curator-marquee-mask"
        role="region"
        aria-label="큐레이터 추천 장소"
      >
        <div className="judo-curator-marquee-track">
          {marqueeItems.map((p, i) => (
            <button
              key={`${p.id}-${i}`}
              type="button"
              onClick={() => onPick?.(p)}
              style={{
                flex: "0 0 auto",
                maxWidth: 140,
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(0,0,0,0.42)",
                color: "#fff",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={
                p.name +
                (p.curatorCount
                  ? ` · 추천 ${p.curatorCount}명`
                  : "") +
                (p.category ? ` · ${p.category}` : "")
              }
            >
              {p.name}
              {p.curatorCount > 1 ? (
                <span style={{ opacity: 0.72, fontWeight: 500 }}>
                  {" "}
                  ·{p.curatorCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
