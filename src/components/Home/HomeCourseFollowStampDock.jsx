import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  capCourseStampStepsForUi,
  fetchCourseStampSteps,
  resolveCourseGuideStepIndex,
  stampCourseStepAtIndex,
  removeCoursePlaceStampAtIndex,
  fetchMyCoursePlaceStamps,
} from "../../api/coursePlaceStamps";
import CourseStampFeedbackModal from "../Course/CourseStampFeedbackModal";
import { useToast } from "../Toast/ToastProvider";
import { dispatchCourseCompletedCelebration } from "../../lib/courseCompletionEvents";
import {
  courseStampStepCellStyle,
  courseStampStepDensity,
  courseStampStepRowStyle,
} from "../../utils/courseStampStepLayout";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";

function dbStepsToStampRow(steps) {
  return capCourseStampStepsForUi(steps).map((row, i) => ({
    place_id: row.place_id,
    label: `${i + 1}차`,
    order: i + 1,
  }));
}

const styles = {
  root: (entered) => ({
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 400,
    boxSizing: "border-box",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    background: T.panelBg,
    borderTop: T.panelBorder,
    boxShadow: "0 -4px 32px rgba(0,0,0,0.42)",
    backdropFilter: "blur(22px) saturate(180%)",
    WebkitBackdropFilter: "blur(22px) saturate(180%)",
    transform: entered ? "translate3d(0,0,0)" : "translate3d(0,100%,0)",
    transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
    pointerEvents: "auto",
  }),
  inner: {
    padding: "10px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  title: {
    flex: "1 1 auto",
    minWidth: 0,
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    color: "#1e1b4b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    letterSpacing: "-0.02em",
  },
  closeBtn: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 999,
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    fontSize: 15,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  dot: (stamped, isGuide) => ({
    textAlign: "center",
    fontWeight: 800,
    padding: "4px 0",
    borderRadius: 8,
    color: stamped ? T.text : isGuide ? T.textSub : T.textFaint,
    background: stamped
      ? T.cardActiveBg
      : isGuide
        ? T.cardBg
        : "transparent",
  }),
  checkBtn: (checked, busy) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.6 : 1,
    border: checked ? T.stampRing : T.cardBorder,
    background: checked ? T.btnPrimaryBg : T.btnGhostBg,
    color: checked ? T.text : T.textSub,
    boxShadow: checked ? "inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
  }),
  checkIcon: (checked) => ({
    width: 20,
    height: 20,
    borderRadius: 6,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 900,
    border: checked ? "none" : T.chipBorder,
    background: checked ? "rgba(255,255,255,0.14)" : T.chipBg,
    color: checked ? T.text : T.textSub,
  }),
  replayBtn: {
    width: "100%",
    border: T.btnGhostBorder,
    background: T.btnGhostBg,
    color: T.textSub,
    borderRadius: 12,
    padding: "10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};

/**
 * 코스 따라가기 — 지도에서 숨긴 뒤 하단 슬림 도크(체크·도장).
 */
export default function HomeCourseFollowStampDock({
  visible = false,
  courseId = "",
  courseTitle = "코스",
  steps: stepsProp = null,
  stampedPlaceIds = null,
  guideStepIndex: guideStepIndexProp = null,
  following = false,
  followBusy = false,
  courseCompleted = false,
  replayBusy = false,
  onReplayStamps,
  user = null,
  onStartFollow,
  onStampStateRefresh,
  onDismiss,
}) {
  const { showToast } = useToast();
  const [entered, setEntered] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [stampBusy, setStampBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [dbSteps, setDbSteps] = useState([]);
  const [localStamps, setLocalStamps] = useState(() => new Set());
  const [localGuide, setLocalGuide] = useState(0);

  const cid = String(courseId || "").trim();

  useEffect(() => {
    setPortalReady(typeof document !== "undefined");
  }, []);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      setFeedback(null);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  useEffect(() => {
    if (stampedPlaceIds == null) return undefined;
    setLocalStamps(
      stampedPlaceIds instanceof Set
        ? new Set(stampedPlaceIds)
        : new Set(stampedPlaceIds || [])
    );
    return undefined;
  }, [stampedPlaceIds]);

  useEffect(() => {
    if (!visible || !cid || Array.isArray(stepsProp)) return undefined;
    let cancelled = false;
    (async () => {
      const rows = await fetchCourseStampSteps(cid);
      if (cancelled) return;
      setDbSteps(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, cid, stepsProp]);

  useEffect(() => {
    if (!visible || !cid) return undefined;
    if (stampedPlaceIds != null) return undefined;
    let cancelled = false;
    (async () => {
      const { stampedPlaceIds: ids } = await fetchMyCoursePlaceStamps(cid);
      if (cancelled) return;
      setLocalStamps(ids);
      const rows = Array.isArray(stepsProp)
        ? stepsProp.map((s, i) => ({ place_id: s.place_id, order_index: i }))
        : await fetchCourseStampSteps(cid);
      if (cancelled) return;
      if (!Array.isArray(stepsProp)) setDbSteps(rows);
      setLocalGuide(resolveCourseGuideStepIndex(rows.length, ids, rows));
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, cid, stampedPlaceIds, guideStepIndexProp, stepsProp]);

  const steps = useMemo(() => {
    if (Array.isArray(stepsProp) && stepsProp.length > 0) {
      return capCourseStampStepsForUi(stepsProp);
    }
    return dbStepsToStampRow(dbSteps);
  }, [stepsProp, dbSteps]);

  const stepCount = steps.length;
  const stepDensity = useMemo(
    () => courseStampStepDensity(stepCount),
    [stepCount]
  );

  const stampedSet = useMemo(() => {
    if (stampedPlaceIds != null) {
      return stampedPlaceIds instanceof Set
        ? stampedPlaceIds
        : new Set(stampedPlaceIds || []);
    }
    return localStamps;
  }, [stampedPlaceIds, localStamps]);

  const guideStepIndex =
    guideStepIndexProp != null ? guideStepIndexProp : localGuide;

  const guideStep = steps[guideStepIndex] ?? null;
  const guideStamped = guideStep?.place_id
    ? stampedSet.has(String(guideStep.place_id).trim())
    : false;
  const guideLabel =
    String(guideStep?.label || "").trim() || `${guideStepIndex + 1}차`;

  const handleGuideCheckToggle = useCallback(async () => {
    if (!cid || stampBusy) return;
    if (!user?.id) {
      showToast("로그인하면 도장을 모을 수 있어요.", "info", 3200);
      return;
    }
    if (courseCompleted) return;

    setStampBusy(true);
    try {
      if (!following && typeof onStartFollow === "function") {
        await onStartFollow();
      }

      if (guideStamped) {
        const r = await removeCoursePlaceStampAtIndex(cid, guideStepIndex);
        if (r?.ok) {
          setFeedback({
            kind: "unstamped",
            label: r.label || guideLabel,
            placeName: r.placeName || "",
          });
          if (typeof onStampStateRefresh === "function") onStampStateRefresh();
          else {
            const { stampedPlaceIds: ids } = await fetchMyCoursePlaceStamps(cid);
            setLocalStamps(ids);
            const rows = await fetchCourseStampSteps(cid);
            setLocalGuide(resolveCourseGuideStepIndex(rows.length, ids, rows));
          }
        } else {
          showToast("도장을 취소하지 못했어요.", "warning", 2800);
        }
        return;
      }

      const r = await stampCourseStepAtIndex(cid, guideStepIndex);
      if (r?.completion) {
        dispatchCourseCompletedCelebration(r.completion);
        if (typeof onStampStateRefresh === "function") onStampStateRefresh();
        else {
          const { stampedPlaceIds: ids } = await fetchMyCoursePlaceStamps(cid);
          setLocalStamps(ids);
          const rows = await fetchCourseStampSteps(cid);
          setLocalGuide(resolveCourseGuideStepIndex(rows.length, ids, rows));
        }
        return;
      }
      if (r?.ok) {
        if (r.kind !== "replay_completed") {
          setFeedback({
            kind: "stamped",
            label: guideLabel,
            placeName: r.placeName || "",
          });
        } else if (r.toastMessage) {
          showToast(r.toastMessage, "success", 3200);
        }
        if (typeof onStampStateRefresh === "function") onStampStateRefresh();
        else {
          const { stampedPlaceIds: ids } = await fetchMyCoursePlaceStamps(cid);
          setLocalStamps(ids);
          const rows = await fetchCourseStampSteps(cid);
          setLocalGuide(resolveCourseGuideStepIndex(rows.length, ids, rows));
        }
      } else {
        showToast("도장을 찍지 못했어요.", "warning", 2800);
      }
    } catch {
      showToast("처리하지 못했어요.", "warning", 2800);
    } finally {
      setStampBusy(false);
    }
  }, [
    cid,
    stampBusy,
    user?.id,
    courseCompleted,
    following,
    onStartFollow,
    guideStamped,
    guideStepIndex,
    guideLabel,
    showToast,
    onStampStateRefresh,
  ]);

  if (!visible || !portalReady || !cid || steps.length === 0) return null;

  const checkLabel = guideStamped
    ? `${guideLabel} 체크됨 (탭하여 취소)`
    : `${guideLabel} 방문 체크`;

  return createPortal(
    <>
      <div style={styles.root(entered)} aria-label="코스 따라가기">
        <div style={styles.inner}>
          <div style={styles.topRow}>
            <p style={styles.title}>{courseTitle}</p>
            {typeof onDismiss === "function" ? (
              <button
                type="button"
                style={styles.closeBtn}
                aria-label="코스 닫기"
                onClick={onDismiss}
              >
                ×
              </button>
            ) : null}
          </div>
          <div style={courseStampStepRowStyle(stepCount)}>
            {steps.map((step, i) => {
              const pid = String(step.place_id || "").trim();
              const isStamped = pid ? stampedSet.has(pid) : false;
              const isGuide =
                !courseCompleted && i === guideStepIndex && !isStamped;
              const label = String(step.label || "").trim() || `${i + 1}차`;
              return (
                <span
                  key={pid || i}
                  style={{
                    ...styles.dot(isStamped, isGuide),
                    ...courseStampStepCellStyle(stepCount),
                    fontSize: stepDensity.labelFontSize,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isStamped ? `✓ ${label}` : label}
                </span>
              );
            })}
          </div>
          {courseCompleted && typeof onReplayStamps === "function" ? (
            <button
              type="button"
              style={styles.replayBtn}
              disabled={replayBusy}
              onClick={onReplayStamps}
            >
              {replayBusy ? "…" : "다시 모으기"}
            </button>
          ) : (
            <button
              type="button"
              style={styles.checkBtn(guideStamped, stampBusy || followBusy)}
              disabled={stampBusy || followBusy || !guideStep}
              onClick={() => void handleGuideCheckToggle()}
              aria-pressed={guideStamped}
            >
              <span style={styles.checkIcon(guideStamped)} aria-hidden>
                {guideStamped ? "✓" : ""}
              </span>
              {stampBusy || followBusy ? "처리 중…" : checkLabel}
            </button>
          )}
        </div>
      </div>
      <CourseStampFeedbackModal
        open={Boolean(feedback)}
        kind={feedback?.kind}
        label={feedback?.label}
        placeName={feedback?.placeName}
        onClose={() => setFeedback(null)}
      />
    </>,
    document.body
  );
}
