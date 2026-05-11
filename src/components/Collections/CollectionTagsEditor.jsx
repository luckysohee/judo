import { useCallback, useEffect, useMemo, useState } from "react";
import { updateCollection } from "../../api/collections";
import {
  COLLECTION_TAG_MAX_COUNT,
  COLLECTION_TAG_MAX_LEN,
  COLLECTION_TAG_PRESETS,
  dedupeAndNormalizeCollectionTags,
  isSameCollectionTag,
  normalizeCollectionTag,
  presetIndex,
  splitCollectionTagsInput,
} from "../../utils/collectionTags";
import { useToast } from "../Toast/ToastProvider";

/**
 * 컬렉션 태그(상황 단위) 편집기. preset 토글 + 자유입력 혼합.
 *
 * - 입력은 항상 `dedupeAndNormalizeCollectionTags` 로 정규화 후 저장.
 * - DB 는 단순 `text[]`. 빈 배열은 `null` 로 저장해 "태그 없음" 의미를 명확히 한다.
 * - 검색·지도·추천 score 와 무관한 metadata 만 다룬다.
 *
 * @param {{
 *   collectionId: string,
 *   tags?: string[] | null,
 *   onChanged?: () => Promise<void> | void,
 * }} props
 */
export default function CollectionTagsEditor({
  collectionId,
  tags,
  onChanged,
}) {
  const { showToast } = useToast();
  const initial = useMemo(
    () => dedupeAndNormalizeCollectionTags(tags),
    [tags],
  );
  const [draft, setDraft] = useState(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const dirty = useMemo(() => {
    if (draft.length !== initial.length) return true;
    for (let i = 0; i < draft.length; i += 1) {
      if (!isSameCollectionTag(draft[i], initial[i])) return true;
    }
    return false;
  }, [draft, initial]);

  const presetState = useMemo(() => {
    const onSet = new Set(draft.map((t) => t.toLowerCase()));
    return COLLECTION_TAG_PRESETS.map((p) => ({
      label: p,
      on: onSet.has(p.toLowerCase()),
    }));
  }, [draft]);

  const togglePreset = useCallback((label) => {
    setDraft((prev) => {
      const found = prev.findIndex((t) => isSameCollectionTag(t, label));
      if (found >= 0) {
        const next = [...prev];
        next.splice(found, 1);
        return next;
      }
      if (prev.length >= COLLECTION_TAG_MAX_COUNT) return prev;
      return dedupeAndNormalizeCollectionTags([...prev, label]);
    });
  }, []);

  const removeTag = useCallback((label) => {
    setDraft((prev) =>
      prev.filter((t) => !isSameCollectionTag(t, label)),
    );
  }, []);

  const flushFreeformInput = useCallback(() => {
    const tokens = splitCollectionTagsInput(input);
    if (tokens.length === 0) {
      setInput("");
      return;
    }
    setDraft((prev) =>
      dedupeAndNormalizeCollectionTags([...prev, ...tokens]),
    );
    setInput("");
  }, [input]);

  const onInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        flushFreeformInput();
      } else if (e.key === "Backspace" && input === "" && draft.length > 0) {
        e.preventDefault();
        setDraft((prev) => prev.slice(0, -1));
      }
    },
    [input, draft.length, flushFreeformInput],
  );

  const onSave = useCallback(async () => {
    if (busy) return;
    const cleaned = dedupeAndNormalizeCollectionTags([
      ...draft,
      ...splitCollectionTagsInput(input),
    ]);
    setBusy(true);
    try {
      const { data, error } = await updateCollection(collectionId, {
        tags: cleaned,
      });
      if (error) {
        showToast(error.message || "태그 저장에 실패했어요.", "error", 2800);
        return;
      }
      if (!data) {
        showToast("권한이 없거나 컬렉션을 찾을 수 없어요.", "error", 2800);
        return;
      }
      showToast(
        cleaned.length === 0
          ? "태그를 비웠어요."
          : `태그 ${cleaned.length}개를 저장했어요.`,
        "success",
        2200,
      );
      setInput("");
      if (typeof onChanged === "function") {
        try {
          await onChanged();
        } catch (e) {
          if (import.meta?.env?.DEV) {
            console.warn("CollectionTagsEditor onChanged:", e?.message || e);
          }
        }
      }
    } catch (e) {
      showToast(e?.message || "태그 저장 중 오류가 발생했어요.", "error", 2800);
    } finally {
      setBusy(false);
    }
  }, [busy, draft, input, collectionId, showToast, onChanged]);

  const overflow =
    draft.length >= COLLECTION_TAG_MAX_COUNT && input.trim().length > 0;

  return (
    <section style={styles.wrap} aria-label="컬렉션 태그">
      <div style={styles.head}>
        <div style={styles.title}>상황 태그</div>
        <div style={styles.sub}>
          “데이트”, “야장” 처럼 코스 분위기를 한 단어로. 최대{" "}
          {COLLECTION_TAG_MAX_COUNT}개, 한 태그 {COLLECTION_TAG_MAX_LEN}자 이내.
        </div>
      </div>

      <div style={styles.presetRow}>
        {presetState.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => togglePreset(p.label)}
            style={{
              ...styles.presetChip,
              ...(p.on ? styles.presetChipOn : null),
            }}
            aria-pressed={p.on}
          >
            {p.on ? "✓" : "+"} {p.label}
          </button>
        ))}
      </div>

      <div style={styles.tagBox}>
        {draft.length === 0 ? (
          <span style={styles.emptyHint}>아직 태그가 없어요.</span>
        ) : (
          draft.map((t) => (
            <span
              key={t.toLowerCase()}
              style={{
                ...styles.tagChip,
                ...(presetIndex(t) >= 0
                  ? styles.tagChipPreset
                  : styles.tagChipCustom),
              }}
            >
              <span style={styles.tagChipLabel}>#{t}</span>
              <button
                type="button"
                onClick={() => removeTag(t)}
                style={styles.tagChipRemove}
                aria-label={`${t} 태그 제거`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div style={styles.inputRow}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          onBlur={flushFreeformInput}
          maxLength={COLLECTION_TAG_MAX_LEN}
          placeholder="자유 입력 (Enter 또는 콤마로 추가)"
          style={styles.input}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={flushFreeformInput}
          disabled={!normalizeCollectionTag(input)}
          style={styles.addBtn}
        >
          추가
        </button>
      </div>
      {overflow ? (
        <div style={styles.warn}>
          최대 {COLLECTION_TAG_MAX_COUNT}개까지만 추가할 수 있어요. 기존 태그를
          하나 빼고 다시 시도해 주세요.
        </div>
      ) : null}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => setDraft(initial)}
          disabled={busy || !dirty}
          style={styles.secondaryBtn}
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={busy || (!dirty && input.trim().length === 0)}
          style={styles.primaryBtn}
        >
          {busy ? "저장 중…" : "태그 저장"}
        </button>
      </div>
    </section>
  );
}

const styles = {
  wrap: {
    background: "#1a1a1a",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  head: { display: "flex", flexDirection: "column", gap: 4 },
  title: { fontSize: 15, fontWeight: 700, color: "#fff" },
  sub: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },
  presetRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  presetChip: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  presetChipOn: {
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.5)",
    color: "#d4f4dd",
  },
  tagBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    padding: 8,
    minHeight: 40,
    borderRadius: 10,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.18)",
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.4)",
    fontStyle: "italic",
  },
  tagChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 800,
    padding: "3px 4px 3px 10px",
    borderRadius: 999,
  },
  tagChipPreset: {
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.16)",
    border: "1px solid rgba(46,204,113,0.5)",
  },
  tagChipCustom: {
    color: "#dcc6ff",
    background: "rgba(155,89,182,0.16)",
    border: "1px solid rgba(155,89,182,0.5)",
  },
  tagChipLabel: { letterSpacing: "-0.01em" },
  tagChipRemove: {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    padding: 0,
  },
  inputRow: { display: "flex", gap: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    border: "1px solid #444",
    background: "#111",
    color: "#fff",
    padding: "8px 10px",
    fontSize: 13,
  },
  addBtn: {
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.12)",
    color: "#9ad3a4",
    borderRadius: 8,
    padding: "0 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    minHeight: 36,
  },
  warn: {
    fontSize: 11,
    color: "#f1c40f",
  },
  actions: { display: "flex", gap: 8, justifyContent: "flex-end" },
  secondaryBtn: {
    border: "1px solid #444",
    background: "#1a1a1a",
    color: "#bdbdbd",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 8,
    background: "linear-gradient(145deg,#2ecc71,#27ae60)",
    color: "#fff",
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
};
