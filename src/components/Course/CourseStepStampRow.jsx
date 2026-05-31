import { capCourseStampStepsForUi } from "../../api/coursePlaceStamps";
import useCourseStepMyHanjan from "../../hooks/useCourseStepMyHanjan";
import {
  courseStampStepCellStyle,
  courseStampStepDensity,
  courseStampStepRowStyle,
} from "../../utils/courseStampStepLayout";
import { HOME_COURSE_STAMP_HANJAN_VISITED } from "../../utils/homeCourseStampCopy";

/**
 * 바텀시트 썸네일 아래 코스 장소별 도장 줄.
 */
export default function CourseStepStampRow({
  steps = [],
  stampedPlaceIds = null,
  guideStepIndex = 0,
  following = false,
  completed = false,
  hanjanRefreshKey = 0,
  fetchHanjan = true,
}) {
  const stamped =
    stampedPlaceIds instanceof Set
      ? stampedPlaceIds
      : new Set(stampedPlaceIds || []);
  const list = capCourseStampStepsForUi(steps);
  const count = list.length;
  const density = courseStampStepDensity(count);
  const hanjanPlaceIds = useCourseStepMyHanjan(list, {
    enabled: fetchHanjan,
    refreshKey: hanjanRefreshKey,
  });

  if (count === 0) return null;

  return (
    <div
      style={{
        ...courseStampStepRowStyle(count),
        padding: "0 12px 6px",
        flexShrink: 0,
      }}
      aria-label="코스 도장"
    >
      {list.map((step, i) => {
        const pid = String(step.place_id || step.place?.id || "").trim();
        const isStamped = pid ? stamped.has(pid) : false;
        const hasHanjan =
          Boolean(pid) && hanjanPlaceIds.has(pid) && !isStamped;
        const isGuide =
          following && !completed && i === guideStepIndex && !isStamped;
        const label = String(step.label || "").trim() || `${i + 1}차`;
        const dotSize = density.stampDotSize;
        const labelText =
          hasHanjan && !isGuide && !isStamped
            ? `${label} · ${HOME_COURSE_STAMP_HANJAN_VISITED}`
            : label;

        return (
          <div
            key={pid || `stamp-${i}`}
            style={{
              ...courseStampStepCellStyle(count),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            <div
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: density.stampDotFontSize,
                fontWeight: 800,
                boxSizing: "border-box",
                border: isStamped
                  ? "2px solid #5b21b6"
                  : isGuide
                    ? "2px dashed #7c3aed"
                    : hasHanjan
                      ? "2px solid #d97706"
                      : "2px solid rgba(15,23,42,0.12)",
                background: isStamped
                  ? "linear-gradient(145deg, #7c3aed, #5b21b6)"
                  : isGuide
                    ? "rgba(124,58,237,0.08)"
                    : hasHanjan
                      ? "rgba(251,191,36,0.2)"
                      : "rgba(255,255,255,0.7)",
                color: isStamped
                  ? "#fff"
                  : hasHanjan
                    ? "#b45309"
                    : "rgba(91,33,182,0.45)",
                boxShadow: isStamped
                  ? "0 2px 8px rgba(91,33,182,0.35)"
                  : "none",
              }}
              aria-hidden
            >
              {isStamped ? "✓" : hasHanjan ? "🍶" : i + 1}
            </div>
            <span
              style={{
                width: "100%",
                fontSize: density.labelFontSize,
                fontWeight: 700,
                color: isStamped
                  ? "#5b21b6"
                  : isGuide
                    ? "#7c3aed"
                    : hasHanjan
                      ? "#b45309"
                      : "rgba(15,23,42,0.45)",
                lineHeight: 1.2,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {labelText}
            </span>
          </div>
        );
      })}
    </div>
  );
}
