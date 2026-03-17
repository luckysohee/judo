// components/Map/MarkerLegend.jsx

import { useState } from "react";

export default function MarkerLegend({ onSavedOpen }) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "단일 추천", color: "#10b981", icon: "🟢" },
    { label: "공동 추천", color: "#8b5cf6", icon: "🟣" },
    { label: "프리미엄 스팟", color: "#f59e0b", icon: "🟠" },
    { label: "저장한 곳", color: "#fff", icon: "⚪" },
  ];

  return (
    <div style={styles.wrap}>
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

          {items.map((item, idx) => (
            <div key={idx} style={styles.row}>
              <span style={{ ...styles.dot, backgroundColor: item.color }}></span>
              <span style={styles.label}>{item.label}</span>
            </div>
          ))}
          {/* 마지막에 추가된 내 저장 버튼 */}
          <div
            style={{
              ...styles.row,
              marginTop: "8px",
              borderTop: "1px solid #444",
              paddingTop: "8px",
              cursor: "pointer",
            }}
            onClick={onSavedOpen}
          >
            <span style={styles.label}>⭐ 내 저장</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    pointerEvents: "auto",
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
  row: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
  dot: { width: "10px", height: "10px", borderRadius: "50%" },
  label: { color: "#eee" }
};