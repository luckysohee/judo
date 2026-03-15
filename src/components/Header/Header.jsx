export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.title}>JU-DO</div>
    </header>
  );
}

const styles = {
  header: {
    height: "44px",
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    backgroundColor: "#111111",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "-0.02em",
    lineHeight: 1,
  },
};