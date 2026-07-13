import {
  buildCourseStepSchedule,
  courseBookingAction,
  courseBookingBadge,
  parseClockToMinutes,
} from "../../utils/courseTimeAssurance";
import { formatCourseStayMinutes } from "../../utils/formatCourseUi";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";

const styles = {
  wrap: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  title: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: T.textSub || "rgba(255,255,255,0.65)",
    letterSpacing: "-0.02em",
    flexShrink: 0,
  },
  startLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    padding: "2px 4px 2px 8px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontWeight: 700,
    flexShrink: 0,
    cursor: "pointer",
    letterSpacing: "-0.02em",
  },
  startInput: {
    minWidth: 96,
    maxWidth: "100%",
    padding: "2px 4px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: 700,
    boxSizing: "border-box",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none",
    appearance: "none",
    colorScheme: "dark",
  },
  startHint: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "-0.02em",
    paddingRight: 4,
  },
  card: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
  },
  time: {
    fontSize: 13,
    fontWeight: 800,
    color: "#FFE066",
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f5f5f5",
    letterSpacing: "-0.02em",
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.4,
  },
  badge: {
    display: "inline-block",
    marginTop: 6,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: "-0.02em",
  },
  bookBtn: {
    marginTop: 8,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255, 224, 102, 0.35)",
    background: "rgba(255, 224, 102, 0.12)",
    color: "#FFE066",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
};

/**
 * 코스 스텝 시간표 + 예약 배지/외부 링크
 * @param {{
 *   steps: Array<object>,
 *   startClock?: string,
 *   onStartClockChange?: (v: string) => void,
 *   showStartControl?: boolean,
 * }} props
 */
export default function CourseStepScheduleList({
  steps = [],
  startClock = "18:00",
  onStartClockChange,
  showStartControl = true,
}) {
  const list = Array.isArray(steps) ? steps : [];
  if (list.length === 0) return null;

  const schedule = buildCourseStepSchedule(
    list.map((s) => ({
      stay_minutes: s.stay_minutes ?? s.stayMinutes,
      walk_to_next_minutes: s.walk_to_next_minutes,
    })),
    { startMinutes: parseClockToMinutes(startClock) }
  );

  return (
    <div style={styles.wrap} aria-label="코스 예상 시간표">
      <div style={styles.headerRow}>
        <p style={styles.title}>예상 시간표</p>
        {showStartControl ? (
          <label style={styles.startLabel} title="출발 시간 바꾸기">
            출발
            <input
              type="time"
              value={startClock}
              onChange={(e) => onStartClockChange?.(e.target.value || "18:00")}
              style={styles.startInput}
              aria-label="출발 시간 변경"
            />
            <span style={styles.startHint}>변경</span>
          </label>
        ) : null}
      </div>
      {list.map((step, i) => {
        const slot = schedule[i];
        const name =
          step.name ||
          step.place_name ||
          step.place?.name ||
          `${i + 1}차`;
        const stayLabel = formatCourseStayMinutes(
          step.stay_minutes ?? step.stayMinutes ?? slot?.stayMin
        );
        const badge = courseBookingBadge(
          step.booking_status,
          step.crowd_note
        );
        const action = courseBookingAction(
          step.booking_url,
          step.booking_phone
        );
        return (
          <div key={step.key || step.id || `sched-${i}`} style={styles.card}>
            <div style={styles.time}>{slot?.arriveLabel || "--:--"}</div>
            <div style={styles.name}>{name}</div>
            <div style={styles.meta}>
              {[stayLabel ? `체류 ${stayLabel}` : null, step.orderLabel]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {badge ? <div style={styles.badge}>{badge.label}</div> : null}
            {action ? (
              <a
                href={action.href}
                target={action.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  action.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                style={{ ...styles.bookBtn, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
              >
                {action.label}
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
