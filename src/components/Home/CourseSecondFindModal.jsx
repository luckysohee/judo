import {
  COURSE_SECOND_SNACK_OPTIONS,
  STUDIO_ATMOSPHERE_OPTIONS,
  STUDIO_LIQUOR_TYPE_OPTIONS,
} from "../../utils/placeTaxonomy.js";
import { COURSE_SECOND_FIND_DISTANCE_OPTIONS } from "../../pages/Home/homeModule.js";

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
    padding: "6px 11px",
    borderRadius: 999,
    border: on
      ? "1px solid rgba(17, 17, 17, 0.55)"
      : "1px solid rgba(92, 64, 51, 0.18)",
    background: on ? "rgba(245,245,245,0.98)" : "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontWeight: 700,
    color: on ? "#111111" : "#5c4033",
    cursor: "pointer",
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
  preferCloser,
  onChangePreferCloser,
  prioritizeCurators,
  onChangePrioritizeCurators,
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
            marginBottom: 4,
          }}
        >
          2차 후보 조건
        </div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            lineHeight: 1.45,
            color: "#666",
          }}
        >
          골라 주시면 그에 맞춰 가산점을 줘요. 분위기·주종은 잔 올리기와 같은
          목록이에요. 거리는 1차 기준으로 후보를 잘라요. 안 고르면 분위기·주종·
          안주는 기본 룰만 쓰고, 거리는 3km로 둡니다.
        </p>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 11,
            lineHeight: 1.4,
            color: "rgba(61,41,20,0.68)",
            fontWeight: 700,
          }}
        >
          선택한 조건으로 주변 2차 후보를 다시 계산해요.
        </p>

        <div style={SECTION_LABEL_STYLE}>분위기</div>
        <MultiSelectChips
          keyPrefix="2fv"
          options={STUDIO_ATMOSPHERE_OPTIONS}
          selected={vibes}
          onToggle={onChangeVibes}
        />

        <div style={SECTION_LABEL_STYLE}>주종</div>
        <MultiSelectChips
          keyPrefix="2fl"
          options={STUDIO_LIQUOR_TYPE_OPTIONS}
          selected={liquors}
          onToggle={onChangeLiquors}
        />

        <div style={SECTION_LABEL_STYLE}>안주</div>
        <MultiSelectChips
          keyPrefix="2fa"
          options={COURSE_SECOND_SNACK_OPTIONS}
          selected={anju}
          onToggle={onChangeAnju}
        />

        <div style={SECTION_LABEL_STYLE}>1차에서 거리</div>
        <div style={CHIP_ROW_STYLE}>
          {COURSE_SECOND_FIND_DISTANCE_OPTIONS.map(({ m, label }) => {
            const on = maxDistanceM === m;
            return (
              <button
                key={`2fd-${m}`}
                type="button"
                onClick={() => onChangeMaxDistanceM(m)}
                style={chipStyle(on)}
              >
                {label}
              </button>
            );
          })}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            fontSize: 13,
            fontWeight: 600,
            color: "#3d2914",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={preferCloser}
            onChange={(e) => onChangePreferCloser(e.target.checked)}
          />
          더 가까운 곳 우선
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            color: "#3d2914",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={prioritizeCurators}
            onChange={(e) => onChangePrioritizeCurators(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            큐레이터 추천 우선
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 11,
                fontWeight: 500,
                color: "#777",
              }}
            >
              여러 큐레이터가 겹쳐 담은 곳·등록 수에 가산점
            </span>
          </span>
        </label>

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
