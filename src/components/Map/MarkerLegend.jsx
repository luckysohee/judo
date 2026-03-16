// components/Map/MarkerLegend.jsx

export default function MarkerLegend({ onSavedOpen }) {
  const items = [
    { label: "단일 추천", color: "#10b981", icon: "🟢" },
    { label: "공동 추천", color: "#8b5cf6", icon: "🟣" },
    { label: "프리미엄 스팟", color: "#f59e0b", icon: "🟠" },
    { label: "저장한 곳", color: "#fff", icon: "⚪" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.title}>마커 안내</div>
      {items.map((item, idx) => (
        <div key={idx} style={styles.row}>
          <span style={{ ...styles.dot, backgroundColor: item.color }}></span>
          <span style={styles.label}>{item.label}</span>
        </div>
      ))}
      {/* 마지막에 추가된 내 저장 버튼 */}
      <div 
        style={{ ...styles.row, marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px', cursor: 'pointer' }}
        onClick={onSavedOpen}
      >
        <span style={styles.label}>⭐ 내 저장</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "12px",
    backgroundColor: "rgba(2, 2, 2, 0.938)",
    backdropFilter: "blur(20px)",
    borderRadius: "16px",
    color: "#fff",
    fontSize: "12px",
    width: "120px",
  },
  title: { fontWeight: "bold", marginBottom: "8px", opacity: 0.7 },
  row: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
  dot: { width: "10px", height: "10px", borderRadius: "50%" },
  label: { color: "#eee" }
};