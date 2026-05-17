/**
 * 홈 지도 우측 — 내 위치 버튼 아래 코스 따라가기 빠른가기.
 */
export default function HomeCourseFollowQuickButton({
  visible = false,
  active = false,
  onClick,
  title = "코스 따라가기",
}) {
  if (!visible || typeof onClick !== "function") return null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        pointerEvents: "auto",
        width: "28px",
        height: "28px",
        borderRadius: "9px",
        border: active
          ? "1px solid rgba(196,181,253,0.65)"
          : "1px solid rgba(255,255,255,0.22)",
        background: active
          ? "rgba(91,33,182,0.42)"
          : "rgba(22, 24, 28, 0.22)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: active
          ? "inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 16px rgba(91,33,182,0.28)"
          : "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.14)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "#f5f3ff" : "rgba(255,255,255,0.92)",
        flexShrink: 0,
        transition:
          "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      title={title}
      aria-label={title}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="6" cy="6" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="8" cy="18" r="2.5" fill="currentColor" stroke="none" />
        <path d="M8.2 7.4 15.8 10.6" />
        <path d="M9.4 16.4 16.2 13.6" />
      </svg>
    </button>
  );
}
