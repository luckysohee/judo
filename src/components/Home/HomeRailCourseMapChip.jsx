import CourseStepThumbStrip from "../Course/CourseStepThumbStrip";

/**
 * 홈 「지금 뜨는 코스」 탭에서 고른 공개 코스가 지도에 떠 있을 때 표시.
 */
export default function HomeRailCourseMapChip({
  visible = false,
  title = "",
  steps = [],
  onDismiss,
  onOpenDetail,
}) {
  if (!visible) return null;

  const label = String(title || "").trim() || "코스";
  const hasSteps = Array.isArray(steps) && steps.length > 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        top: "calc(124px + env(safe-area-inset-top, 0px))",
        zIndex: 87,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
      aria-live="polite"
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "min(420px, 100%)",
          maxWidth: "100%",
          padding: hasSteps ? "10px 12px 12px" : "8px 10px 8px 12px",
          borderRadius: hasSteps ? 18 : 999,
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(99,102,241,0.22)",
          boxShadow: "0 8px 28px rgba(15,23,42,0.14)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={onOpenDetail}
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              margin: 0,
              padding: 0,
              border: "none",
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
              color: "#312e81",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(49,46,129,0.62)",
                marginBottom: 1,
              }}
            >
              지금 보는 코스
            </span>
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </button>
          <button
            type="button"
            aria-label="코스 지도 닫기"
            title="지도에서 코스 숨기기"
            onClick={onDismiss}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.1)",
              background: "rgba(255,255,255,0.9)",
              color: "#334155",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
        {hasSteps ? (
          <CourseStepThumbStrip steps={steps} limit={3} compact enabled />
        ) : null}
      </div>
    </div>
  );
}
