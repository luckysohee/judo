import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  liquorOptionsForOnboarding,
  TASTE_PARTY_SIZE_OPTIONS,
  TASTE_REGION_OPTIONS,
  TASTE_SITUATION_OPTIONS,
  vibeOptionsForOnboarding,
} from "../../utils/userTasteProfile";

/**
 * 가입·첫 로그인 「당신의 취향은?」 — placeTaxonomy 표준값과 동일
 */
export default function OnboardingQuestions({ onComplete, onSkip }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});

  const questions = useMemo(
    () => [
      {
        id: "liquor_types",
        question: "어떤 술을 즐겨 마시나요?",
        subtitle: "복수 선택 가능",
        type: "multiple",
        options: liquorOptionsForOnboarding(),
      },
      {
        id: "vibes",
        question: "어떤 분위기를 좋아하나요?",
        subtitle: "복수 선택 가능",
        type: "multiple",
        options: vibeOptionsForOnboarding(),
      },
      {
        id: "situation",
        question: "보통 어떤 상황으로 나가시나요?",
        type: "single",
        options: TASTE_SITUATION_OPTIONS,
      },
      {
        id: "party_size",
        question: "보통 몇 명이서 가시나요?",
        type: "single",
        options: TASTE_PARTY_SIZE_OPTIONS,
      },
      {
        id: "regions",
        question: "자주 가는 동네는 어디인가요?",
        subtitle: "복수 선택 가능",
        type: "multiple",
        options: TASTE_REGION_OPTIONS.map((value) => ({
          value,
          label: value === "기타" ? "📍 그 외" : `📍 ${value}`,
        })),
      },
      {
        id: "prefer_walkable",
        question: "1·2차는 걸어서 갈 수 있는 곳이 좋나요?",
        type: "single",
        options: [
          { value: "yes", label: "🚶 네, 가까운 곳 위주" },
          { value: "no", label: "🚕 거리는 상관없어요" },
        ],
      },
    ],
    []
  );

  const handleAnswer = (questionId, value, isMultiple = false) => {
    setAnswers((prev) => {
      if (isMultiple) {
        const currentValues = prev[questionId] || [];
        const newValues = currentValues.includes(value)
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value];
        return { ...prev, [questionId]: newValues };
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
    onComplete?.(out);
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  };

  const canProceed = () => {
    const question = questions[currentQuestion];
    const answer = answers[question.id];
    if (question.type === "single") {
      return answer != null && answer !== "";
    }
    return Array.isArray(answer) && answer.length > 0;
  };

  const currentQ = questions[currentQuestion];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 25000,
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
          }}
        >
          <h3
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              margin: 0,
            }}
          >
            당신의 취향은?
          </h3>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
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
                marginBottom: 28,
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
            }}
          >
            {currentQuestion === questions.length - 1 ? "시작하기" : "다음"}
          </button>
        </div>

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
      </motion.div>
    </div>
  );
}
