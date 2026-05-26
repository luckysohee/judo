/** HomeSearchOverlay 전용 — homeStyles와 분리해 검색 모드만 조정 */

export const homeSearchOverlayStyles = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 420,
    display: "flex",
    flexDirection: "column",
    background: "#f5f6f8",
    color: "#111",
    boxSizing: "border-box",
    paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },

  mapDim: {
    position: "fixed",
    inset: 0,
    zIndex: 140,
    background: "rgba(0, 0, 0, 0.45)",
    pointerEvents: "none",
    transition: "opacity 0.22s ease",
  },

  header: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px 10px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "#fff",
  },

  backBtn: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    border: "none",
    borderRadius: "12px",
    background: "transparent",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    color: "#222",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  inputWrap: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px",
    height: "44px",
    borderRadius: "12px",
    background: "#f0f1f4",
    border: "1px solid rgba(0,0,0,0.06)",
  },

  input: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "16px",
    color: "#111",
  },

  headerRight: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },

  chipRow: {
    flexShrink: 0,
    display: "flex",
    gap: "8px",
    padding: "10px 12px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    background: "#fff",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
  },

  chip: (active) => ({
    flexShrink: 0,
    padding: "6px 14px",
    borderRadius: "999px",
    border: active ? "none" : "1px solid rgba(0,0,0,0.1)",
    background: active ? "#03c75a" : "#fff",
    color: active ? "#fff" : "#444",
    fontSize: "13px",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
  }),

  list: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    background: "#fff",
  },

  empty: {
    padding: "32px 20px",
    textAlign: "center",
    color: "#888",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  row: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "14px 12px 14px 16px",
    border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
  },

  rowIcon: {
    flexShrink: 0,
    width: "28px",
    fontSize: "16px",
    textAlign: "center",
    opacity: 0.85,
  },

  rowMain: {
    flex: 1,
    minWidth: 0,
    fontSize: "15px",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  rowDate: {
    flexShrink: 0,
    fontSize: "12px",
    color: "#999",
    marginRight: "4px",
  },

  deleteBtn: {
    flexShrink: 0,
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "#bbb",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
  },

  suggestSectionLabel: {
    padding: "12px 16px 6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#888",
    letterSpacing: "-0.02em",
  },

  footerHint: {
    flexShrink: 0,
    padding: "8px 16px 12px",
    fontSize: "11px",
    color: "#aaa",
    textAlign: "center",
    background: "#f5f6f8",
  },
};
