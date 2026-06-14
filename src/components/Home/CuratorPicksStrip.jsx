import { useMemo } from "react";

function curatorPickHoverText(place) {
  const name = String(place?.name || "").trim();
  let s = name;
  const cc = Number(place?.curatorCount);
  if (Number.isFinite(cc) && cc > 0) s += ` · 추천 ${cc}명`;
  const cat = String(place?.category || place?.category_name || "").trim();
  if (cat) s += ` · ${cat}`;
  const addr = String(place?.address || "").trim();
  if (addr) s += ` · ${addr.slice(0, 48)}`;
  const cp0 = Array.isArray(place?.curatorPlaces) ? place.curatorPlaces[0] : null;
  const line = String(
    cp0?.one_line_reason || cp0?.menu_reason || cp0?.one_line_review || "",
  ).trim();
  if (line) s += ` — ${line.slice(0, 140)}`;
  return s;
}

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

  const durationSec = Math.min(96, Math.max(48, places.length * 16));

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
              title={curatorPickHoverText(p)}
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
