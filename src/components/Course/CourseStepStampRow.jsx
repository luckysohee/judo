/**
 * 바텀시트 썸네일 아래 1·2·3차 도장 줄.
 */
export default function CourseStepStampRow({
  steps = [],
  stampedPlaceIds = null,
  guideStepIndex = 0,
  following = false,
  completed = false,
}) {
  const stamped =
    stampedPlaceIds instanceof Set
      ? stampedPlaceIds
      : new Set(stampedPlaceIds || []);
  const list = Array.isArray(steps) ? steps.slice(0, 3) : [];

  if (list.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "0 12px 6px",
        flexShrink: 0,
      }}
      aria-label="코스 도장"
    >
      {list.map((step, i) => {
        const pid = String(step.place_id || step.place?.id || "").trim();
        const isStamped = pid ? stamped.has(pid) : false;
        const isGuide =
          following && !completed && i === guideStepIndex && !isStamped;
        const label = String(step.label || "").trim() || `${i + 1}차`;

        return (
          <div
            key={pid || `stamp-${i}`}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                boxSizing: "border-box",
                border: isStamped
                  ? "2px solid #5b21b6"
                  : isGuide
                    ? "2px dashed #7c3aed"
                    : "2px solid rgba(15,23,42,0.12)",
                background: isStamped
                  ? "linear-gradient(145deg, #7c3aed, #5b21b6)"
                  : isGuide
                    ? "rgba(124,58,237,0.08)"
                    : "rgba(255,255,255,0.7)",
                color: isStamped ? "#fff" : "rgba(91,33,182,0.45)",
                boxShadow: isStamped
                  ? "0 2px 8px rgba(91,33,182,0.35)"
                  : "none",
              }}
              aria-hidden
            >
              {isStamped ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: isStamped
                  ? "#5b21b6"
                  : isGuide
                    ? "#7c3aed"
                    : "rgba(15,23,42,0.45)",
                lineHeight: 1.2,
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
