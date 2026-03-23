export default function CuratorFilterBar({
  curators = [],
  selectedCurators = [],
  allActive = false,
  onToggle,
  onSelectAll,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}) {
  const safeCurators = Array.isArray(curators) ? curators : [];

  return (
    <div 
      style={styles.wrap}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div style={styles.scrollRow}>
        <button
          type="button"
          onClick={onSelectAll}
          style={{
            ...styles.chip,
            ...(allActive ? styles.chipActive : null),
          }}
        >
          전체
        </button>

        {safeCurators.map((curator) => {
          const active = selectedCurators.includes(curator.name);

          return (
            <button
              key={curator.id || curator.name}
              type="button"
              onClick={() => onToggle?.(curator.name)}
              style={{
                ...styles.chip,
                borderWidth: active ? "2px" : "1px",
                borderStyle: "solid",
                borderColor: active
                  ? curator.color || "#2ECC71"
                  : "rgba(255,255,255,0.08)",
                backgroundColor: active
                  ? curator.color || "#2ECC71"
                  : "rgba(18,18,18,0.88)",
                color: active ? "#111111" : "#ffffff",
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
  wrap: {
    width: "100%",
    overflow: "hidden",
  },

  scrollRow: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "2px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  chip: {
    flexShrink: 0,
    height: "34px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18,18,18,0.88)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 700,
    backdropFilter: "blur(10px)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
    whiteSpace: "nowrap",
  },

  chipActive: {
    backgroundColor: "#ffffff",
    color: "#111111",
    borderColor: "#ffffff",
  },
};