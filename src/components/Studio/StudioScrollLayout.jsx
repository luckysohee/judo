import { useVisualViewportFrame } from "../../hooks/useLayoutViewportHeight";

/**
 * body/#root overflow:hidden 환경에서 스튜디오 전 페이지 공통 스크롤 셸
 * (className 없이 인라인만 — 빌드·Tailwind와 무관하게 동작)
 *
 * 모바일 visualViewport 높이에 맞춰 셸을 잡아서
 * 하단 확인/저장 버튼이 주소창·홈 인디케이터 아래로 밀리지 않게 함.
 */
export default function StudioScrollLayout({
  header = null,
  footer = null,
  children,
  shellStyle = {},
  mainStyle = {},
}) {
  const { topPx, heightPx } = useVisualViewportFrame();
  const {
    inset: _omitInset,
    top: _omitTop,
    bottom: _omitBottom,
    height: _omitHeight,
    maxHeight: _omitMaxHeight,
    ...safeShellStyle
  } = shellStyle && typeof shellStyle === "object" ? shellStyle : {};

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
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
        ...safeShellStyle,
        top: topPx,
        height: heightPx,
        maxHeight: heightPx,
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
        <div
          style={{
            flexShrink: 0,
            minWidth: 0,
            width: "100%",
            zIndex: 2,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
