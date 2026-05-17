import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  removeCoursePlaceStampAtIndex,
  stampCourseStepAtIndex,
} from "../../api/coursePlaceStamps";
import CourseStampFeedbackModal from "../Course/CourseStampFeedbackModal";
import { useToast } from "../Toast/ToastProvider";
import { dispatchCourseCompletedCelebration } from "../../lib/courseCompletionEvents";
import { useCourseStepThumbs } from "../../hooks/useCourseStepThumbs";
import { sheetStepsFromDrivingMap, stepThumbKey } from "../../utils/courseStepThumb";
import {
  homeHotStripCoursesWrapBottomCss,
  homeHotStripWrapTopCss,
} from "../../utils/homeHotStripLayout";

function shortenName(s, max = 9) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

function stepDescriptionOneLine(step, courseDescription, max = 28) {
  const memo = String(step?.memo || "").trim();
  if (memo) {
    return memo.length <= max ? memo : `${memo.slice(0, max - 1)}…`;
  }
  const cat = String(step?.category || "").trim();
  if (cat) return cat.length <= max ? cat : `${cat.slice(0, max - 1)}…`;
  const desc = String(courseDescription || "").trim();
  if (desc && Number(step?.order) === 1) {
    const line = String(desc.split(/\n|\r/)[0] || "").trim();
    if (!line) return "";
    return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
  }
  return "";
}

const styles = {
  root: (entered) => ({
    position: "fixed",
    left: 0,
    right: 0,
    top: homeHotStripWrapTopCss(),
    bottom: homeHotStripCoursesWrapBottomCss(),
    margin: 0,
    zIndex: 400,
    boxSizing: "border-box",
    height: "auto",
    maxHeight: "none",
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    borderRadius: "20px 20px 0 0",
    background: "rgba(255,255,255,0.97)",
    border: "1px solid rgba(99,102,241,0.18)",
    borderBottom: "none",
    boxShadow:
      "0 -4px 32px rgba(15,23,42,0.14), 0 12px 40px rgba(15,23,42,0.08)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    overflow: "hidden",
    transform: entered ? "translate3d(0, 0, 0)" : "translate3d(0, 100%, 0)",
    transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px 8px",
    flexShrink: 0,
    minWidth: 0,
  },
  headerText: {
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
  },
  kicker: {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(49,46,129,0.62)",
    marginBottom: 2,
  },
  title: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#1e1b4b",
  },
  closeBtn: {
    flexShrink: 0,
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.92)",
    color: "#334155",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  thumbRow: {
    display: "flex",
    gap: 8,
    padding: "0 12px 12px",
    flex: "1 1 auto",
    minHeight: 0,
    alignItems: "stretch",
  },
  thumbCell: (stamped, isGuide, interactive) => ({
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 4,
    padding: 4,
    borderRadius: 12,
    border: stamped
      ? "2px solid #5b21b6"
      : isGuide
        ? "2px dashed rgba(124,58,237,0.55)"
        : "2px solid rgba(15,23,42,0.08)",
    background: stamped
      ? "rgba(91,33,182,0.08)"
      : isGuide
        ? "rgba(124,58,237,0.04)"
        : "rgba(255,255,255,0.65)",
    boxSizing: "border-box",
    cursor: interactive ? "pointer" : "default",
  }),
  photoTapBtn: {
    position: "relative",
    width: "100%",
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    font: "inherit",
    display: "block",
    WebkitTapHighlightColor: "transparent",
  },
  photoTapBtnDisabled: {
    cursor: "not-allowed",
    opacity: 0.65,
  },
  thumbImgWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "4 / 3",
    maxHeight: 88,
    borderRadius: 10,
    overflow: "hidden",
    background:
      "linear-gradient(145deg, rgba(99,102,241,0.1), rgba(148,163,184,0.18))",
  },
  thumbImg: {
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
    fontSize: 18,
    fontWeight: 800,
    color: "rgba(91,33,182,0.35)",
  },
  photoCheckFilled: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 900,
    color: "#fff",
    background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
    boxShadow: "0 4px 16px rgba(91,33,182,0.45)",
    border: "2px solid rgba(255,255,255,0.9)",
  },
  photoCheckEmpty: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 40,
    height: 40,
    borderRadius: 999,
    boxSizing: "border-box",
    border: "3px solid rgba(255,255,255,0.95)",
    background: "rgba(15,23,42,0.28)",
    boxShadow: "0 2px 12px rgba(15,23,42,0.2)",
  },
  photoCheckHint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "4px 6px",
    fontSize: 9,
    fontWeight: 800,
    color: "#fff",
    textAlign: "center",
    background: "linear-gradient(to top, rgba(15,23,42,0.72), transparent)",
    letterSpacing: "-0.02em",
  },
  thumbLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#5b21b6",
    lineHeight: 1.1,
    textAlign: "center",
  },
  thumbName: {
    fontSize: 9,
    fontWeight: 700,
    color: "rgba(15,23,42,0.78)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    textAlign: "center",
  },
  thumbDesc: {
    fontSize: 9,
    fontWeight: 550,
    color: "rgba(15,23,42,0.55)",
    lineHeight: 1.35,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
    minHeight: "1.35em",
  },
  completedRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px 12px",
    flexShrink: 0,
  },
  completedMeta: {
    flex: 1,
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(49,46,129,0.75)",
  },
  replayBtn: {
    flexShrink: 0,
    border: "1px solid rgba(91,33,182,0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#5b21b6",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
};

/**
 * 홈 공개 코스 — 1·2·3차 사진(안내 차수 사진 탭으로 도장/해제) + 모달.
 */
export default function HomeRailCourseBottomSheet({
  visible = false,
  drive = null,
  onDismiss,
  /** true면 × 탭 시 따라가기 유지·지도 빠른가기로 최소화 */
  minimizeOnDismiss = false,
  onOpenDetail,
  courseId = "",
  user = null,
  following = false,
  followBusy = false,
  onStartFollow,
  stampedPlaceIds = null,
  guideStepIndex = 0,
  courseCompleted = false,
  replayBusy = false,
  onReplayStamps,
  onStampStateRefresh,
}) {
  const { showToast } = useToast();
  const [entered, setEntered] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [stampBusy, setStampBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

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

  const steps = useMemo(() => sheetStepsFromDrivingMap(drive).slice(0, 3), [drive]);
  const courseTitle = String(drive?.title || "").trim() || "코스";
  const courseDescription = String(drive?.description || "").trim();
  const thumbByKey = useCourseStepThumbs(steps, {
    limit: steps.length || 3,
    enabled: visible && steps.length > 0,
  });

  const stampedSet = useMemo(
    () =>
      stampedPlaceIds instanceof Set
        ? stampedPlaceIds
        : new Set(stampedPlaceIds || []),
    [stampedPlaceIds]
  );

  const showReplayBtn =
    Boolean(user?.id) &&
    courseCompleted &&
    typeof onReplayStamps === "function";

  const handleStepPhotoToggle = useCallback(
    async (stepIndex) => {
      const cid = String(courseId || "").trim();
      const idx = Math.floor(Number(stepIndex));
      if (!cid || stampBusy || followBusy) return;
      if (!user?.id) {
        showToast("로그인하면 도장을 모을 수 있어요.", "info", 3200);
        return;
      }
      if (courseCompleted) return;

      const step = steps[idx];
      if (!step) return;
      const pid = String(step.place_id || "").trim();
      const isStamped = pid ? stampedSet.has(pid) : false;
      const isGuide = idx === guideStepIndex;
      if (!isStamped && !isGuide) return;

      const stepLabel =
        String(step.label || "").trim() || `${idx + 1}차`;
      const stepPlaceName = String(step.name || "").trim();

      setStampBusy(true);
      try {
        if (isStamped) {
          const r = await removeCoursePlaceStampAtIndex(cid, idx);
          if (r?.ok) {
            setFeedback({
              kind: "unstamped",
              label: r.label || stepLabel,
              placeName: r.placeName || stepPlaceName,
            });
            if (typeof onStampStateRefresh === "function") onStampStateRefresh();
          } else {
            showToast("도장을 취소하지 못했어요.", "warning", 2800);
          }
          return;
        }

        if (!following && typeof onStartFollow === "function") {
          await onStartFollow();
        }

        const r = await stampCourseStepAtIndex(cid, idx);
        if (r?.completion) {
          dispatchCourseCompletedCelebration(r.completion);
          if (typeof onStampStateRefresh === "function") onStampStateRefresh();
          return;
        }
        if (r?.ok) {
          if (r.kind !== "replay_completed") {
            setFeedback({
              kind: "stamped",
              label: r.label || stepLabel,
              placeName: r.placeName || stepPlaceName,
            });
          } else if (r.toastMessage) {
            showToast(r.toastMessage, "success", 3200);
          }
          if (typeof onStampStateRefresh === "function") onStampStateRefresh();
        } else if (r?.reason === "not_signed_in") {
          showToast("로그인하면 도장을 모을 수 있어요.", "info", 3200);
        } else if (r?.reason !== "place_mismatch") {
          showToast("도장을 찍지 못했어요.", "warning", 2800);
        }
      } catch {
        showToast("처리하지 못했어요. 잠시 후 다시 시도해 주세요.", "warning", 2800);
      } finally {
        setStampBusy(false);
      }
    },
    [
      courseId,
      stampBusy,
      followBusy,
      user?.id,
      courseCompleted,
      following,
      onStartFollow,
      guideStepIndex,
      steps,
      stampedSet,
      showToast,
      onStampStateRefresh,
    ]
  );

  if (!visible || steps.length === 0 || !portalReady) return null;

  return createPortal(
  <>
    <div
      style={styles.root(entered)}
      aria-live="polite"
      role="dialog"
      aria-label="지금 보는 코스"
    >
      <div style={styles.header}>
        <button type="button" style={styles.headerText} onClick={onOpenDetail}>
          <span style={styles.kicker}>지금 보는 코스</span>
          <span style={styles.title}>{courseTitle}</span>
        </button>
        <button
          type="button"
          aria-label={
            minimizeOnDismiss
              ? "따라가기 숨기고 빠른가기로 열기"
              : "코스 닫기"
          }
          title={
            minimizeOnDismiss
              ? "따라가기는 유지하고 지도에서만 숨기기"
              : "지도에서 코스 숨기기"
          }
          style={styles.closeBtn}
          onClick={() => onDismiss?.()}
        >
          ×
        </button>
      </div>
      <div style={styles.thumbRow} aria-label="코스 1·2·3차 장소">
        {steps.map((step, i) => {
          const key = stepThumbKey(step, i);
          const thumb = thumbByKey[key];
          const label = String(step.label || "").trim() || `${i + 1}차`;
          const name = shortenName(step.name || step.category, 9);
          const descLine = stepDescriptionOneLine(step, courseDescription, 28);
          const pid = String(step.place_id || "").trim();
          const isStamped = pid ? stampedSet.has(pid) : false;
          const isGuide =
            !courseCompleted && i === guideStepIndex && !isStamped;
          const canTapPhoto =
            !courseCompleted && (isStamped || isGuide);
          const busy = stampBusy || followBusy;
          const photoAria = isStamped
            ? `${label} 도장 취소`
            : isGuide
              ? `${label} 방문 체크`
              : label;

          const photoInner = (
            <>
                {thumb ? (
                  <img src={thumb} alt="" style={styles.thumbImg} loading="lazy" />
                ) : (
                  <div style={styles.thumbPlaceholder}>{i + 1}</div>
                )}
                {isStamped ? (
                  <span style={styles.photoCheckFilled} aria-hidden>
                    ✓
                  </span>
                ) : isGuide ? (
                  <>
                    <span style={styles.photoCheckEmpty} aria-hidden />
                    <span style={styles.photoCheckHint}>탭하여 체크</span>
                  </>
                ) : null}
            </>
          );

          return (
            <div
              key={key}
              style={styles.thumbCell(isStamped, isGuide, canTapPhoto)}
            >
              {canTapPhoto ? (
                <button
                  type="button"
                  style={{
                    ...styles.photoTapBtn,
                    ...(busy ? styles.photoTapBtnDisabled : {}),
                  }}
                  disabled={busy}
                  aria-label={photoAria}
                  aria-pressed={isStamped}
                  onClick={() => void handleStepPhotoToggle(i)}
                >
                  <div style={styles.thumbImgWrap}>{photoInner}</div>
                </button>
              ) : (
                <div style={styles.thumbImgWrap}>{photoInner}</div>
              )}
              <span style={styles.thumbLabel}>{label}</span>
              {name ? <span style={styles.thumbName}>{name}</span> : null}
              {descLine ? (
                <span style={styles.thumbDesc}>{descLine}</span>
              ) : (
                <span style={styles.thumbDesc} aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      {courseCompleted ? (
        <div style={styles.completedRow}>
          <p style={styles.completedMeta}>이 코스를 완주했어요 🎉</p>
          {showReplayBtn ? (
            <button
              type="button"
              style={styles.replayBtn}
              disabled={replayBusy}
              onClick={onReplayStamps}
            >
              {replayBusy ? "…" : "다시 모으기"}
            </button>
          ) : null}
        </div>
      ) : null}
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
