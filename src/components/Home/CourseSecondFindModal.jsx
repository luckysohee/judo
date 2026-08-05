import {
  COURSE_SECOND_SNACK_OPTIONS,
  COURSE_SECOND_VIBE_OPTIONS,
  STUDIO_LIQUOR_TYPE_OPTIONS,
} from "../../utils/placeTaxonomy.js";
import {
  COURSE_SECOND_FIND_DEFAULT_DISTANCE_M,
  COURSE_SECOND_FIND_DISTANCE_OPTIONS,
} from "../../utils/courseSecondFindPrefs.js";

/**
 * 코스 2차 후보 조건 모달.
 * 1차 장소 기준으로 분위기·주종·안주·거리·정렬 가산점을 받아 confirm 시 부모가 후보를 다시 계산한다.
 * Home.jsx에서 인라인 ~370줄로 차지하던 영역을 분리한 presentational 모달.
 */

const SECTION_LABEL_STYLE = {
  fontSize: 12,
  fontWeight: 700,
  color: "#111111",
  marginBottom: 6,
};

const CHIP_ROW_STYLE = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 14,
};

function chipStyle(on) {
  return {
    flex: "1 1 0",
    minWidth: "4.2em",
    padding: "7px 8px",
    borderRadius: 999,
    border: on
      ? "1px solid rgba(17, 17, 17, 0.55)"
      : "1px solid rgba(92, 64, 51, 0.18)",
    background: on ? "rgba(245,245,245,0.98)" : "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontWeight: 700,
    color: on ? "#111111" : "#5c4033",
    cursor: "pointer",
    textAlign: "center",
    whiteSpace: "nowrap",
  };
}

function MultiSelectChips({ keyPrefix, options, selected, onToggle }) {
  return (
    <div style={CHIP_ROW_STYLE}>
      {options.map((v) => {
        const on = selected.includes(v);
        return (
          <button
            key={`${keyPrefix}-${v}`}
            type="button"
            onClick={() =>
              onToggle((prev) =>
                prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
              )
            }
            style={chipStyle(on)}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

/** 하나만 선택 (다시 누르면 해제) — selected는 길이 0~1 배열 */
function SingleSelectChips({ keyPrefix, options, selected, onChange }) {
  const current = Array.isArray(selected) ? selected[0] : null;
  return (
    <div style={CHIP_ROW_STYLE}>
      {options.map((v) => {
        const on = current === v;
        return (
          <button
            key={`${keyPrefix}-${v}`}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? [] : [v])}
            style={chipStyle(on)}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

const SECOND_FIND_SORT_OPTIONS = [
  { id: "closer", label: "더 가까운 곳 우선" },
  { id: "curator", label: "큐레이터 추천 우선" },
];

export default function CourseSecondFindModal({
  open,
  onCancel,
  onConfirm,
  confirmBusy,
  vibes,
  onChangeVibes,
  liquors,
  onChangeLiquors,
  anju,
  onChangeAnju,
  maxDistanceM,
  onChangeMaxDistanceM,
  /** closer | curator | null(미선택=기본 룰) */
  sortPriority = null,
  onChangeSortPriority,
}) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px 12px max(16px, env(safe-area-inset-bottom))",
        pointerEvents: "auto",
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-second-find-title"
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "min(72vh, 520px)",
          overflow: "auto",
          borderRadius: 16,
          background: "rgba(255,255,255,0.98)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
          padding: "16px 16px 14px",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="course-second-find-title"
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#3d2914",
            marginBottom: 14,
          }}
        >
          2차 후보 조건
        </div>

        <div style={SECTION_LABEL_STYLE}>분위기</div>
        <MultiSelectChips
          keyPrefix="2fv"
          options={COURSE_SECOND_VIBE_OPTIONS}
          selected={vibes}
          onToggle={onChangeVibes}
        />

        <div style={SECTION_LABEL_STYLE}>주종</div>
        <SingleSelectChips
          keyPrefix="2fl"
          options={STUDIO_LIQUOR_TYPE_OPTIONS}
          selected={liquors}
          onChange={onChangeLiquors}
        />

        <div style={SECTION_LABEL_STYLE}>안주</div>
        <MultiSelectChips
          keyPrefix="2fa"
          options={COURSE_SECOND_SNACK_OPTIONS}
          selected={anju}
          onToggle={onChangeAnju}
        />

        <div style={SECTION_LABEL_STYLE}>1차에서 거리</div>
        <div style={{ ...CHIP_ROW_STYLE, flexWrap: "wrap" }}>
          {COURSE_SECOND_FIND_DISTANCE_OPTIONS.map(({ m, label }) => {
            const effective =
              maxDistanceM == null
                ? COURSE_SECOND_FIND_DEFAULT_DISTANCE_M
                : Number(maxDistanceM);
            const on = effective === m;
            return (
              <button
                key={`2fd-${m}`}
                type="button"
                aria-pressed={on}
                title={
                  m === COURSE_SECOND_FIND_DEFAULT_DISTANCE_M
                    ? "선택 안 하면 기본값"
                    : undefined
                }
                onClick={() => onChangeMaxDistanceM(m)}
                style={{
                  ...chipStyle(on),
                  flex: "1 1 calc(50% - 3px)",
                  minWidth: "calc(50% - 3px)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={SECTION_LABEL_STYLE}>정렬</div>
        <div
          style={{
            ...CHIP_ROW_STYLE,
            marginBottom: 16,
            flexWrap: "nowrap",
          }}
        >
          {SECOND_FIND_SORT_OPTIONS.map(({ id, label }) => {
            const on = sortPriority === id;
            return (
              <button
                key={`2fs-${id}`}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChangeSortPriority?.(on ? null : id)
                }
                style={{
                  ...chipStyle(on),
                  flex: "1 1 0",
                  textAlign: "center",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(92, 64, 51, 0.22)",
              background: "#fff",
              fontSize: 13,
              fontWeight: 700,
              color: "#5c4033",
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={confirmBusy}
            onClick={onConfirm}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "rgba(17, 17, 17, 0.92)",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              cursor: confirmBusy ? "default" : "pointer",
              opacity: confirmBusy ? 0.65 : 1,
            }}
          >
            {confirmBusy ? "찾는 중…" : "후보 찾기"}
          </button>
        </div>
      </div>
    </div>
  );
}
