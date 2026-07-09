import {
  formatCourseStayMinutes,
  formatCourseWalkApprox,
  getCourseOpenStatusText,
  formatCourseLegDistanceSummary,
  formatCourseThreeStepWalkingSummary,
  formatCourseProfileOneLine,
} from "../../utils/formatCourseUi";
import { mergePickedPlaceWithCuratorCatalog } from "../../utils/mergePickedPlaceWithCuratorCatalog";
import { placeId } from "../../utils/generateCourseOptions.js";
import { getRegenerateSecondLabel } from "../../utils/regenerateSecondStep.js";
import { COURSE_GPS_RADIUS_OPTIONS } from "../../pages/Home/homeModule.js";

/**
 * 코스 모드일 때 지도 하단에 붙는 병합 헤더 + 펼침 시트(코스 카드·조합·대안).
 * 상태와 비즈니스 로직은 Home에 두고, 마크업만 분리한다.
 */
export default function HomeCourseMergedSheet({
  styles,
  isCourseMode,
  courseMergedHeaderRef,
  handleClearSearch,
  aiSheetOpen,
  setAiSheetOpen,
  isAiSearching,
  courseError,
  courseOptions,
  aiSummary,
  coursePullStripRef,
  courseSearchUsedGpsOrigin,
  courseGpsRadiusM,
  handleCourseGpsRadiusChange,
  isLoadingCourse,
  courseQueryParsed,
  courseIncludeHalfStep,
  handleCourseIncludeHalfStepChange,
  courseSwipeRowRef,
  onCourseSwipeRowScroll,
  selectedCourse,
  chooseCourse,
  setCourseComposeSlotFirst,
  setCourseComposeSlotBridge,
  setCourseComposeSlotSecond,
  courseComposeSlotFirst,
  courseComposeSlotBridge,
  courseComposeSlotSecond,
  curatorPlaceCatalogForMerge,
  setSelectedPlaceWithAnalytics,
  assignCourseStepToComposeAuto,
  courseWalkStrollHint,
  courseDrivingMap,
  applyComposedCourseFromSteps,
  altFirstCourses,
  altSecondCourses,
  applyAlternativeFirst,
  applyAlternativeSecond,
  rerunDifferentCourses,
  regenerateSelectedCourseFirst,
  regenerateSelectedCourseSecond,
  isRefreshingCourses,
  isRegeneratingSecond,
  isRegeneratingFirst,
  onSaveSelectedCourseAsDraft,
  saveSelectedCourseDraftBusy = false,
}) {
  const courseChipBusy =
    isRefreshingCourses || isRegeneratingSecond || isRegeneratingFirst;

  return (
            <div style={styles.courseMergedShell}>
              <div ref={courseMergedHeaderRef} style={styles.courseMergedHeader}>
                <button
                  type="button"
                  style={styles.courseSearchClearButton}
                  onClick={handleClearSearch}
                  aria-label="코스 추천 닫기"
                  title="검색어 지우고 코스 추천 닫기"
                >
                  ×
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.aiPeekBar,
                    ...styles.courseAiPeekBar,
                    ...styles.courseMergedPeekToggle,
                    flex: 1,
                    minWidth: 0,
                    opacity: isAiSearching ? 0.92 : 1,
                    cursor: aiSheetOpen ? "default" : "pointer",
                  }}
                  onClick={() => {
                    if (!aiSheetOpen) setAiSheetOpen(true);
                  }}
                  aria-label={
                    aiSheetOpen
                      ? "추천 코스"
                      : "추천 코스 펼치기"
                  }
                >
                  <div style={{ ...styles.aiPeekLeft, gap: "8px" }}>
                    <div style={styles.aiPeekTextWrap}>
                      <div style={{ ...styles.aiPeekTitle, ...styles.courseAiPeekTitle }}>
                        {courseError && !courseOptions.length
                          ? "코스를 찾지 못했어요"
                          : `추천 코스 ${courseOptions.length}가지`}
                      </div>
                      <div
                        style={{
                          ...styles.aiPeekSubtitle,
                          ...styles.courseAiPeekSubtitle,
                        }}
                      >
                        {courseError && !courseOptions.length ? (
                          courseError
                        ) : (
                          <span>
                            {aiSummary ||
                              (aiSheetOpen
                                ? "아래로 밀면 접혀요"
                                : "눌러서 코스 상세 보기")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  style={styles.courseSheetCollapseButton}
                  onClick={() => setAiSheetOpen((open) => !open)}
                  aria-label={aiSheetOpen ? "코스 시트 접기" : "코스 시트 펼치기"}
                  title={aiSheetOpen ? "접기" : "펼치기"}
                >
                  {aiSheetOpen ? "접기" : "펼치기"}
                </button>
              </div>

              {aiSheetOpen ? (
                <div style={styles.courseMergedBody}>
                  <div
                    ref={coursePullStripRef}
                    style={styles.courseSheetPullStrip}
                    aria-label="아래로 밀어 접기"
                    role="presentation"
                  >
                    <div style={styles.courseSheetPullStripBar} />
                  </div>
                  {courseSearchUsedGpsOrigin ? (
                    <div
                      style={{
                        padding: "12px 14px 4px",
                        borderBottom: "1px solid rgba(17, 17, 17, 0.12)",
                        background: "rgba(245,245,245,0.5)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#111111",
                          marginBottom: 8,
                        }}
                      >
                        검색 반경 (내 위치 기준)
                      </div>
                      <div
                        role="group"
                        aria-label="코스 검색 반경"
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {COURSE_GPS_RADIUS_OPTIONS.map(({ m, label }) => {
                          const selected = courseGpsRadiusM === m;
                          const busy = isLoadingCourse || isAiSearching;
                          return (
                            <button
                              key={m}
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (m === courseGpsRadiusM) return;
                                void handleCourseGpsRadiusChange(m);
                              }}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 999,
                                border: `1px solid ${
                                  selected
                                    ? "rgba(17, 17, 17, 0.85)"
                                    : "rgba(92, 64, 51, 0.25)"
                                }`,
                                background: selected
                                  ? "rgba(17, 17, 17, 0.12)"
                                  : "rgba(255,255,255,0.95)",
                                fontSize: 12,
                                fontWeight: selected ? 800 : 600,
                                color: selected ? "#111111" : "#5c4033",
                                cursor: busy ? "wait" : "pointer",
                                opacity: busy ? 0.65 : 1,
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: 10,
                          lineHeight: 1.4,
                          color: "#7d6a5c",
                        }}
                      >
                        기본 3km · 더 넓게 보실 땐 5km / 8km
                      </p>
                    </div>
                  ) : null}
                  {courseError ? (
                    <p
                      style={{
                        margin: "12px 16px",
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "#5c4033",
                      }}
                    >
                      {courseError}
                    </p>
                  ) : null}
                  <div style={styles.courseSheetBody}>
                    {!courseError &&
                    isCourseMode &&
                    courseQueryParsed?.steps === 2 ? (
                      <div
                        style={{
                          margin: "8px 12px 0",
                          padding: "8px 10px 10px",
                          borderRadius: 10,
                          background: "#f5f5f5",
                          border: "1px solid rgba(17, 17, 17, 0.18)",
                          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                        }}
                      >
                        <div
                          role="radiogroup"
                          aria-label="1차와 2차 사이 동선"
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 6,
                            rowGap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#5c4033",
                              flexShrink: 0,
                            }}
                          >
                            1차
                          </span>
                          <span
                            style={{
                              color: "#cbd5e1",
                              fontSize: 10,
                              userSelect: "none",
                            }}
                            aria-hidden
                          >
                            —
                          </span>
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 8px",
                              borderRadius: 8,
                              border: !courseIncludeHalfStep
                                ? "1px solid rgba(17, 17, 17, 0.55)"
                                : "1px solid rgba(15, 23, 42, 0.1)",
                              background: !courseIncludeHalfStep
                                ? "rgba(17, 17, 17, 0.08)"
                                : "#ffffff",
                              cursor:
                                isLoadingCourse || isAiSearching
                                  ? "wait"
                                  : "pointer",
                              opacity:
                                isLoadingCourse || isAiSearching ? 0.55 : 1,
                            }}
                          >
                            <input
                              type="radio"
                              name="course-half-step-mode"
                              checked={!courseIncludeHalfStep}
                              disabled={isLoadingCourse || isAiSearching}
                              onChange={() => {
                                if (!courseIncludeHalfStep) return;
                                void handleCourseIncludeHalfStepChange(false);
                              }}
                              style={{
                                width: 14,
                                height: 14,
                                flexShrink: 0,
                                accentColor: "#111111",
                                cursor:
                                  isLoadingCourse || isAiSearching
                                    ? "wait"
                                    : "pointer",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#1c1917",
                                letterSpacing: "-0.02em",
                                lineHeight: 1.2,
                              }}
                            >
                              직행
                            </span>
                          </label>
                          <span
                            style={{
                              color: "#cbd5e1",
                              fontSize: 10,
                              userSelect: "none",
                            }}
                            aria-hidden
                          >
                            —
                          </span>
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 8px",
                              borderRadius: 8,
                              border: courseIncludeHalfStep
                                ? "1px solid #111111"
                                : "1px solid rgba(15, 23, 42, 0.1)",
                              background: courseIncludeHalfStep
                                ? "rgba(17, 17, 17, 0.06)"
                                : "#ffffff",
                              cursor:
                                isLoadingCourse || isAiSearching
                                  ? "wait"
                                  : "pointer",
                              opacity:
                                isLoadingCourse || isAiSearching ? 0.55 : 1,
                            }}
                          >
                            <input
                              type="radio"
                              name="course-half-step-mode"
                              checked={courseIncludeHalfStep}
                              disabled={isLoadingCourse || isAiSearching}
                              onChange={() => {
                                if (courseIncludeHalfStep) return;
                                void handleCourseIncludeHalfStepChange(true);
                              }}
                              style={{
                                width: 14,
                                height: 14,
                                flexShrink: 0,
                                accentColor: "#111111",
                                cursor:
                                  isLoadingCourse || isAiSearching
                                    ? "wait"
                                    : "pointer",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#1c1917",
                                letterSpacing: "-0.02em",
                                lineHeight: 1.2,
                              }}
                            >
                              쩜오(카페·디저트)
                            </span>
                          </label>
                          <span
                            style={{
                              color: "#cbd5e1",
                              fontSize: 10,
                              userSelect: "none",
                            }}
                            aria-hidden
                          >
                            —
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#5c4033",
                              flexShrink: 0,
                            }}
                          >
                            2차
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <>
                    <div
                      ref={courseSwipeRowRef}
                      style={styles.courseOptionsSwipeRow}
                      onScroll={onCourseSwipeRowScroll}
                    >
                    {courseOptions.map((course, index) => {
                      const isSel = selectedCourse?.key === course.key;
                      const legSummary = formatCourseLegDistanceSummary(course);
                      const threeLegWalk = formatCourseThreeStepWalkingSummary(
                        course
                      );
                      const slot1Pid = placeId(courseComposeSlotFirst?.place);
                      const slotBridgePid = placeId(
                        courseComposeSlotBridge?.place
                      );
                      const slot2Pid = placeId(courseComposeSlotSecond?.place);
                      const stepComposePicked = (step) => {
                        const p = placeId(step?.place);
                        if (!p) return false;
                        if (p === slot1Pid || p === slot2Pid) return true;
                        if (courseIncludeHalfStep && p === slotBridgePid)
                          return true;
                        return false;
                      };
                      const s0Picked = stepComposePicked(course.steps[0]);
                      const s1Picked = stepComposePicked(course.steps[1]);
                      const s2Picked = stepComposePicked(course.steps[2]);
                      const pickChip = {
                        flexShrink: 0,
                        padding: "4px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(17, 17, 17, 0.35)",
                        background: "rgba(255,255,255,0.98)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#111111",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      };
                      return (
                      <div
                        key={course.key || index}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (course.key !== selectedCourse?.key) {
                            setCourseComposeSlotFirst(null);
                            setCourseComposeSlotBridge(null);
                            setCourseComposeSlotSecond(null);
                          }
                          chooseCourse(course);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (course.key !== selectedCourse?.key) {
                              setCourseComposeSlotFirst(null);
                              setCourseComposeSlotBridge(null);
                              setCourseComposeSlotSecond(null);
                            }
                            chooseCourse(course);
                          }
                        }}
                        style={{
                          ...styles.courseOptionCardSwipe,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.92)",
                          border: isSel
                            ? "2px solid rgba(17, 17, 17, 0.55)"
                            : "1px solid rgba(92, 64, 51, 0.12)",
                          boxShadow: isSel
                            ? "0 6px 18px rgba(17, 17, 17, 0.15)"
                            : "0 4px 14px rgba(0,0,0,0.06)",
                          cursor: "pointer",
                          outline: "none",
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 11,
                            marginBottom: 8,
                            color: "#3d2914",
                            lineHeight: 1.3,
                            wordBreak: "keep-all",
                            overflowWrap: "anywhere",
                          }}
                          title={formatCourseProfileOneLine(course, index)}
                        >
                          {formatCourseProfileOneLine(course, index)}
                        </div>
                        {threeLegWalk?.lines?.length ? (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#111111",
                              marginBottom: 8,
                              lineHeight: 1.5,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#5c4033",
                                marginBottom: 5,
                                letterSpacing: "-0.02em",
                              }}
                            >
                              걷는 동선(대략)
                            </div>
                            {threeLegWalk.lines.map((ln, li) => (
                              <div key={li}>{ln}</div>
                            ))}
                            {threeLegWalk.totalLine ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  paddingTop: 6,
                                  borderTop:
                                    "1px solid rgba(17, 17, 17, 0.22)",
                                  fontWeight: 800,
                                }}
                              >
                                {threeLegWalk.totalLine}
                              </div>
                            ) : null}
                          </div>
                        ) : legSummary ? (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#111111",
                              marginBottom: 8,
                              lineHeight: 1.45,
                            }}
                          >
                            1차→2차 {legSummary}
                          </div>
                        ) : null}
                        {courseWalkStrollHint &&
                        course.key === courseDrivingMap?.key ? (
                          <div
                            style={{
                              marginBottom: 6,
                              padding: "5px 8px",
                              borderRadius: 7,
                              background: "rgba(245, 245, 245, 0.98)",
                              border: "1px solid rgba(17, 17, 17, 0.32)",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#111111",
                              lineHeight: 1.35,
                              letterSpacing: "-0.01em",
                              wordBreak: "keep-all",
                            }}
                          >
                            {courseWalkStrollHint}
                          </div>
                        ) : null}
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: "#333" }}>
                          <div style={{ marginBottom: 8 }}>
                            <strong>{course.steps[0]?.label}</strong>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 4,
                              }}
                            >
                              <button
                                type="button"
                                style={{
                                  flex: "1 1 120px",
                                  minWidth: 0,
                                  padding: 0,
                                  border: "none",
                                  background: "none",
                                  color: "#6b4f2a",
                                  fontWeight: 600,
                                  textAlign: "left",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const raw =
                                    course.steps[0]?.place?._raw ||
                                    course.steps[0]?.place;
                                  if (!raw) return;
                                  setSelectedPlaceWithAnalytics(
                                    mergePickedPlaceWithCuratorCatalog(
                                      raw,
                                      curatorPlaceCatalogForMerge
                                    ),
                                    "course_step1"
                                  );
                                }}
                              >
                                {course.steps[0]?.place?.name}
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...pickChip,
                                  background: s0Picked
                                    ? "rgba(245,245,245,0.98)"
                                    : "rgba(255,255,255,0.98)",
                                  border: s0Picked
                                    ? "1px solid rgba(17, 17, 17, 0.65)"
                                    : "1px solid rgba(17, 17, 17, 0.35)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assignCourseStepToComposeAuto(course.steps[0]);
                                }}
                              >
                                {s0Picked ? "담음" : "담기"}
                              </button>
                            </div>
                            <div style={{ color: "#666", marginTop: 4 }}>
                              체류 약{" "}
                              {formatCourseStayMinutes(
                                course.steps[0]?.stayMinutes
                              )}
                            </div>
                            {getCourseOpenStatusText(course.steps[0]?.place) ? (
                              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                {getCourseOpenStatusText(course.steps[0]?.place)}
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <strong>{course.steps[1]?.label}</strong>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 4,
                              }}
                            >
                              <button
                                type="button"
                                style={{
                                  flex: "1 1 120px",
                                  minWidth: 0,
                                  padding: 0,
                                  border: "none",
                                  background: "none",
                                  color: "#6b4f2a",
                                  fontWeight: 600,
                                  textAlign: "left",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const raw =
                                    course.steps[1]?.place?._raw ||
                                    course.steps[1]?.place;
                                  if (!raw) return;
                                  setSelectedPlaceWithAnalytics(
                                    mergePickedPlaceWithCuratorCatalog(
                                      raw,
                                      curatorPlaceCatalogForMerge
                                    ),
                                    "course_step2"
                                  );
                                }}
                              >
                                {course.steps[1]?.place?.name}
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...pickChip,
                                  background: s1Picked
                                    ? "rgba(245,245,245,0.98)"
                                    : "rgba(255,255,255,0.98)",
                                  border: s1Picked
                                    ? "1px solid rgba(17, 17, 17, 0.65)"
                                    : "1px solid rgba(17, 17, 17, 0.35)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assignCourseStepToComposeAuto(course.steps[1]);
                                }}
                              >
                                {s1Picked ? "담음" : "담기"}
                              </button>
                            </div>
                            <div style={{ color: "#666", marginTop: 4 }}>
                              체류 약{" "}
                              {formatCourseStayMinutes(
                                course.steps[1]?.stayMinutes
                              )}
                            </div>
                            {getCourseOpenStatusText(course.steps[1]?.place) ? (
                              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                {getCourseOpenStatusText(course.steps[1]?.place)}
                              </div>
                            ) : null}
                          </div>
                          {course.steps.length > 2 && course.steps[2]?.place ? (
                            <>
                              <div
                                style={{
                                  margin: "10px 0",
                                  fontSize: 12,
                                  color: "#666",
                                }}
                              >
                                다음 구간{" "}
                                {formatCourseWalkApprox(
                                  course.steps[2]?.walkDistanceMeters
                                )}
                              </div>
                              <div>
                                <strong>{course.steps[2]?.label}</strong>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: 8,
                                    marginTop: 4,
                                  }}
                                >
                                  <button
                                    type="button"
                                    style={{
                                      flex: "1 1 120px",
                                      minWidth: 0,
                                      padding: 0,
                                      border: "none",
                                      background: "none",
                                      color: "#6b4f2a",
                                      fontWeight: 600,
                                      textAlign: "left",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const raw =
                                        course.steps[2]?.place?._raw ||
                                        course.steps[2]?.place;
                                      if (!raw) return;
                                      setSelectedPlaceWithAnalytics(
                                        mergePickedPlaceWithCuratorCatalog(
                                          raw,
                                          curatorPlaceCatalogForMerge
                                        ),
                                        "course_step3"
                                      );
                                    }}
                                  >
                                    {course.steps[2]?.place?.name}
                                  </button>
                                  <button
                                    type="button"
                                    style={{
                                      ...pickChip,
                                      background: s2Picked
                                        ? "rgba(245,245,245,0.98)"
                                        : "rgba(255,255,255,0.98)",
                                      border: s2Picked
                                        ? "1px solid rgba(17, 17, 17, 0.65)"
                                        : "1px solid rgba(17, 17, 17, 0.35)",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      assignCourseStepToComposeAuto(
                                        course.steps[2]
                                      );
                                    }}
                                  >
                                    {s2Picked ? "담음" : "담기"}
                                  </button>
                                </div>
                                <div style={{ color: "#666", marginTop: 4 }}>
                                  체류 약{" "}
                                  {formatCourseStayMinutes(
                                    course.steps[2]?.stayMinutes
                                  )}
                                </div>
                                {getCourseOpenStatusText(
                                  course.steps[2]?.place
                                ) ? (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#888",
                                      marginTop: 2,
                                    }}
                                  >
                                    {getCourseOpenStatusText(
                                      course.steps[2]?.place
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                    })}
                    </div>
                    {!courseError && courseOptions.length > 0 ? (
                      <div
                        style={{
                          flexShrink: 0,
                          padding: "8px 10px 10px",
                          background: "rgba(245,245,245,0.55)",
                          borderBottom: "1px solid rgba(17, 17, 17, 0.12)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "nowrap",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 2,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#111111",
                              flexShrink: 0,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            조합
                          </span>
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 10,
                              color: "#3d2914",
                              lineHeight: 1.35,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={
                              courseIncludeHalfStep
                                ? `1차 ${courseComposeSlotFirst?.place?.name ?? "—"} · 쩜오 ${courseComposeSlotBridge?.place?.name ?? "—"} · 2차 ${courseComposeSlotSecond?.place?.name ?? "—"}`
                                : `1차 ${courseComposeSlotFirst?.place?.name ?? "—"} · 2차 ${courseComposeSlotSecond?.place?.name ?? "—"}`
                            }
                          >
                            <span style={{ color: "#888" }}>1</span>{" "}
                            {courseComposeSlotFirst?.place?.name ?? "—"}
                            {courseIncludeHalfStep ? (
                              <>
                                <span
                                  style={{ margin: "0 4px", color: "rgba(17, 17, 17, 0.28)" }}
                                >
                                  |
                                </span>
                                <span style={{ color: "#888" }}>쩜오</span>{" "}
                                {courseComposeSlotBridge?.place?.name ?? "—"}
                              </>
                            ) : null}
                            <span style={{ margin: "0 4px", color: "rgba(17, 17, 17, 0.28)" }}>
                              |
                            </span>
                            <span style={{ color: "#888" }}>2</span>{" "}
                            {courseComposeSlotSecond?.place?.name ?? "—"}
                          </div>
                          <button
                            type="button"
                            disabled={
                              !courseComposeSlotFirst &&
                              !courseComposeSlotBridge &&
                              !courseComposeSlotSecond
                            }
                            style={{
                              flexShrink: 0,
                              padding: "5px 8px",
                              borderRadius: 8,
                              border: "1px solid rgba(92, 64, 51, 0.2)",
                              background: "rgba(255,255,255,0.95)",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#5c4033",
                              cursor:
                                courseComposeSlotFirst ||
                                courseComposeSlotBridge ||
                                courseComposeSlotSecond
                                  ? "pointer"
                                  : "default",
                              opacity:
                                courseComposeSlotFirst ||
                                courseComposeSlotBridge ||
                                courseComposeSlotSecond
                                  ? 1
                                  : 0.45,
                            }}
                            onClick={() => {
                              setCourseComposeSlotFirst(null);
                              setCourseComposeSlotBridge(null);
                              setCourseComposeSlotSecond(null);
                            }}
                          >
                            초기화
                          </button>
                          <button
                            type="button"
                            disabled={
                              courseIncludeHalfStep
                                ? !(
                                    courseComposeSlotFirst &&
                                    courseComposeSlotBridge &&
                                    courseComposeSlotSecond
                                  )
                                : !(
                                    courseComposeSlotFirst &&
                                    courseComposeSlotSecond
                                  )
                            }
                            style={{
                              flexShrink: 0,
                              padding: "5px 8px",
                              borderRadius: 8,
                              border: "none",
                              background:
                                courseIncludeHalfStep &&
                                courseComposeSlotFirst &&
                                courseComposeSlotBridge &&
                                courseComposeSlotSecond
                                  ? "rgba(17, 17, 17, 0.95)"
                                  : !courseIncludeHalfStep &&
                                      courseComposeSlotFirst &&
                                      courseComposeSlotSecond
                                    ? "rgba(17, 17, 17, 0.95)"
                                    : "rgba(0,0,0,0.08)",
                              fontSize: 10,
                              fontWeight: 800,
                              color: "#fff",
                              cursor:
                                courseIncludeHalfStep &&
                                courseComposeSlotFirst &&
                                courseComposeSlotBridge &&
                                courseComposeSlotSecond
                                  ? "pointer"
                                  : !courseIncludeHalfStep &&
                                      courseComposeSlotFirst &&
                                      courseComposeSlotSecond
                                    ? "pointer"
                                    : "not-allowed",
                              opacity:
                                courseIncludeHalfStep &&
                                courseComposeSlotFirst &&
                                courseComposeSlotBridge &&
                                courseComposeSlotSecond
                                  ? 1
                                  : !courseIncludeHalfStep &&
                                      courseComposeSlotFirst &&
                                      courseComposeSlotSecond
                                    ? 1
                                    : 0.55,
                            }}
                            title="이 조합으로 코스 적용"
                            onClick={() => {
                              if (courseIncludeHalfStep) {
                                if (
                                  !courseComposeSlotFirst ||
                                  !courseComposeSlotBridge ||
                                  !courseComposeSlotSecond ||
                                  !applyComposedCourseFromSteps(
                                    courseComposeSlotFirst,
                                    courseComposeSlotBridge,
                                    courseComposeSlotSecond
                                  )
                                ) {
                                  return;
                                }
                              } else {
                                if (
                                  !courseComposeSlotFirst ||
                                  !courseComposeSlotSecond ||
                                  !applyComposedCourseFromSteps(
                                    courseComposeSlotFirst,
                                    courseComposeSlotSecond
                                  )
                                ) {
                                  return;
                                }
                              }
                              setCourseComposeSlotFirst(null);
                              setCourseComposeSlotBridge(null);
                              setCourseComposeSlotSecond(null);
                            }}
                          >
                            적용
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {selectedCourse && courseOptions.length ? (
                      <div
                        style={{
                          padding: "4px 10px 8px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            fontSize: 11,
                            color: "#888",
                            lineHeight: 1.45,
                            marginBottom: 2,
                          }}
                        >
                          지도 선은 길을 따라 표시됩니다.
                        </div>
                        {(() => {
                          const neutralChip = {
                            border: "1px solid rgba(92, 64, 51, 0.18)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            background: "rgba(255,255,255,0.95)",
                            fontSize: 12,
                            color: "#3d2914",
                            cursor: courseChipBusy ? "wait" : "pointer",
                            opacity: courseChipBusy ? 0.65 : 1,
                          };
                          return (
                            <>
                              <button
                                type="button"
                                disabled={courseChipBusy}
                                style={{
                                  border: "1px solid rgba(17, 17, 17, 0.35)",
                                  borderRadius: 999,
                                  padding: "8px 12px",
                                  background: "rgba(245,245,245,0.98)",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#111111",
                                  cursor: courseChipBusy ? "wait" : "pointer",
                                  opacity: courseChipBusy ? 0.65 : 1,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void rerunDifferentCourses();
                                }}
                              >
                                {isRefreshingCourses
                                  ? "다른 코스 찾는 중…"
                                  : "다른 코스로 다시 추천"}
                              </button>
                              <button
                                type="button"
                                disabled={courseChipBusy}
                                style={neutralChip}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void regenerateSelectedCourseFirst();
                                }}
                              >
                                {isRegeneratingFirst
                                  ? "1차 찾는 중…"
                                  : "1차만 다시"}
                              </button>
                              <button
                                type="button"
                                disabled={courseChipBusy}
                                style={neutralChip}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void regenerateSelectedCourseSecond("same");
                                }}
                              >
                                {isRegeneratingSecond
                                  ? "2차 추천 중…"
                                  : "2차만 다시"}
                              </button>
                            </>
                          );
                        })()}
                        <div
                          style={{
                            width: "100%",
                            marginTop: "10px",
                            paddingTop: "8px",
                            borderTop: "1px solid rgba(17, 17, 17, 0.15)",
                          }}
                        >
                          <button
                            type="button"
                            disabled={
                              Boolean(saveSelectedCourseDraftBusy) ||
                              Boolean(courseChipBusy)
                            }
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              borderRadius: 12,
                              border: "1px solid rgba(46, 204, 113, 0.45)",
                              background: "rgba(236, 253, 245, 0.98)",
                              fontSize: 13,
                              fontWeight: 800,
                              color: "#166534",
                              cursor:
                                saveSelectedCourseDraftBusy || courseChipBusy
                                  ? "wait"
                                  : "pointer",
                              opacity:
                                saveSelectedCourseDraftBusy || courseChipBusy
                                  ? 0.65
                                  : 1,
                              letterSpacing: "-0.02em",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                saveSelectedCourseDraftBusy ||
                                courseChipBusy
                              ) {
                                return;
                              }
                              void onSaveSelectedCourseAsDraft?.();
                            }}
                          >
                            {saveSelectedCourseDraftBusy
                              ? "내 코스로 저장 중…"
                              : "내 코스로 저장"}
                          </button>
                          <p
                            style={{
                              margin: "6px 0 0",
                              fontSize: 10,
                              lineHeight: 1.35,
                              color: "#78716c",
                            }}
                          >
                            추천 장소는 필요 시 주도 DB에 등록된 뒤 초안으로
                            저장돼요. 편집 화면으로 이동합니다.
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {altFirstCourses.length > 0 ? (
                      <div style={{ padding: "0 12px 16px" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#3d2914",
                            marginBottom: 10,
                          }}
                        >
                          다른 1차 추천
                        </div>
                        {altFirstCourses.map((course) => (
                          <div
                            key={course.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => applyAlternativeFirst(course)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                applyAlternativeFirst(course);
                              }
                            }}
                            style={{
                              border: "1px solid rgba(92, 64, 51, 0.14)",
                              borderRadius: 14,
                              padding: "12px 14px",
                              background: "rgba(255,255,255,0.96)",
                              marginBottom: 10,
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>2차 유지</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[1]?.place?.name}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                padding: "8px 0",
                              }}
                            >
                              도보 약{" "}
                              {formatCourseWalkApprox(
                                course.steps[1]?.walkDistanceMeters
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>새 1차</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[0]?.place?.name}
                              </div>
                              <div style={{ color: "#666", marginTop: 4 }}>
                                체류 약{" "}
                                {formatCourseStayMinutes(
                                  course.steps[0]?.stayMinutes
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {altSecondCourses.length > 0 ? (
                      <div style={{ padding: "0 12px 16px" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#3d2914",
                            marginBottom: 10,
                          }}
                        >
                          다른 2차 추천
                        </div>
                        {altSecondCourses.map((course) => (
                          <div
                            key={course.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => applyAlternativeSecond(course)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                applyAlternativeSecond(course);
                              }
                            }}
                            style={{
                              border: "1px solid rgba(92, 64, 51, 0.14)",
                              borderRadius: 14,
                              padding: "12px 14px",
                              background: "rgba(255,255,255,0.96)",
                              marginBottom: 10,
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>1차 유지</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[0]?.place?.name}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                padding: "8px 0",
                              }}
                            >
                              {getRegenerateSecondLabel(course.regenerateVariant)} ·{" "}
                              {formatCourseWalkApprox(
                                course.steps[1]?.walkDistanceMeters
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>새 2차</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[1]?.place?.name}
                              </div>
                              <div style={{ color: "#666", marginTop: 4 }}>
                                체류 약{" "}
                                {formatCourseStayMinutes(
                                  course.steps[1]?.stayMinutes
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    </>

                  </div>
                </div>
              ) : null}
            </div>

  );
}
