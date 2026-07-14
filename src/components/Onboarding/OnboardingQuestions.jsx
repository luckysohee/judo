import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildTasteOnboardingQuestions,
  resolveOnboardingRegions,
} from "../../utils/userTasteProfile";

/**
 * 가입·첫 로그인 「당신의 취향은?」 — placeTaxonomy 표준값과 동일
 */
export default function OnboardingQuestions({
  onComplete,
  onSkip,
  onDismiss,
  initialAnswers = null,
  showSkip = true,
  completeLabel,
  modalTitle = "당신의 취향은?",
  backLabel,
  zIndex = 25000,
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(() =>
    initialAnswers && typeof initialAnswers === "object" ? { ...initialAnswers } : {}
  );

  useEffect(() => {
    setCurrentQuestion(0);
    setAnswers(
      initialAnswers && typeof initialAnswers === "object"
        ? { ...initialAnswers }
        : {}
    );
  }, [initialAnswers]);

  const questions = useMemo(() => buildTasteOnboardingQuestions(), []);
  const currentQ = questions[currentQuestion];
  const regionsSelected = Array.isArray(answers.regions) ? answers.regions : [];
  const showRegionsOtherInput =
    currentQ?.id === "regions" && regionsSelected.includes("기타");

  const handleAnswer = (questionId, value, isMultiple = false) => {
    setAnswers((prev) => {
      if (isMultiple) {
        const currentValues = prev[questionId] || [];
        const newValues = currentValues.includes(value)
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value];
        const next = { ...prev, [questionId]: newValues };
        if (questionId === "regions" && !newValues.includes("기타")) {
          delete next.regions_other;
        }
        return next;
      }
      return { ...prev, [questionId]: value };
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      return;
    }
    const out = { ...answers };
    if (out.prefer_walkable === "yes") out.prefer_walkable = true;
    else if (out.prefer_walkable === "no") out.prefer_walkable = false;
    else delete out.prefer_walkable;
    out.regions = resolveOnboardingRegions(out);
    delete out.regions_other;
    onComplete?.(out);
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  };

  const canProceed = () => {
    const question = questions[currentQuestion];
    const answer = answers[question.id];
    if (question.id === "regions") {
      const list = Array.isArray(answer) ? answer : [];
      if (list.length === 0) return false;
      if (list.includes("기타")) {
        return String(answers.regions_other || "").trim().length >= 1;
      }
      return true;
    }
    if (question.type === "single") {
      return answer != null && answer !== "";
    }
    return Array.isArray(answer) && answer.length > 0;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
        padding: 16,
      }}
    >
      <motion.div
        style={{
          backgroundColor: "rgba(18, 18, 22, 0.98)",
          borderRadius: 20,
          padding: "28px 24px 24px",
          maxWidth: 440,
          width: "100%",
          maxHeight: "min(88vh, 720px)",
          overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {onDismiss && backLabel ? (
              <button
                type="button"
                onClick={() => onDismiss()}
                style={{
                  flexShrink: 0,
                  padding: "4px 0",
                  border: "none",
                  background: "transparent",
                  color: "#3498DB",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ← {backLabel}
              </button>
            ) : null}
            <h3
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {modalTitle}
            </h3>
          </div>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, flexShrink: 0 }}>
            {currentQuestion + 1} / {questions.length}
          </span>
        </div>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.45,
          }}
        >
          맞춤 추천·코스에만 씁니다. 나중에 바꿀 수 있어요.
        </p>

        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {questions.map((_, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor:
                  index <= currentQuestion
                    ? "rgba(167, 139, 250, 0.95)"
                    : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
          >
            <h2
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 6,
                lineHeight: 1.35,
              }}
            >
              {currentQ.question}
            </h2>
            {currentQ.subtitle ? (
              <p
                style={{
                  margin: "0 0 18px",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {currentQ.subtitle}
              </p>
            ) : (
              <div style={{ height: 8 }} />
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: showRegionsOtherInput ? 12 : 28,
              }}
            >
              {currentQ.options.map((option) => {
                const isSelected =
                  currentQ.type === "single"
                    ? answers[currentQ.id] === option.value
                    : (answers[currentQ.id] || []).includes(option.value);

                return (
                  <motion.button
                    key={String(option.value)}
                    type="button"
                    onClick={() =>
                      handleAnswer(
                        currentQ.id,
                        option.value,
                        currentQ.type === "multiple"
                      )
                    }
                    style={{
                      padding: "10px 14px",
                      borderRadius: 999,
                      border: isSelected
                        ? "1.5px solid rgba(167, 139, 250, 0.9)"
                        : "1px solid rgba(255,255,255,0.16)",
                      background: isSelected
                        ? "rgba(124, 58, 237, 0.22)"
                        : "rgba(255,255,255,0.06)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {option.label}
                  </motion.button>
                );
              })}
            </div>

            {showRegionsOtherInput ? (
              <div style={{ marginBottom: 28 }}>
                <label
                  htmlFor="judo-regions-other"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  자주 가는 동네를 직접 적어 주세요
                </label>
                <input
                  id="judo-regions-other"
                  type="text"
                  value={String(answers.regions_other || "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      regions_other: e.target.value,
                    }))
                  }
                  placeholder="예: 파주, 분당, 수원"
                  autoComplete="off"
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(167, 139, 250, 0.45)",
                    background: "rgba(0,0,0,0.35)",
                    color: "#f5f5f5",
                    fontSize: 14,
                    fontWeight: 600,
                    outline: "none",
                  }}
                />
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.45)",
                    lineHeight: 1.4,
                  }}
                >
                  여러 곳이면 쉼표로 구분할 수 있어요.
                </p>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          {currentQuestion > 0 ? (
            <button
              type="button"
              onClick={handlePrevious}
              style={{
                padding: "11px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              이전
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            style={{
              padding: "11px 20px",
              borderRadius: 10,
              border: "none",
              background: canProceed()
                ? "linear-gradient(135deg, #7c3aed, #5b21b6)"
                : "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: canProceed() ? "pointer" : "not-allowed",
              marginLeft: "auto",
              opacity: canProceed() ? 1 : 0.55,
            }}
          >
            {currentQuestion === questions.length - 1
              ? completeLabel || "시작하기"
              : "다음"}
          </button>
        </div>

        {showSkip ? (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              type="button"
              onClick={() => onSkip?.()}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              나중에 할게요
            </button>
          </div>
        ) : onDismiss ? (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              type="button"
              onClick={() => onDismiss()}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              취소
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
