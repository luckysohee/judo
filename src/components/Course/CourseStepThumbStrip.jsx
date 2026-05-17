import { useCourseStepThumbs } from "../../hooks/useCourseStepThumbs";
import { stepThumbKey } from "../../utils/courseStepThumb";

const styles = {
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    minWidth: 0,
  },
  cell: {
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
  },
  thumbWrap: {
    width: "100%",
    maxWidth: 52,
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
    fontSize: 14,
    color: "rgba(91,33,182,0.45)",
    fontWeight: 800,
  },
  label: {
    fontSize: 10,
    fontWeight: 800,
    color: "#5b21b6",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },
  name: {
    width: "100%",
    fontSize: 9,
    fontWeight: 600,
    color: "rgba(15,23,42,0.55)",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
};

function shorten(s, max = 8) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * 1차·2차·3차 라벨 아래 작은 장소 사진 미리보기
 */
export default function CourseStepThumbStrip({
  steps = [],
  limit = 3,
  enabled = true,
  compact = false,
  /** 썸네일 한 변 최대(px). 카드 폭에 맞춰 키울 때 사용 */
  thumbMaxWidth = 52,
  className,
  style,
}) {
  const slice = Array.isArray(steps) ? steps.slice(0, limit) : [];
  const thumbByKey = useCourseStepThumbs(slice, { limit, enabled });

  if (slice.length === 0) return null;

  return (
    <div
      className={className}
      style={{ ...styles.row, ...(style || {}) }}
      aria-label="코스 장소 미리보기"
    >
      {slice.map((step, i) => {
        const key = stepThumbKey(step, i);
        const thumb = thumbByKey[key];
        const label =
          String(step?.label || "").trim() ||
          (Number(step?.order) > 0 ? `${step.order}차` : `${i + 1}차`);
        const name = shorten(step?.name || step?.category, compact ? 6 : 8);

        return (
          <div key={key} style={styles.cell}>
            <span style={styles.label}>{label}</span>
            <div
              style={{ ...styles.thumbWrap, maxWidth: thumbMaxWidth }}
              aria-hidden={!thumb}
            >
              {thumb ? (
                <img src={thumb} alt="" style={styles.thumb} loading="lazy" />
              ) : (
                <div style={styles.thumbPlaceholder}>{i + 1}</div>
              )}
            </div>
            {name ? <span style={styles.name}>{name}</span> : null}
          </div>
        );
      })}
    </div>
  );
}