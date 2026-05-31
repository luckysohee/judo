import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import useCourseStepMyHanjan from "../../hooks/useCourseStepMyHanjan";
import {
  HOME_COURSE_PHOTO_STAMP_HANJAN_HINT,
  HOME_COURSE_PHOTO_STAMP_HINT,
  HOME_COURSE_SHEET_BACK_BTN,
  HOME_COURSE_SHEET_HIDE_BTN,
  HOME_COURSE_SHEET_STAMP_KICKER,
} from "../../utils/homeCourseStampCopy";
import {
  courseStampStepCellStyle,
  courseStampStepDensity,
  courseStampStepRowStyle,
  isCourseStampStepRowScrollable,
} from "../../utils/courseStampStepLayout";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";

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
    background: T.panelBg,
    border: T.panelBorder,
    borderBottom: "none",
    boxShadow: "0 -4px 32px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    overflow: "hidden",
    transform: entered ? "translate3d(0, 0, 0)" : "translate3d(0, 100%, 0)",
    transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
  }),
  /** `HomeCoursesDiscoveryPanel` 안에 넣을 때 — 고정·포털 없음 */
  rootEmbedded: {
    display: "flex",
    flexDirection: "column",
    flex: "0 0 auto",
    height: "auto",
    minHeight: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    borderRadius: "14px 14px 0 0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px 8px",
    flexShrink: 0,
    minWidth: 0,
  },
  headerEmbedded: {
    padding: "8px 12px 4px",
    gap: 6,
  },
  backBtn: {
    flexShrink: 0,
    border: T.chipBorder,
    background: T.chipBg,
    color: T.textSub,
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  backBtnEmbedded: {
    padding: "4px 8px",
    fontSize: 11,
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
    color: T.text,
  },
  kicker: {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    color: T.textMuted,
    marginBottom: 2,
  },
  stampKicker: {
    margin: 0,
    padding: "0 12px 8px",
    fontSize: 11,
    fontWeight: 650,
    lineHeight: 1.4,
    color: T.textSub,
    letterSpacing: "-0.02em",
  },
  stampKickerEmbedded: {
    padding: "0 12px 4px",
    fontSize: 10,
    lineHeight: 1.35,
  },
  title: {
    display: "block",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: T.text,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  hideSheetBtn: {
    flexShrink: 0,
    border: T.btnGhostBorder,
    background: T.btnGhostBg,
    color: T.textSub,
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    cursor: "pointer",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  hideSheetBtnEmbedded: {
    padding: "5px 9px",
    fontSize: 10,
  },
  thumbRow: {
    padding: "0 12px 12px",
    flex: "0 0 auto",
  },
  thumbRowEmbedded: {
    padding: "0 10px 8px",
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
      ? T.cardActiveBg
      : isGuide
        ? T.cardBg
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
    aspectRatio: "4 / 3",
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
    fontSize: 18,
    fontWeight: 800,
    color: T.textFaint,
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
    color: T.textSub,
    lineHeight: 1.1,
    textAlign: "center",
  },
  thumbName: {
    fontSize: 9,
    fontWeight: 700,
    color: T.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    textAlign: "center",
  },
  thumbDesc: {
    fontSize: 9,
    fontWeight: 550,
    color: T.textFaint,
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
  completedRowEmbedded: {
    padding: "0 10px 8px",
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
};

/**
 * 홈 공개 코스 — 코스 전 장소 사진(안내 차수 탭으로 도장/해제) + 모달.
 */
export default function HomeRailCourseBottomSheet({
  visible = false,
  /** 발견 패널 안 도장 UI — 별도 풀시트 포털 없음 */
  embedded = false,
  drive = null,
  /** 코스 목록(레일)로 — 지도·따라가기 유지 */
  onBack,
  /** 따라가기 중 시트만 접기 — 지도·세션 유지 */
  onHideSheet,
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
    if (embedded) {
      setEntered(true);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible, embedded]);

  const steps = useMemo(() => sheetStepsFromDrivingMap(drive), [drive]);
  const stepCount = steps.length;
  const stampRowScrollable = isCourseStampStepRowScrollable(stepCount);
  const thumbRowRef = useRef(null);
  const stepDensity = useMemo(
    () => courseStampStepDensity(stepCount),
    [stepCount]
  );
  const showStepDesc = stepCount <= 3;

  useEffect(() => {
    if (!stampRowScrollable || !visible) return undefined;
    const row = thumbRowRef.current;
    if (!row) return undefined;
    const el = row.children[guideStepIndex];
    if (!el || typeof el.scrollIntoView !== "function") return undefined;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [guideStepIndex, stampRowScrollable, visible, stepCount]);
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

  const hanjanPlaceIds = useCourseStepMyHanjan(steps, {
    enabled: Boolean(user?.id) && visible,
    refreshKey: `${courseId}:${visible}`,
  });

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

  if (!visible || steps.length === 0 || (!embedded && !portalReady)) return null;

  const sheet = (
    <>
    <div
      style={embedded ? styles.rootEmbedded : styles.root(entered)}
      aria-live="polite"
      role={embedded ? undefined : "dialog"}
      aria-label="지금 보는 코스"
    >
      <div
        style={{
          ...styles.header,
          ...(embedded ? styles.headerEmbedded : null),
        }}
      >
        {typeof onBack === "function" ? (
          <button
            type="button"
            style={{
              ...styles.backBtn,
              ...(embedded ? styles.backBtnEmbedded : null),
            }}
            aria-label="코스 목록으로"
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
          >
            {HOME_COURSE_SHEET_BACK_BTN}
          </button>
        ) : null}
        <button type="button" style={styles.headerText} onClick={onOpenDetail}>
          <span style={styles.kicker}>지금 보는 코스</span>
          <span style={styles.title}>{courseTitle}</span>
        </button>
        <div style={styles.headerActions}>
          {typeof onHideSheet === "function" ? (
            <button
              type="button"
              aria-label={HOME_COURSE_SHEET_HIDE_BTN}
              title="도장 시트만 접기 — 따라가기·지도 코스는 유지"
              style={{
                ...styles.hideSheetBtn,
                ...(embedded ? styles.hideSheetBtnEmbedded : null),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onHideSheet();
              }}
            >
              {HOME_COURSE_SHEET_HIDE_BTN}
            </button>
          ) : null}
        </div>
      </div>
      {!courseCompleted ? (
        <p
          style={{
            ...styles.stampKicker,
            ...(embedded ? styles.stampKickerEmbedded : null),
          }}
        >
          {HOME_COURSE_SHEET_STAMP_KICKER}
        </p>
      ) : null}
      <div
        ref={thumbRowRef}
        style={{
          ...styles.thumbRow,
          ...(embedded ? styles.thumbRowEmbedded : null),
          ...courseStampStepRowStyle(stepCount),
        }}
        aria-label="코스 장소별 도장"
      >
        {steps.map((step, i) => {
          const key = stepThumbKey(step, i);
          const thumb = thumbByKey[key];
          const label = String(step.label || "").trim() || `${i + 1}차`;
          const name = shortenName(
            step.name || step.category,
            stepDensity.nameMaxLen
          );
          const descLine = stepDescriptionOneLine(
            step,
            courseDescription,
            stepDensity.descMaxLen
          );
          const checkSize = stepDensity.photoCheckSize;
          const pid = String(step.place_id || "").trim();
          const isStamped = pid ? stampedSet.has(pid) : false;
          const hasHanjan =
            Boolean(pid) && hanjanPlaceIds.has(pid) && !isStamped;
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
                  <div
                    style={{
                      ...styles.thumbImgWrap,
                      maxHeight: stepDensity.thumbMaxHeight,
                    }}
                  >
                    {photoInner}
                  </div>
                </button>
              ) : (
                <div
                  style={{
                    ...styles.thumbImgWrap,
                    maxHeight: stepDensity.thumbMaxHeight,
                  }}
                >
                  {photoInner}
                </div>
              )}
              <span
                style={{
                  ...styles.thumbLabel,
                  fontSize: stepDensity.labelFontSize,
                }}
              >
                {label}
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
              {showStepDesc && descLine ? (
                <span
                  style={{
                    ...styles.thumbDesc,
                    fontSize: stepDensity.descFontSize,
                  }}
                >
                  {descLine}
                </span>
              ) : showStepDesc ? (
                <span
                  style={{
                    ...styles.thumbDesc,
                    fontSize: stepDensity.descFontSize,
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {courseCompleted ? (
        <div
          style={{
            ...styles.completedRow,
            ...(embedded ? styles.completedRowEmbedded : null),
          }}
        >
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
  </>
  );

  if (embedded) return sheet;
  return createPortal(sheet, document.body);
}
