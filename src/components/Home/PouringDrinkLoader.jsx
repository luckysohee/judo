import { useEffect, useId, useState } from "react";

/**
 * 검색 진행 중 — 손잡이 맥주잔: 맥주 채움 → 컵 위 거품 → 주륵 흘러내림.
 */
export default function PouringDrinkLoader({
  size = 64,
  label = "",
  rotateMessages = true,
  inline = false,
}) {
  const messages = [
    "잔을 채우는 중…",
    "취향을 섞는 중…",
    "어울리는 곳을 따르는 중…",
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!rotateMessages || label) return undefined;
    const t = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 1400);
    return () => clearInterval(t);
  }, [rotateMessages, label, messages.length]);

  const shownLabel = label || (rotateMessages ? messages[msgIdx] : "");

  const svgH = Math.round(size * 1.18);

  /** 머그 몸통 */
  const mugX = 15;
  const mugY = 30;
  const mugW = 38;
  const mugH = 48;
  /** 유리 두께 안쪽 — 맥주·거품 클립 */
  const innerX = mugX + 3.5;
  const innerY = mugY + 3.5;
  const innerW = mugW - 7;
  const innerH = mugH - 7;
  const innerBottom = innerY + innerH;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: inline ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: inline ? 10 : 8,
      }}
      role="status"
      aria-live="polite"
      aria-label={shownLabel || "검색 중"}
    >
      <style>{MUG_CSS}</style>
      <svg
        className="judoMugSvg"
        width={size}
        height={svgH}
        viewBox="0 0 88 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${clipId}-beerGrad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd166" />
            <stop offset="55%" stopColor="#f5a623" />
            <stop offset="100%" stopColor="#e8881a" />
          </linearGradient>
          <clipPath id={`${clipId}-beerClip`}>
            <rect x={innerX} y={innerY} width={innerW} height={innerH} rx="2" />
          </clipPath>
          {/* 거품 — 입구 폭에 맞춰 좌우로만 살짝 넘침 */}
          <clipPath id={`${clipId}-foam`}>
            <rect x={innerX - 3} y={mugY - 12} width={innerW + 6} height={17} />
          </clipPath>
          {/* 주륵 — 컵 옆면만 */}
          <clipPath id={`${clipId}-drip`}>
            <rect x={innerX} y={innerY} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* 손잡이 (뒤) */}
        <path
          d="M51 37 C64 37 68 46 68 54 C68 62 64 71 51 71"
          stroke="rgba(255,255,255,0.82)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="rgba(255,255,255,0.1)"
        />

        {/* 받침 */}
        <rect
          x="11"
          y="78"
          width="46"
          height="9"
          rx="2"
          fill="rgba(255,255,255,0.1)"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2.2"
        />

        {/* 머그 몸통 */}
        <rect
          x={mugX}
          y={mugY}
          width={mugW}
          height={mugH}
          rx="3"
          fill="rgba(255,255,255,0.07)"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2.5"
        />

        {/* 1단계: 맥주 채움 — 컵 안쪽만 */}
        <g clipPath={`url(#${clipId}-beerClip)`}>
          <rect
            className="judoMugBeer"
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            fill={`url(#${clipId}-beerGrad)`}
          />
          <rect
            className="judoMugShine"
            x={innerX + 4}
            y={innerY + 4}
            width="3.5"
            height={innerH * 0.32}
            rx="1.5"
            fill="rgba(255,255,255,0.38)"
          />
          <rect
            className="judoMugShine"
            x={innerX + 4}
            y={innerY + innerH * 0.42}
            width="3.5"
            height={innerH * 0.28}
            rx="1.5"
            fill="rgba(255,255,255,0.24)"
          />
        </g>

        {/* 2단계: 컵 위 거품 — 좌우로 빵실하게 */}
        <g clipPath={`url(#${clipId}-foam)`} className="judoMugFoamGroup">
          {/* 바닥 연결층 */}
          <rect
            x={innerX - 2}
            y={mugY - 2}
            width={innerW + 4}
            height="7.5"
            rx="3"
            fill="#e8edf2"
          />
          {/* 좌우 끝 살짝 넘치는 작은 덩어리 */}
          <ellipse cx={innerX + innerW * 0.05} cy={mugY - 2} rx="4.5" ry="4.2" fill="#f0f4f8" />
          <ellipse cx={innerX + innerW * 0.95} cy={mugY - 2} rx="4.5" ry="4.2" fill="#f0f4f8" />
          {/* 좌우로 퍼진 둥근 거품 덩어리 */}
          <ellipse className="judoMugFoamBlob judoMugFoamBlob--1" cx={innerX + innerW * 0.14} cy={mugY - 4} rx="6.8" ry="5.9" fill="#f2f6fa" />
          <ellipse className="judoMugFoamBlob judoMugFoamBlob--2" cx={innerX + innerW * 0.34} cy={mugY - 6} rx="7.4" ry="6.3" fill="#eef2f7" />
          <ellipse className="judoMugFoamBlob judoMugFoamBlob--3" cx={innerX + innerW * 0.52} cy={mugY - 7} rx="7.8" ry="6.6" fill="#f5f8fb" />
          <ellipse className="judoMugFoamBlob judoMugFoamBlob--4" cx={innerX + innerW * 0.7} cy={mugY - 6} rx="7.2" ry="6.1" fill="#eef2f7" />
          <ellipse className="judoMugFoamBlob judoMugFoamBlob--5" cx={innerX + innerW * 0.88} cy={mugY - 4} rx="6.4" ry="5.6" fill="#f2f6fa" />
          {/* 입구를 덮는 넓은 캡 */}
          <path
            d={`M ${innerX - 2} ${mugY + 4}
               C ${innerX + 1} ${mugY - 1}, ${innerX + innerW * 0.22} ${mugY - 8}, ${innerX + innerW * 0.5} ${mugY - 9}
               C ${innerX + innerW * 0.78} ${mugY - 8}, ${innerX + innerW - 1} ${mugY - 1}, ${innerX + innerW + 2} ${mugY + 4}
               C ${innerX + innerW} ${mugY + 7}, ${innerX + innerW * 0.5} ${mugY + 8}, ${innerX} ${mugY + 7}
               Z`}
            fill="#eef2f7"
            stroke="rgba(255,255,255,0.78)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* 하이라이트 */}
          <circle cx={innerX + innerW * 0.18} cy={mugY - 3} r="1.5" fill="#fff" opacity="0.75" />
          <circle cx={innerX + innerW * 0.26} cy={mugY - 5} r="2" fill="#fff" opacity="0.85" />
          <circle cx={innerX + innerW * 0.48} cy={mugY - 7} r="2.4" fill="#fff" opacity="0.92" />
          <circle cx={innerX + innerW * 0.68} cy={mugY - 5} r="1.9" fill="#fff" opacity="0.82" />
          <circle cx={innerX + innerW * 0.82} cy={mugY - 3} r="1.5" fill="#fff" opacity="0.75" />
        </g>

        <g clipPath={`url(#${clipId}-drip)`}>
          <path
            className="judoMugFoamDrip"
            d={`M ${innerX + innerW - 2} ${mugY + 2}
               C ${innerX + innerW} ${mugY + 12}, ${innerX + innerW - 1} ${mugY + 26}
               C ${innerX + innerW - 2} ${mugY + 40}, ${innerX + innerW - 1} ${mugY + 52}
               C ${innerX + innerW - 2} ${innerY + innerH - 4}, ${innerX + innerW - 1} ${innerBottom - 2}`}
            stroke="#eef2f7"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse
            className="judoMugFoamDripBulb"
            cx={innerX + innerW - 1.5}
            cy={innerBottom}
            rx="2.5"
            ry="2.8"
            fill="#eef2f7"
          />
        </g>
      </svg>

      {shownLabel ? (
        <span
          style={{
            fontSize: inline ? 12 : 13,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
          }}
        >
          {shownLabel}
        </span>
      ) : null}
    </div>
  );
}

const MUG_CSS = `
.judoMugSvg {
  display: block;
  overflow: hidden;
}

.judoMugBeer {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: judoMugBeerFill 2.8s ease-in-out infinite;
}

.judoMugShine {
  pointer-events: none;
}

.judoMugFoamGroup {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  opacity: 0;
  animation: judoMugFoamSpread 2.8s ease-out infinite;
}

.judoMugFoamBlob {
  transform-box: fill-box;
  transform-origin: center;
  animation: judoMugFoamBlobPop 2.8s ease-out infinite;
}

.judoMugFoamBlob--1 { animation-delay: 0.04s; }
.judoMugFoamBlob--2 { animation-delay: 0.07s; }
.judoMugFoamBlob--3 { animation-delay: 0.1s; }
.judoMugFoamBlob--4 { animation-delay: 0.13s; }
.judoMugFoamBlob--5 { animation-delay: 0.16s; }

.judoMugFoamDrip {
  stroke-dasharray: 70;
  stroke-dashoffset: 70;
  opacity: 0;
  animation: judoMugFoamDripRun 2.8s ease-in infinite;
}

.judoMugFoamDripBulb {
  opacity: 0;
  animation: judoMugFoamDripBulb 2.8s ease-in infinite;
}

/* 1) 맥주만 채움 */
@keyframes judoMugBeerFill {
  0%   { transform: scaleY(0); }
  36%  { transform: scaleY(1); }
  100% { transform: scaleY(1); }
}

/* 2) 맥주 다 찬 뒤 — 좌우로 퍼지며 빵실하게 */
@keyframes judoMugFoamSpread {
  0%, 34% {
    opacity: 0;
    transform: scale(0.72, 0.88);
  }
  40% {
    opacity: 1;
    transform: scale(1.13, 0.98);
  }
  46% {
    opacity: 1;
    transform: scale(0.98, 1.05);
  }
  52%, 58% {
    opacity: 1;
    transform: scale(1, 1);
  }
  100% {
    opacity: 1;
    transform: scale(1, 1);
  }
}

@keyframes judoMugFoamBlobPop {
  0%, 36% {
    transform: scale(0.4);
  }
  44% {
    transform: scale(1.18);
  }
  50% {
    transform: scale(0.92);
  }
  56%, 100% {
    transform: scale(1);
  }
}

/* 3) 거품 쌓인 뒤 주륵 */
@keyframes judoMugFoamDripRun {
  0%, 54% {
    stroke-dashoffset: 70;
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
  88% {
    stroke-dashoffset: 0;
    opacity: 0.85;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0.45;
  }
}

@keyframes judoMugFoamDripBulb {
  0%, 82% { opacity: 0; transform: scale(0.3); }
  90%     { opacity: 0.9; transform: scale(1.1); }
  100%    { opacity: 0.55; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .judoMugBeer { animation: none; transform: scaleY(1); }
  .judoMugFoamGroup { animation: none; opacity: 1; transform: scale(1, 1); }
  .judoMugFoamBlob { animation: none; transform: scale(1); }
  .judoMugFoamDrip { animation: none; stroke-dashoffset: 0; opacity: 0.7; }
  .judoMugFoamDripBulb { animation: none; opacity: 0.6; }
}
`;
