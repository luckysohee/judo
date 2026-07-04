/** HomeSearchOverlay — 주도 다크 글래스 (검색바와 톤 맞춤) */

const glass = {
  blur: "blur(22px) saturate(185%)",
  webkitBlur: "blur(22px) saturate(185%)",
  panelBg: "rgba(14, 14, 14, 0.72)",
  panelBorder: "1px solid rgba(255, 255, 255, 0.1)",
  panelShadow:
    "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
  btnBg: "rgba(255, 255, 255, 0.08)",
  btnBorder: "1px solid rgba(255, 255, 255, 0.14)",
  btnShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 8px rgba(0,0,0,0.2)",
  activeBg: "rgba(17, 17, 17, 0.94)",
  activeBorder: "1px solid rgba(255, 255, 255, 0.18)",
};

const glassPanel = {
  background: glass.panelBg,
  borderBottom: glass.panelBorder,
  backdropFilter: glass.blur,
  WebkitBackdropFilter: glass.webkitBlur,
  boxShadow: glass.panelShadow,
};

const glassButton = {
  background: glass.btnBg,
  border: glass.btnBorder,
  boxShadow: glass.btnShadow,
  backdropFilter: "blur(12px) saturate(160%)",
  WebkitBackdropFilter: "blur(12px) saturate(160%)",
};

export const homeSearchOverlayStyles = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 420,
    display: "flex",
    flexDirection: "column",
    color: "#f5f5f5",
    boxSizing: "border-box",
    paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    background:
      "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(8,8,8,0.78) 42%, rgba(6,6,6,0.88) 100%)",
    backdropFilter: glass.blur,
    WebkitBackdropFilter: glass.webkitBlur,
  },

  mapDim: {
    position: "fixed",
    inset: 0,
    zIndex: 140,
    background: "rgba(0, 0, 0, 0.52)",
    pointerEvents: "none",
    transition: "opacity 0.22s ease",
  },

  header: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px 10px",
    ...glassPanel,
  },

  backBtn: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    color: "rgba(255,255,255,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...glassButton,
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
    background: "rgba(0, 0, 0, 0.35)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },

  input: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "16px",
    color: "#fff",
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
    padding: "10px 12px 0",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    ...glassPanel,
    borderBottom: "none",
  },

  chipHint: {
    flexShrink: 0,
    margin: 0,
    padding: "6px 12px 10px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.42)",
    ...glassPanel,
    borderBottom: glass.panelBorder,
  },

  primarySearchRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "14px 16px",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255, 193, 84, 0.1)",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "rgba(255,255,255,0.94)",
  },

  chip: (active) => ({
    flexShrink: 0,
    padding: "6px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    transition: "background 0.18s ease, border-color 0.18s ease",
    ...(active
      ? {
          background: glass.activeBg,
          border: glass.activeBorder,
          color: "#fff",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.35)",
          backdropFilter: "blur(14px) saturate(170%)",
          WebkitBackdropFilter: "blur(14px) saturate(170%)",
        }
      : {
          ...glassButton,
          color: "rgba(255,255,255,0.78)",
        }),
  }),

  list: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    background: "rgba(8, 8, 8, 0.42)",
    backdropFilter: "blur(18px) saturate(175%)",
    WebkitBackdropFilter: "blur(18px) saturate(175%)",
  },

  empty: {
    padding: "32px 20px",
    textAlign: "center",
    color: "rgba(255,255,255,0.48)",
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
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "rgba(255,255,255,0.92)",
    transition: "background 0.15s ease",
  },

  rowPressed: {
    background: "rgba(255, 255, 255, 0.06)",
  },

  rowIcon: {
    flexShrink: 0,
    width: "28px",
    fontSize: "16px",
    textAlign: "center",
    opacity: 0.85,
  },

  pickBadgeCircle: (color) => ({
    flexShrink: 0,
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: color || "#e74c3c",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    lineHeight: 1,
    boxShadow: "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.15)",
  }),

  pinBadgeCircle: {
    flexShrink: 0,
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "rgba(255,255,255,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    lineHeight: 1,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },

  rowMain: {
    flex: 1,
    minWidth: 0,
    fontSize: "15px",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.94)",
  },

  rowDate: {
    flexShrink: 0,
    fontSize: "12px",
    color: "rgba(255,255,255,0.42)",
    marginRight: "4px",
  },

  deleteBtn: {
    flexShrink: 0,
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
    color: "rgba(255,255,255,0.45)",
    ...glassButton,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  suggestSectionLabel: {
    padding: "12px 16px 6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: "-0.02em",
  },

  footerHint: {
    flexShrink: 0,
    padding: "8px 16px 12px",
    fontSize: "11px",
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    background: "rgba(10, 10, 10, 0.55)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  },
};
