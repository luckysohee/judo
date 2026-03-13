export default function CuratorFilterBar({
  curators,
  selectedCurators,
  onToggle,
  onSelectAll,
}) {
  const safeCurators = Array.isArray(curators) ? curators.filter(Boolean) : [];

  return (
    <div style={styles.overlayWrap}>
      <div style={styles.scrollRow}>
        <button
          type="button"
          onClick={onSelectAll}
          style={styles.allButton}
        >
          전체
        </button>

        {safeCurators.map((curator) => {
          const active = selectedCurators.includes(curator.name);

          return (
            <button
              key={curator.id || curator.name}
              type="button"
              onClick={() => onToggle(curator.name)}
              style={{
                ...styles.chip,
                borderColor: curator.color || "#444444",
                backgroundColor: active
                  ? curator.color || "#2ECC71"
                  : "rgba(20,20,20,0.88)",
                color: "#ffffff",
              }}
            >
              {curator.displayName || curator.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  overlayWrap: {
    width: "100%",
    pointerEvents: "auto",
  },
  scrollRow: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "2px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  allButton: {
    flexShrink: 0,
    whiteSpace: "nowrap",
    border: "1px solid rgba(255,255,255,0.18)",
    backgroundColor: "rgba(20,20,20,0.9)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    backdropFilter: "blur(8px)",
  },
  chip: {
    flexShrink: 0,
    whiteSpace: "nowrap",
    border: "1px solid #333333",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    backdropFilter: "blur(8px)",
  },
};