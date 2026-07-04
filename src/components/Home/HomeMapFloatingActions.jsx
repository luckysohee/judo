/**
 * 지도 영역 위에 떠 있는 작은 액션 버튼 묶음.
 * - "여기서 검색": 다음 검색을 현재 뷰포트 안으로만 한정.
 * - "쩜오 추가": 1차·2차 사이에 디저트 단계를 끼워 코스 재계산.
 *
 * 두 버튼 모두 단순 토글이라 표시 조건만 prop으로 받고 부모 콜백을 그대로 호출한다.
 */
export default function HomeMapFloatingActions({
  showSearchHere,
  onSearchHere,
  showAddHalfStep,
  onAddHalfStep,
  halfStepDisabled,
  halfStepStyles,
  showSaveCourse,
  onSaveCourse,
  saveCourseBusy,
  saveCourseStyles,
}) {
  return (
    <>
      {showSaveCourse ? (
        <button
          type="button"
          onClick={onSaveCourse}
          disabled={saveCourseBusy}
          style={{
            ...saveCourseStyles,
            ...(saveCourseBusy ? { opacity: 0.58, cursor: "wait" } : {}),
          }}
          title="지금 지도에 뜬 1·2차(쩜오 포함) 코스를 내 코스로 저장해요"
        >
          <span aria-hidden>📌</span>
          {saveCourseBusy ? "저장 중…" : "내 코스로 저장"}
        </button>
      ) : null}
      {showSearchHere ? (
        <button
          type="button"
          onClick={onSearchHere}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "calc(108px + env(safe-area-inset-bottom, 0px))",
            zIndex: 260,
            padding: "11px 18px",
            borderRadius: 999,
            border: "1px solid rgba(17, 17, 17, 0.35)",
            background: "rgba(255,255,255,0.98)",
            color: "#111111",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(0,0,0,0.14)",
            WebkitTapHighlightColor: "transparent",
            pointerEvents: "auto",
          }}
        >
          여기서 검색
        </button>
      ) : null}
      {showAddHalfStep ? (
        <button
          type="button"
          onClick={onAddHalfStep}
          disabled={halfStepDisabled}
          style={{
            ...halfStepStyles,
            ...(halfStepDisabled ? { opacity: 0.58, cursor: "wait" } : {}),
          }}
          title="1차와 2차 사이에 카페·디저트 쩜오차를 끼워 다시 경로를 보여줘요"
        >
          <span aria-hidden>🍨</span>
          쩜오 추가
        </button>
      ) : null}
    </>
  );
}
