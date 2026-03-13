export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.logoRow}>
        <div style={styles.logo}>JU-DO</div>
        <div style={styles.logoBadge}>🍶</div>
      </div>
      <div style={styles.subtitle}>술꾼들의 별표 지도</div>
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backgroundColor: "#111111",
    padding: "20px 16px 12px",
    borderBottom: "1px solid #222",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  logo: {
    fontSize: "28px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    color: "#ffffff",
  },
  logoBadge: {
    fontSize: "22px",
  },
  subtitle: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#bdbdbd",
  },
};