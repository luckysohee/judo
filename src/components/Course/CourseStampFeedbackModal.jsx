import { createPortal } from "react-dom";

const overlay = {
  position: "fixed",
  inset: 0,
  zIndex: 100001,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  background: "rgba(15,23,42,0.42)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxSizing: "border-box",
};

const card = (stamped) => ({
  width: "100%",
  maxWidth: 320,
  borderRadius: 20,
  padding: "22px 18px 16px",
  textAlign: "center",
  boxSizing: "border-box",
  background: stamped
    ? "linear-gradient(165deg, #f5f3ff 0%, #ede9fe 55%, #fff 100%)"
    : "linear-gradient(165deg, #fff7ed 0%, #fff1f2 55%, #fff 100%)",
  border: stamped
    ? "1px solid rgba(91,33,182,0.28)"
    : "1px solid rgba(251,146,60,0.35)",
  boxShadow: "0 20px 48px rgba(15,23,42,0.18)",
});

/**
 * 코스 차수 도장 찍기 / 취소 직후 안내 모달.
 */
export default function CourseStampFeedbackModal({
  open = false,
  kind = "stamped",
  label = "1차",
  placeName = "",
  onClose,
}) {
  if (!open || typeof document === "undefined") return null;

  const stamped = kind === "stamped";
  const headline = stamped
    ? `${label} 도장을 찍었어요!`
    : `${label} 도장을 취소했어요`;
  const sub = stamped
    ? placeName
      ? `${placeName} 방문을 체크했어요.`
      : "다음 차수도 이어서 모아 보세요."
    : placeName
      ? `${placeName} 체크를 해제했어요.`
      : "언제든 다시 체크할 수 있어요.";

  return createPortal(
    <div
      role="presentation"
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-stamp-feedback-title"
        style={card(stamped)}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="course-stamp-feedback-title"
          style={{
            margin: "0 0 8px",
            fontSize: 28,
            lineHeight: 1,
          }}
          aria-hidden
        >
          {stamped ? "✓" : "↩"}
        </p>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: stamped ? "#5b21b6" : "#9a3412",
          }}
        >
          {headline}
        </h3>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.45,
            color: "rgba(15,23,42,0.62)",
          }}
        >
          {sub}
        </p>
        <button
          type="button"
          onClick={() => onClose?.()}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 12,
            padding: "11px 14px",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            color: "#fff",
            background: stamped
              ? "linear-gradient(135deg, #7c3aed, #5b21b6)"
              : "linear-gradient(135deg, #f97316, #ea580c)",
          }}
        >
          확인
        </button>
      </div>
    </div>,
    document.body
  );
}
