/**
 * body/#root overflow:hidden 환경에서 스튜디오 전 페이지 공통 스크롤 셸
 * (className 없이 인라인만 — 빌드·Tailwind와 무관하게 동작)
 */
export default function StudioScrollLayout({
  header = null,
  footer = null,
  children,
  shellStyle = {},
  mainStyle = {},
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        backgroundColor: "#111111",
        color: "#ffffff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        ...shellStyle,
      }}
    >
      {header ? (
        <div style={{ flexShrink: 0, minWidth: 0 }}>{header}</div>
      ) : null}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          touchAction: "pan-y",
          boxSizing: "border-box",
          ...mainStyle,
        }}
      >
        {children}
      </main>
      {footer ? (
        <div style={{ flexShrink: 0, minWidth: 0 }}>{footer}</div>
      ) : null}
    </div>
  );
}
