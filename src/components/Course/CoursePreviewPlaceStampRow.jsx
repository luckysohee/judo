import { useCallback, useMemo, useRef, useState } from "react";
import {
  removeCoursePlaceStampAtIndex,
  stampCourseStepAtIndex,
} from "../../api/coursePlaceStamps";
import CourseStampFeedbackModal from "./CourseStampFeedbackModal";
import { useToast } from "../Toast/ToastProvider";
import { dispatchCourseCompletedCelebration } from "../../lib/courseCompletionEvents";
import { useCourseStepThumbs } from "../../hooks/useCourseStepThumbs";
import { stepThumbKey } from "../../utils/courseStepThumb";
import useCourseStepMyHanjan from "../../hooks/useCourseStepMyHanjan";
import {
  HOME_COURSE_PHOTO_STAMP_HANJAN_HINT,
  HOME_COURSE_PHOTO_STAMP_HINT,
  HOME_COURSE_STAMP_HANJAN_VISITED,
} from "../../utils/homeCourseStampCopy";
import {
  courseStampStepCellStyle,
  courseStampStepDensity,
  courseStampStepRowStyle,
  isCourseStampStepRowScrollable,
} from "../../utils/courseStampStepLayout";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";

const styles = {
  rowWrap: {
    marginTop: 4,
  },
  thumbRow: {
    padding: 0,
    flex: "0 0 auto",
  },
  thumbCell: (stamped, isGuide, interactive, hasHanjan) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    padding: 4,
    borderRadius: 12,
    border: stamped
      ? T.stampRing
      : isGuide
        ? T.guideRing
        : hasHanjan
          ? "2px solid rgba(217,119,6,0.55)"
          : T.cardBorder,
    background: stamped
      ? "rgba(255,255,255,0.1)"
      : isGuide
        ? "rgba(255,255,255,0.06)"
        : hasHanjan
          ? "rgba(251,191,36,0.12)"
          : T.cardBg,
    boxSizing: "border-box",
    cursor: interactive ? "pointer" : "default",
  }),
  hanjanBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    borderRadius: 999,
    padding: "2px 5px",
    fontSize: 9,
    fontWeight: 800,
    color: "#92400e",
    background: "rgba(255,251,235,0.95)",
    border: "1px solid rgba(217,119,6,0.45)",
    boxShadow: "0 1px 4px rgba(180,83,9,0.2)",
    lineHeight: 1.2,
  },
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
    aspectRatio: "1",
    borderRadius: 10,
    overflow: "hidden",
    background: T.thumbBg,
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
    fontWeight: 800,
    color: T.textFaint,
  },
  photoCheckFilled: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: T.stampBadgeColor,
    background: T.stampBadgeBg,
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
    border: "2px solid rgba(255,255,255,0.9)",
  },
  photoCheckEmpty: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
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
    fontWeight: 800,
    color: "#fff",
    textAlign: "center",
    background: "linear-gradient(to top, rgba(15,23,42,0.72), transparent)",
    letterSpacing: "-0.02em",
  },
  thumbLabel: {
    fontWeight: 800,
    color: T.textSub,
    lineHeight: 1.1,
    textAlign: "center",
    marginTop: 3,
  },
  thumbName: {
    fontWeight: 600,
    color: T.textMuted,
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    lineHeight: 1.25,
    marginTop: 2,
  },
  completedRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexShrink: 0,
  },
  completedMeta: {
    flex: 1,
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    color: T.textMuted,
  },
  replayBtn: {
    flexShrink: 0,
    border: T.btnGhostBorder,
    background: T.btnGhostBg,
    color: T.textSub,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  stampHint: {
    margin: "6px 0 0",
    fontSize: 10,
    fontWeight: 600,
    color: T.textFaint,
    lineHeight: 1.4,
  },
};

/**
 * 코스 미리보기 — 장소 사진·도장(따라가기 켠 뒤 탭)
 */
export default function CoursePreviewPlaceStampRow({
  steps = [],
  courseId = "",
  courseDescription = "",
  stampEnabled = false,
  following = false,
  onStartFollow,
  stampedPlaceIds = null,
  guideStepIndex = 0,
  courseCompleted = false,
  user = null,
  followBusy = false,
  onStampStateRefresh,
  replayBusy = false,
  onReplayStamps,
  stampStateVersion = 0,
}) {
  const { showToast } = useToast();
  const [stampBusy, setStampBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const thumbRowRef = useRef(null);

  const list = useMemo(
    () => (Array.isArray(steps) ? steps.filter(Boolean) : []),
    [steps]
  );
  const stepCount = list.length;
  const stepDensity = useMemo(() => courseStampStepDensity(stepCount), [stepCount]);
  const stampRowScrollable = isCourseStampStepRowScrollable(stepCount);
  const thumbByKey = useCourseStepThumbs(list, {
    limit: stepCount || 3,
    enabled: stepCount > 0,
  });

  const stampedSet = useMemo(
    () =>
      stampedPlaceIds instanceof Set
        ? stampedPlaceIds
        : new Set(stampedPlaceIds || []),
    [stampedPlaceIds]
  );

  const hanjanPlaceIds = useCourseStepMyHanjan(list, {
    enabled: Boolean(user?.id),
    refreshKey: stampStateVersion,
  });

  const showReplayBtn =
    Boolean(user?.id) &&
    courseCompleted &&
    typeof onReplayStamps === "function";

  const handleStepPhotoToggle = useCallback(
    async (stepIndex) => {
      const cid = String(courseId || "").trim();
      const idx = Math.floor(Number(stepIndex));
      if (!cid || stampBusy || followBusy || !stampEnabled) return;
      if (!user?.id) {
        showToast("로그인하면 도장을 모을 수 있어요.", "info", 3200);
        return;
      }
      if (courseCompleted) return;

      const step = list[idx];
      if (!step) return;
      const pid = String(step.place_id || "").trim();
      const isStamped = pid ? stampedSet.has(pid) : false;
      const isGuide = idx === guideStepIndex && !isStamped;
        if (!isStamped && !isGuide) return;

        if (!following && typeof onStartFollow === "function") {
          await onStartFollow();
        }

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
      stampEnabled,
      following,
      onStartFollow,
      user?.id,
      courseCompleted,
      guideStepIndex,
      list,
      stampedSet,
      showToast,
      onStampStateRefresh,
    ]
  );

  if (stepCount === 0) return null;

  const busy = stampBusy || followBusy;

  return (
    <div style={styles.rowWrap} aria-label="코스 장소 도장">
      <div
        ref={thumbRowRef}
        style={{
          ...styles.thumbRow,
          ...courseStampStepRowStyle(stepCount),
        }}
      >
        {list.map((step, i) => {
          const key = stepThumbKey(step, i);
          const thumb = thumbByKey[key];
          const label =
            String(step.label || "").trim() ||
            (Number(step.order) > 0 ? `${step.order}차` : `${i + 1}차`);
          const name = String(step.name || step.category || "").trim();
          const pid = String(step.place_id || "").trim();
          const isStamped = pid ? stampedSet.has(pid) : false;
          const hasHanjan =
            Boolean(pid) && hanjanPlaceIds.has(pid) && !isStamped;
          const isGuide =
            stampEnabled && !courseCompleted && i === guideStepIndex && !isStamped;
          const canTapPhoto =
            stampEnabled && !courseCompleted && (isStamped || isGuide);
          const checkSize = stepDensity.photoCheckSize;
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
                <div
                  style={{
                    ...styles.thumbPlaceholder,
                    fontSize: stepDensity.placeholderFontSize,
                  }}
                >
                  {i + 1}
                </div>
              )}
              {isStamped ? (
                <span
                  style={{
                    ...styles.photoCheckFilled,
                    width: checkSize,
                    height: checkSize,
                    fontSize: stepDensity.photoCheckFontSize,
                  }}
                  aria-hidden
                >
                  ✓
                </span>
              ) : isGuide ? (
                <>
                  <span
                    style={{
                      ...styles.photoCheckEmpty,
                      width: checkSize,
                      height: checkSize,
                    }}
                    aria-hidden
                  />
                    {stepCount <= 4 ? (
                      <span
                        style={{
                          ...styles.photoCheckHint,
                          fontSize: stepCount >= 4 ? 8 : 9,
                        }}
                      >
                        {hasHanjan
                          ? HOME_COURSE_PHOTO_STAMP_HANJAN_HINT
                          : HOME_COURSE_PHOTO_STAMP_HINT}
                      </span>
                    ) : null}
                  </>
                ) : hasHanjan ? (
                  <span style={styles.hanjanBadge} aria-hidden>
                    🍶
                  </span>
                ) : null}
            </>
          );

          return (
            <div
              key={key}
              style={{
                ...styles.thumbCell(isStamped, isGuide, canTapPhoto, hasHanjan),
                ...courseStampStepCellStyle(stepCount),
                gap: stepDensity.cellGap,
                padding: stepDensity.cellPadding,
              }}
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
              <span
                style={{
                  ...styles.thumbLabel,
                  fontSize: stepDensity.labelFontSize,
                  color: isStamped
                    ? T.text
                    : isGuide
                      ? T.textSub
                      : hasHanjan
                        ? "#fbbf24"
                        : T.textMuted,
                }}
              >
                {hasHanjan && !isGuide && !isStamped
                  ? `${label} · ${HOME_COURSE_STAMP_HANJAN_VISITED}`
                  : label}
              </span>
              {name ? (
                <span
                  style={{
                    ...styles.thumbName,
                    fontSize: stepDensity.nameFontSize,
                  }}
                >
                  {name}
                </span>
              ) : null}
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
              onClick={() => void onReplayStamps()}
            >
              {replayBusy ? "…" : "다시 도장 모으기"}
            </button>
          ) : null}
        </div>
      ) : null}
      <CourseStampFeedbackModal
        open={Boolean(feedback)}
        kind={feedback?.kind}
        label={feedback?.label}
        placeName={feedback?.placeName}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
