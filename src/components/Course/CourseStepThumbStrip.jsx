import { useMemo } from "react";
import { useCourseStepThumbs } from "../../hooks/useCourseStepThumbs";
import { stepThumbKey } from "../../utils/courseStepThumb";
import {
  courseStampStepCellStyle,
  courseStampStepDensity,
  courseStampStepRowStyle,
  } from "../../utils/courseStampStepLayout";
import { MAX_COURSE_STAMP_STEPS } from "../../api/coursePlaceStamps";

const styles = {
  thumbWrap: {
    width: "100%",
    aspectRatio: "1",
    borderRadius: 8,
    overflow: "hidden",
    background:
      "linear-gradient(145deg, rgba(99,102,241,0.12), rgba(148,163,184,0.2))",
    border: "1px solid rgba(15,23,42,0.08)",
    boxSizing: "border-box",
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(91,33,182,0.45)",
    fontWeight: 800,
  },
  label: {
    fontWeight: 800,
    color: "#5b21b6",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    textAlign: "center",
    width: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  name: {
    width: "100%",
    fontWeight: 600,
    color: "rgba(15,23,42,0.55)",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  nameFull: {
    width: "100%",
    fontWeight: 600,
    color: "rgba(15,23,42,0.72)",
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    lineHeight: 1.25,
  },
};

function shorten(s, max = 8) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * 코스 장소별 작은 사진 미리보기 — 개수만큼 가로 폭에 균등 분할
 */
export default function CourseStepThumbStrip({
  steps = [],
  /** 미지정 시 전체 스텝(최대 6) */
  limit,
  enabled = true,
  compact = false,
  /** true — 사진 아래 상호 전체 표시 */
  fullNames = false,
  className,
  style,
}) {
  const slice = useMemo(() => {
    const arr = Array.isArray(steps) ? steps : [];
    const cap =
      limit != null && Number.isFinite(Number(limit))
        ? Math.min(Math.max(1, Math.floor(Number(limit))), MAX_COURSE_STAMP_STEPS)
        : MAX_COURSE_STAMP_STEPS;
    return arr.slice(0, cap);
  }, [steps, limit]);

  const count = slice.length;
  const density = useMemo(() => courseStampStepDensity(count), [count]);
  const thumbByKey = useCourseStepThumbs(slice, { limit: count, enabled });

  if (count === 0) return null;

  const nameMax = compact ? density.nameMaxLen - 1 : density.nameMaxLen;

  return (
    <div
      className={className}
      style={{
        ...courseStampStepRowStyle(count),
        ...(style || {}),
      }}
      aria-label="코스 장소 미리보기"
    >
      {slice.map((step, i) => {
        const key = stepThumbKey(step, i);
        const thumb = thumbByKey[key];
        const label =
          String(step?.label || "").trim() ||
          (Number(step?.order) > 0 ? `${step.order}차` : `${i + 1}차`);
        const rawName = String(step?.name || step?.category || "").trim();
        const name = fullNames
          ? rawName
          : shorten(step?.name || step?.category, nameMax);

        return (
          <div
            key={key}
            style={{
              ...courseStampStepCellStyle(count),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: compact ? 2 : 3,
            }}
          >
            <span
              style={{
                ...styles.label,
                fontSize: density.labelFontSize,
              }}
            >
              {label}
            </span>
            <div style={styles.thumbWrap} aria-hidden={!thumb}>
              {thumb ? (
                <img src={thumb} alt="" style={styles.thumb} loading="lazy" />
              ) : (
                <div
                  style={{
                    ...styles.thumbPlaceholder,
                    fontSize: density.placeholderFontSize,
                  }}
                >
                  {i + 1}
                </div>
              )}
            </div>
            {name ? (
              <span
                style={{
                  ...(fullNames ? styles.nameFull : styles.name),
                  fontSize: density.nameFontSize,
                }}
              >
                {name}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
