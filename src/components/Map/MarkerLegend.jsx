// components/Map/MarkerLegend.jsx

import { useEffect, useState } from "react";

export default function MarkerLegend({
  savedOnly,
  onToggleSavedOnly,
  onSelectCategory,
  activeCategory,
  closeSignal,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!closeSignal) return;
    setOpen(false);
  }, [closeSignal]);

  const items = [
    { key: "basic", label: "단일 추천", color: "#10b981", icon: "🟢" },
    { key: "hot", label: "공동 추천", color: "#8b5cf6", icon: "🟣" },
    { key: "premium", label: "프리미엄 스팟", color: "#f59e0b", icon: "🟠" },
    { key: "saved", label: "저장한 곳", color: "#fff", icon: "⚪" },
  ];

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={onToggleSavedOnly}
        style={{
          ...styles.savedOnlyButton,
          ...(savedOnly ? styles.savedOnlyButtonActive : null),
        }}
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
        ★
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
              onClick={() => setOpen(false)}
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
    gap: "10px",
  },
  savedOnlyButton: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(2, 2, 2, 0.88)",
    color: "#FFD54F",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.28)",
    cursor: "pointer",
    padding: 0,
    fontSize: "16px",
    fontWeight: 900,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  savedOnlyButtonActive: {
    border: "1px solid rgba(255,213,79,0.65)",
    backgroundColor: "rgba(255,213,79,0.12)",
  },
  collapsedButton: {
    width: "34px",
    height: "96px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(2, 2, 2, 0.88)",
    color: "#fff",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 26px rgba(0,0,0,0.28)",
    cursor: "pointer",
    padding: 0,
  },
  collapsedDots: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
  },
  container: {
    padding: "12px",
    backgroundColor: "rgba(2, 2, 2, 0.938)",
    backdropFilter: "blur(20px)",
    borderRadius: "16px",
    color: "#fff",
    fontSize: "12px",
    width: "120px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
  },
  title: { fontWeight: "bold", opacity: 0.7 },
  closeButton: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    flexShrink: 0,
  },
  rowButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
    border: "none",
    backgroundColor: "transparent",
    padding: "6px 4px",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
  },
  rowButtonActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dot: { width: "10px", height: "10px", borderRadius: "50%" },
  label: { color: "#eee" }
};