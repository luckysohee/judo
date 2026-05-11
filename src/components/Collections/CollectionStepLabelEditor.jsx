import { useEffect, useRef, useState } from "react";

const STEP_LABEL_MAX_LEN = 24;
const PRESETS = ["1차", "2차", "디저트", "야장", "마무리"];

/**
 * 컬렉션 장소 1행의 `step_label` 인라인 에디터.
 *
 * - 닫힌 상태: 라벨이 있으면 칩 표시 + 클릭 시 편집, 없으면 "+ 스텝 라벨" 추가 버튼.
 * - 열린 상태: 텍스트 입력 + 프리셋 칩(1차/2차/디저트/야장/마무리) + 저장/지우기/취소.
 *
 * `onSave(nextLabel | null)` 가 throw 하지 않으면 자동으로 닫는다.
 *
 * @param {{
 *   value: string | null | undefined,
 *   disabled?: boolean,
 *   onSave: (next: string | null) => Promise<void>,
 * }} props
 */
export default function CollectionStepLabelEditor({ value, disabled, onSave }) {
  const initial = typeof value === "string" ? value.trim() : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) {
      setDraft(typeof value === "string" ? value.trim() : "");
      setError("");
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      try {
        inputRef.current.focus();
        inputRef.current.select();
      } catch {
        /* ignore */
      }
    }
  }, [editing]);

  const commit = async (nextRaw) => {
    if (saving) return;
    const trimmed = (nextRaw ?? "").trim();
    if (trimmed.length > STEP_LABEL_MAX_LEN) {
      setError(`최대 ${STEP_LABEL_MAX_LEN}자까지 가능합니다.`);
      return;
    }
    const nextValue = trimmed.length > 0 ? trimmed : null;
    const currentNorm = initial.length > 0 ? initial : null;
    if (nextValue === currentNorm) {
      setEditing(false);
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(nextValue);
      setEditing(false);
    } catch (e) {
      setError(e?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    if (initial) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          style={styles.chipBtn}
          aria-label={`스텝 라벨 ${initial} 편집`}
        >
          <span style={styles.chipDot} aria-hidden="true" />
          {initial}
          <span style={styles.chipEdit} aria-hidden="true">
            ✎
          </span>
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        style={styles.addBtn}
      >
        + 스텝 라벨
      </button>
    );
  }

  return (
    <div style={styles.editor}>
      <div style={styles.row}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={STEP_LABEL_MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit(draft);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          placeholder="예: 1차, 디저트, 야장"
          style={styles.input}
          disabled={saving}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void commit(draft)}
          disabled={saving}
          style={styles.saveBtn}
        >
          {saving ? "…" : "저장"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          style={styles.cancelBtn}
        >
          취소
        </button>
      </div>
      <div style={styles.presets}>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setDraft(p)}
            disabled={saving}
            style={{
              ...styles.presetChip,
              ...(draft.trim() === p ? styles.presetChipActive : null),
            }}
          >
            {p}
          </button>
        ))}
        {initial ? (
          <button
            type="button"
            onClick={() => void commit("")}
            disabled={saving}
            style={styles.clearChip}
          >
            지우기
          </button>
        ) : null}
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
    </div>
  );
}

const styles = {
  chipBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.14)",
    color: "#9ad3a4",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#2ecc71",
  },
  chipEdit: {
    fontSize: 11,
    opacity: 0.8,
  },
  addBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px dashed rgba(255,255,255,0.25)",
    background: "transparent",
    color: "#bdbdbd",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  editor: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  },
  row: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: 120,
    borderRadius: 8,
    border: "1px solid #444",
    background: "#0f0f0f",
    color: "#fff",
    padding: "6px 10px",
    fontSize: 13,
  },
  saveBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(145deg,#2ecc71,#27ae60)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #3a3a3a",
    background: "#1a1a1a",
    color: "#bdbdbd",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  presets: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  presetChip: {
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid #3a3a3a",
    background: "#1a1a1a",
    color: "#ddd",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  presetChipActive: {
    border: "1px solid rgba(46,204,113,0.6)",
    background: "rgba(46,204,113,0.18)",
    color: "#9ad3a4",
  },
  clearChip: {
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid rgba(231,76,60,0.4)",
    background: "rgba(231,76,60,0.1)",
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    fontSize: 12,
    color: "#e74c3c",
  },
};
