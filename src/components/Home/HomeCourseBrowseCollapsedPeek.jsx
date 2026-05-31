import { useMemo } from "react";
import useCourseStepMyHanjan from "../../hooks/useCourseStepMyHanjan";
import {
  isResolvableCourseStepThumbUrl,
  pickStepUploadedThumb,
} from "../../utils/courseStepThumb";
import { HOME_COURSE_SHEET as T } from "../../utils/homeCourseSheetTheme";

const styles = {
  root: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    margin: "0 2px 4px",
    minWidth: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    padding: "0 2px",
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: T.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: "1 1 auto",
    minWidth: 0,
  },
  hint: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 650,
    color: T.textFaint,
    whiteSpace: "nowrap",
  },
  scroll: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    overflowX: "auto",
    overflowY: "hidden",
    padding: "0 2px 2px",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  stepBtn: {
    flex: "0 0 auto",
    width: 72,
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    textAlign: "center",
    WebkitTapHighlightColor: "transparent",
  },
  photoWrap: (stamped, isGuide, hasHanjan) => ({
    position: "relative",
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    border: stamped
      ? T.stampRing
      : isGuide
        ? T.guideRing
        : hasHanjan
          ? "2px solid rgba(217,119,6,0.55)"
          : T.cardBorder,
    boxSizing: "border-box",
    background: hasHanjan
      ? "linear-gradient(145deg, rgba(251,191,36,0.18), rgba(255,255,255,0.04))"
      : T.thumbBg,
  }),
  hanjanBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "rgba(255,251,235,0.95)",
    color: "#b45309",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(217,119,6,0.4)",
    lineHeight: 1,
  },
  photo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  label: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: 750,
    color: T.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  stampBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: T.stampBadgeBg,
    color: T.stampBadgeColor,
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
    lineHeight: 1,
  },
  coverFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    opacity: 0.35,
  },
  coverHeroBtn: {
    flex: "0 0 auto",
    width: "100%",
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    font: "inherit",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
  },
  coverHeroWrap: {
    position: "relative",
    width: "100%",
    height: 88,
    borderRadius: 10,
    overflow: "hidden",
    border: T.cardBorder,
    boxSizing: "border-box",
    background: T.thumbBg,
  },
  coverHeroLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: 750,
    color: T.textMuted,
    paddingLeft: 2,
  },
};

function buildPeekSteps(course) {
  const thumbSteps = Array.isArray(course?.thumb_steps)
    ? course.thumb_steps
    : [];
  if (thumbSteps.length > 0) {
    return thumbSteps.map((s, i) => ({
      key: String(s.place_id || `step-${i}`),
      label: String(s.label || `${i + 1}차`).trim() || `${i + 1}차`,
      name: String(s.name || "").trim(),
      imageUrl: pickStepUploadedThumb(s),
      placeId: String(s.place_id || "").trim(),
    }));
  }
  const places = Array.isArray(course?.places) ? course.places : [];
  return places.map((p, i) => ({
    key: String(p.place_id || `place-${i}`),
    label: String(p.step_label || `${i + 1}차`).trim() || `${i + 1}차`,
    name: String(p.name || "").trim(),
    imageUrl: isResolvableCourseStepThumbUrl(p.image_url) ? p.image_url : null,
    placeId: String(p.place_id || "").trim(),
  }));
}

/**
 * 코스 미리보기 시트 — 중간(접힘) 단계: 장소 사진 스트립.
 */
export default function HomeCourseBrowseCollapsedPeek({
  course,
  followCourseId = "",
  stampedPlaceIds = null,
  guideStepIndex = 0,
  following = false,
  onExpand,
  user = null,
  stampStateVersion = 0,
}) {
  const title = String(course?.title || "").trim() || "코스";
  const cover = String(course?.cover_image_url || "").trim();
  const steps = useMemo(() => buildPeekSteps(course), [course]);
  const hanjanLookupSteps = useMemo(
    () =>
      steps.map((s) => ({
        place_id: s.placeId,
      })),
    [steps]
  );
  const hanjanPlaceIds = useCourseStepMyHanjan(hanjanLookupSteps, {
    enabled: Boolean(user?.id),
    refreshKey: stampStateVersion,
  });

  const stampedSet = useMemo(() => {
    if (!stampedPlaceIds) return new Set();
    if (stampedPlaceIds instanceof Set) return stampedPlaceIds;
    return new Set(
      [...stampedPlaceIds].map((id) => String(id || "").trim()).filter(Boolean)
    );
  }, [stampedPlaceIds]);

  const followingThis =
    following &&
    followCourseId &&
    String(followCourseId) === String(course?.courseId || "").trim();

  const hint = followingThis
    ? "도장 중 · 위로 밀어 펼치기"
    : "위로 밀어 펼치기";

  if (cover) {
    return (
      <div style={styles.root} aria-label={`${title} 커버 미리보기`}>
        <div style={styles.titleRow}>
          <h3 style={styles.title}>{title}</h3>
          <span style={styles.hint}>{hint}</span>
        </div>
        <button
          type="button"
          data-sheet-no-drag
          style={styles.coverHeroBtn}
          onClick={() => onExpand?.()}
          aria-label={`${title} 커버 — 펼치기`}
        >
          <div style={styles.coverHeroWrap}>
            <img src={cover} alt="" style={styles.photo} loading="lazy" />
          </div>
          <div style={styles.coverHeroLabel}>커버</div>
        </button>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div style={styles.root}>
        <div style={styles.titleRow}>
          <h3 style={styles.title}>{title}</h3>
          <span style={styles.hint}>{hint}</span>
        </div>
        <p
          style={{
            margin: 0,
            padding: "4px 2px 6px",
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(100,116,139,0.88)",
          }}
        >
          사진이 없어요 · 위로 밀어 펼치기
        </p>
      </div>
    );
  }

  return (
    <div style={styles.root} aria-label={`${title} 장소 미리보기`}>
      <div style={styles.titleRow}>
        <h3 style={styles.title}>{title}</h3>
        <span style={styles.hint}>{hint}</span>
      </div>
      <div style={styles.scroll} role="list">
        {steps.map((step, i) => {
          const stamped = followingThis && stampedSet.has(step.placeId);
          const isGuide =
            followingThis &&
            !stamped &&
            i === Math.max(0, Math.floor(Number(guideStepIndex) || 0));
          const hasHanjan =
            Boolean(step.placeId) &&
            hanjanPlaceIds.has(step.placeId) &&
            !stamped;
          const url = step.imageUrl;
          return (
            <button
              key={step.key}
              type="button"
              data-sheet-no-drag
              style={styles.stepBtn}
              onClick={() => onExpand?.()}
              aria-label={`${step.label} ${step.name || ""} 펼치기`}
            >
              <div style={styles.photoWrap(stamped, isGuide, hasHanjan)}>
                {url ? (
                  <img src={url} alt="" style={styles.photo} loading="lazy" />
                ) : (
                  <div style={styles.coverFallback} aria-hidden>
                    📍
                  </div>
                )}
                {stamped ? (
                  <span style={styles.stampBadge} aria-hidden>
                    ✓
                  </span>
                ) : hasHanjan ? (
                  <span style={styles.hanjanBadge} aria-hidden>
                    🍶
                  </span>
                ) : null}
              </div>
              <div style={styles.label}>{step.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
