export default function MarkerLegend() {
  return (
    <div style={styles.wrap}>
      <div style={styles.title}>마커 안내</div>

      <div style={styles.row}>
        <span style={{ ...styles.markerDot, backgroundColor: "#2ECC71" }}>
          🍶
        </span>
        <span style={styles.label}>단일 추천</span>
      </div>

      <div style={styles.row}>
        <span style={{ ...styles.markerDot, backgroundColor: "#8B5CF6" }}>
          ✨
        </span>
        <span style={styles.label}>공통 추천</span>
      </div>

      <div style={styles.row}>
        <span style={{ ...styles.markerDot, backgroundColor: "#F5C451" }}>
          👑
        </span>
        <span style={styles.label}>프리미엄 스팟</span>
      </div>

      <div style={styles.row}>
        <span style={styles.savedDot} />
        <span style={styles.label}>저장한 곳</span>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    width: "fit-content",
    minWidth: "132px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(17,17,17,0.92)",
    borderRadius: "14px",
    padding: "10px 11px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
  },
  title: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: "8px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
  },
  markerDot: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px solid rgba(255,255,255,0.9)",
    fontSize: "11px",
    flexShrink: 0,
  },
  savedDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    backgroundColor: "#FFD54F",
    border: "2px solid #ffffff",
    marginLeft: "7px",
    marginRight: "7px",
    flexShrink: 0,
    boxSizing: "content-box",
  },
  label: {
    fontSize: "11px",
    color: "#ededed",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
  },
};