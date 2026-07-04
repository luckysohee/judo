import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../Toast/ToastProvider";
import {
  fetchAlphaSurveyResponse,
  isAlphaSurveySubmitted,
  saveAlphaSurveyDraft,
  submitAlphaSurveyResponse,
} from "../../api/alphaSurvey";
import {
  ALPHA_SURVEY_QUESTIONS,
  alphaSurveyHasAnyAnswer,
  normalizeAlphaSurveyAnswers,
  validateAlphaSurveyAnswers,
} from "../../config/alphaSurvey";

const SHEET_Z = 28000;
const DRAFT_DEBOUNCE_MS = 1200;

/**
 * 홈 지도 우측 — 알파 피드백 설문 재진입 칩
 */
export function AlphaSurveyEntryChip({
  visible = false,
  onOpen,
  filled = false,
  buttonStyle = {},
  labelStyle = {},
}) {
  if (!visible || typeof onOpen !== "function") return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="알파 피드백 설문"
      title="알파 피드백 — 의견 남기기"
      style={buttonStyle}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 0,
          fontSize: 11,
        }}
        aria-hidden
      >
        {filled ? "✅" : "📝"}
      </span>
      <span style={labelStyle}>피드백</span>
    </button>
  );
}

/**
 * @param {{
 *   open?: boolean,
 *   onClose?: () => void,
 *   userId?: string|null,
 *   onSaved?: () => void,
 *   onDraftSaved?: () => void,
 * }} props
 */
export default function AlphaSurveySheet({
  open = false,
  onClose,
  userId,
  onSaved,
  onDraftSaved,
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [draftStatus, setDraftStatus] = useState("idle");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const answersRef = useRef(answers);
  const baselineJsonRef = useRef("");
  const draftTimerRef = useRef(null);

  answersRef.current = answers;

  const answersFingerprint = useCallback((value) => {
    return JSON.stringify(normalizeAlphaSurveyAnswers(value));
  }, []);

  useEffect(() => {
    if (!open || !userId) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setDraftStatus("idle");
      try {
        const row = await fetchAlphaSurveyResponse(userId);
        if (cancelled) return;
        const loaded =
          row?.answers && typeof row.answers === "object"
            ? { ...row.answers }
            : {};
        setAnswers(loaded);
        baselineJsonRef.current = answersFingerprint(loaded);
        setIsSubmitted(isAlphaSurveySubmitted(row));
        setErrors({});
        setLoadedOnce(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId, answersFingerprint]);

  useEffect(() => {
    if (!open) {
      setLoadedOnce(false);
      setDraftStatus("idle");
    }
  }, [open]);

  const persistDraft = useCallback(
    async (snapshot) => {
      if (!userId) return;
      const normalized = normalizeAlphaSurveyAnswers(snapshot);
      if (!alphaSurveyHasAnyAnswer(normalized)) return;

      const fp = answersFingerprint(snapshot);
      if (fp === baselineJsonRef.current) return;

      setDraftStatus("saving");
      const { error } = await saveAlphaSurveyDraft(userId, snapshot);
      if (error) {
        setDraftStatus("error");
        return;
      }
      baselineJsonRef.current = fp;
      setIsSubmitted(false);
      setDraftStatus("saved");
      onDraftSaved?.();
    },
    [answersFingerprint, onDraftSaved, userId]
  );

  const flushDraft = useCallback(async () => {
    if (draftTimerRef.current) {
      window.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    await persistDraft(answersRef.current);
  }, [persistDraft]);

  useEffect(() => {
    if (!open || !loadedOnce || !userId) return undefined;

    const fp = answersFingerprint(answers);
    if (fp === baselineJsonRef.current) return undefined;

    draftTimerRef.current = window.setTimeout(() => {
      void persistDraft(answers);
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (draftTimerRef.current) {
        window.clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
    };
  }, [answers, answersFingerprint, loadedOnce, open, persistDraft, userId]);

  const handleClose = useCallback(async () => {
    await flushDraft();
    onClose?.();
  }, [flushDraft, onClose]);

  const handlePick = useCallback((questionId, value, isMultiple = false) => {
    setAnswers((prev) => {
      if (isMultiple) {
        const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: value };
    });
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  const handleText = useCallback((questionId, value, maxLength) => {
    const text = String(value ?? "").slice(0, maxLength || 2000);
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!userId || submitting) return;
    const nextErrors = validateAlphaSurveyAnswers(answers);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      showToast("필수 항목을 확인해 주세요.", "error", 2600);
      return;
    }

    setSubmitting(true);
    try {
      if (draftTimerRef.current) {
        window.clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
      const { error } = await submitAlphaSurveyResponse(userId, answers);
      if (error) {
        showToast("제출에 실패했어요. 잠시 후 다시 시도해 주세요.", "error", 3200);
        return;
      }
      baselineJsonRef.current = answersFingerprint(answers);
      setIsSubmitted(true);
      setDraftStatus("saved");
      showToast("피드백을 제출했어요. 감사합니다!", "success", 2600);
      onSaved?.();
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    answersFingerprint,
    onClose,
    onSaved,
    showToast,
    submitting,
    userId,
  ]);

  const hasAnyAnswer = useMemo(() => alphaSurveyHasAnyAnswer(answers), [answers]);

  const draftHint = useMemo(() => {
    if (draftStatus === "saving") return "임시 저장 중…";
    if (draftStatus === "error") return "임시 저장 실패 — 네트워크 확인";
    if (draftStatus === "saved" && hasAnyAnswer && !isSubmitted) {
      return "작성 내용이 자동 저장됐어요";
    }
    if (isSubmitted) return "제출 완료 — 수정 후 다시 제출할 수 있어요";
    return "입력하면 자동으로 임시 저장돼요";
  }, [draftStatus, hasAnyAnswer, isSubmitted]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alpha-survey-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: SHEET_Z,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) void handleClose();
      }}
    >
      <div
        style={{
          maxHeight: "min(88dvh, 720px)",
          borderRadius: "18px 18px 0 0",
          background: "rgba(16, 16, 20, 0.98)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderBottom: "none",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id="alpha-survey-title"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              알파 피드백
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              주관·객관 혼합 설문이에요. 입력 내용은 자동 저장되고, 마지막에 제출해
              주세요.
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                lineHeight: 1.4,
                color:
                  draftStatus === "error"
                    ? "#ff8a8a"
                    : "rgba(251, 191, 36, 0.82)",
              }}
            >
              {draftHint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            aria-label="닫기"
            style={{
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "12px 16px 8px",
          }}
        >
          {loading && !loadedOnce ? (
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
              불러오는 중…
            </p>
          ) : (
            ALPHA_SURVEY_QUESTIONS.map((q) => (
              <section key={q.id} style={{ marginBottom: 22 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.4,
                    marginBottom: q.subtitle ? 4 : 10,
                  }}
                >
                  {q.question}
                  {q.required ? (
                    <span style={{ color: "#f59e0b", marginLeft: 4 }}>*</span>
                  ) : null}
                </div>
                {q.subtitle ? (
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {q.subtitle}
                  </p>
                ) : null}

                {q.type === "text" ? (
                  <textarea
                    value={String(answers[q.id] ?? "")}
                    onChange={(e) =>
                      handleText(q.id, e.target.value, q.maxLength)
                    }
                    placeholder={q.placeholder || ""}
                    rows={3}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#fff",
                      fontSize: 13,
                      lineHeight: 1.5,
                      padding: "10px 12px",
                      resize: "vertical",
                      minHeight: 72,
                    }}
                  />
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(q.options || []).map((opt) => {
                      const selected =
                        q.type === "multiple"
                          ? (answers[q.id] || []).includes(opt.value)
                          : answers[q.id] === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() =>
                            handlePick(q.id, opt.value, q.type === "multiple")
                          }
                          style={{
                            padding:
                              q.id === "recommend_score"
                                ? "8px 10px"
                                : "9px 12px",
                            borderRadius: q.id === "recommend_score" ? 8 : 999,
                            minWidth: q.id === "recommend_score" ? 36 : undefined,
                            border: selected
                              ? "1.5px solid rgba(251, 191, 36, 0.9)"
                              : "1px solid rgba(255,255,255,0.16)",
                            background: selected
                              ? "rgba(245, 158, 11, 0.18)"
                              : "rgba(255,255,255,0.06)",
                            color: "#fff",
                            fontSize: q.id === "recommend_score" ? 12 : 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {errors[q.id] ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#ff8a8a",
                    }}
                  >
                    {errors[q.id]}
                  </div>
                ) : null}
              </section>
            ))
          )}
        </div>

        <div
          style={{
            padding: "10px 16px 4px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => void handleClose()}
            style={{
              flex: "0 0 auto",
              padding: "11px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "transparent",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || loading}
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 10,
              border: "none",
              background: submitting
                ? "rgba(255,255,255,0.2)"
                : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#111",
              fontSize: 14,
              fontWeight: 800,
              cursor: submitting || loading ? "wait" : "pointer",
            }}
          >
            {submitting ? "제출 중…" : "제출하기"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
