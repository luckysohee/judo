// components/Map/MarkerLegend.jsx

import { useEffect, useState } from "react";

export default function MarkerLegend({
  savedOnly,
  onToggleSavedOnly,
  onSelectCategory,
  activeCategory,
  closeSignal,
  /** Home에서 지도 빈 곳 클릭 시 증가 → 패널 닫기(0이면 초기 마운트에서 무시) */
  mapCloseTick = 0,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!closeSignal) return;
    setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    if (mapCloseTick === 0) return;
    setOpen(false);
  }, [mapCloseTick]);

  const items = [
    { key: "basic", label: "단일 추천", color: "#10b981", icon: "🟢" },
    { key: "hot", label: "공동 추천", color: "#8b5cf6", icon: "🟣" },
    { key: "premium", label: "프리미엄 스팟", color: "#f59e0b", icon: "🟠" },
  ];

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={onToggleSavedOnly}
        style={styles.savedOnlyButton}
        aria-label={
          savedOnly
            ? "내가 저장한 장소만 보기 해제"
            : "내가 저장한 장소만 보기 (큐레이터는 비공개 추천 포함)"
        }
        title={
          savedOnly
            ? "내가 저장한 장소만 보기 해제"
            : "내가 저장한 장소만 보기 · 큐레이터는 내 비공개 추천까지 표시"
        }
      >
        <span
          style={savedOnly ? styles.savedOnlyStarOn : styles.savedOnlyStarOff}
          aria-hidden
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>
      </button>

      {!open ? (
        <button
          type="button"
          style={styles.collapsedButton}
          onClick={() => setOpen(true)}
          aria-label="마커 안내 열기"
          title="마커 안내"
        >
          <div style={styles.collapsedDots}>
            {items.map((item) => (
              <span
                key={item.label}
                style={{
                  ...styles.collapsedDot,
                  backgroundColor: item.color,
                }}
              />
            ))}
          </div>
        </button>
      ) : (
        <div style={styles.container}>
          <div style={styles.headerRow}>
            <div style={styles.title}>마커 안내</div>
            <button
              type="button"
              style={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label="마커 안내 닫기"
              title="닫기"
            >
              ✕
            </button>
          </div>

          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              style={{
                ...styles.rowButton,
                ...(activeCategory === item.key ? styles.rowButtonActive : null),
              }}
              onClick={() => onSelectCategory?.(item.key)}
            >
              <span style={{ ...styles.dot, backgroundColor: item.color }}></span>
              <span style={styles.label}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
  },
  savedOnlyButton: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    border: "1px solid rgba(255, 255, 255, 0.72)",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    color: "rgba(255, 255, 255, 0.92)",
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 18px rgba(0,0,0,0.1)",
    cursor: "pointer",
    padding: 0,
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition:
      "color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, text-shadow 0.2s ease",
  },
  savedOnlyStarOff: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255, 255, 255, 0.94)",
    filter:
      "drop-shadow(0 0 0.75px rgba(0,0,0,0.28)) drop-shadow(0 1px 3px rgba(0,0,0,0.18))",
  },
  savedOnlyStarOn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#EAB308",
    filter: "drop-shadow(0 0 5px rgba(234, 179, 8, 0.55))",
  },
  collapsedButton: {
    width: "28px",
    height: "76px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    backdropFilter: "blur(24px) saturate(165%)",
    WebkitBackdropFilter: "blur(24px) saturate(165%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 6px 18px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.2)",
    cursor: "pointer",
    padding: 0,
  },
  collapsedDots: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.2)",
  },
  container: {
    padding: "10px",
    backgroundColor: "rgba(18, 20, 28, 0.42)",
    backdropFilter: "blur(28px) saturate(170%)",
    WebkitBackdropFilter: "blur(28px) saturate(170%)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "14px",
    color: "#fff",
    fontSize: "11px",
    width: "108px",
    boxShadow:
      "0 10px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.16)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    marginBottom: "6px",
  },
  title: {
    fontWeight: "bold",
    opacity: 0.88,
    textShadow: "0 1px 2px rgba(0,0,0,0.25)",
  },
  closeButton: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    flexShrink: 0,
  },
  rowButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "3px",
    border: "none",
    backgroundColor: "transparent",
    padding: "5px 3px",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
  },
  rowButtonActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  dot: { width: "8px", height: "8px", borderRadius: "50%" },
  label: {
    color: "#f5f5f5",
    textShadow: "0 1px 2px rgba(0,0,0,0.2)",
  },
};