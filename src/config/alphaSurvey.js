/** 알파 피드백 설문 정의 — `survey_version` 과 함께 저장 */

export const ALPHA_SURVEY_VERSION = "v1";

/**
 * @typedef {'single' | 'multiple' | 'text'} AlphaSurveyQuestionType
 * @typedef {{ value: string|number, label: string }} AlphaSurveyOption
 * @typedef {{
 *   id: string,
 *   type: AlphaSurveyQuestionType,
 *   question: string,
 *   subtitle?: string,
 *   required?: boolean,
 *   options?: AlphaSurveyOption[],
 *   placeholder?: string,
 *   maxLength?: number,
 * }} AlphaSurveyQuestion
 */

/** @type {AlphaSurveyQuestion[]} */
export const ALPHA_SURVEY_QUESTIONS = [
  {
    id: "satisfaction",
    type: "single",
    required: true,
    question: "지금까지 주도를 쓰면서 전반적으로 만족하나요?",
    options: [
      { value: "5", label: "😍 매우 만족" },
      { value: "4", label: "🙂 만족" },
      { value: "3", label: "😐 보통" },
      { value: "2", label: "😕 아쉬움" },
      { value: "1", label: "😣 불만족" },
    ],
  },
  {
    id: "use_frequency",
    type: "single",
    required: true,
    question: "얼마나 자주 쓰고 있나요?",
    options: [
      { value: "daily", label: "거의 매일" },
      { value: "weekly", label: "주 2~3회" },
      { value: "sometimes", label: "가끔" },
      { value: "first", label: "이번이 처음이에요" },
    ],
  },
  {
    id: "main_features",
    type: "multiple",
    required: true,
    question: "주로 어떤 기능을 쓰나요?",
    subtitle: "복수 선택",
    options: [
      { value: "search", label: "🔍 검색·추천" },
      { value: "course", label: "🗺️ 코스 짜기" },
      { value: "curator", label: "⭐ 큐레이터 픽" },
      { value: "save", label: "📁 저장·폴더" },
      { value: "checkin", label: "📍 체크인" },
      { value: "browse", label: "👀 구경만" },
    ],
  },
  {
    id: "usage_context",
    type: "multiple",
    required: true,
    question: "주로 어떤 상황에서 쓰나요?",
    subtitle: "복수 선택",
    options: [
      { value: "solo", label: "혼자 밖에서" },
      { value: "friends", label: "친구·지인과" },
      { value: "date", label: "데이트" },
      { value: "work", label: "업무·미팅" },
      { value: "planning", label: "나중에 갈 곳 찾기" },
    ],
  },
  {
    id: "recommend_score",
    type: "single",
    required: true,
    question: "주변에 추천할 의향이 있나요?",
    subtitle: "0 = 전혀 없음 · 10 = 적극 추천",
    options: [
      { value: "0", label: "0" },
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5" },
      { value: "6", label: "6" },
      { value: "7", label: "7" },
      { value: "8", label: "8" },
      { value: "9", label: "9" },
      { value: "10", label: "10" },
    ],
  },
  {
    id: "pain_point",
    type: "text",
    question: "가장 불편했거나 아쉬운 점은?",
    placeholder: "버그, 속도, 이해 안 되는 UI 등 자유롭게",
    maxLength: 800,
  },
  {
    id: "favorite_part",
    type: "text",
    question: "가장 마음에 든 점은?",
    placeholder: "좋았던 기능·경험을 적어주세요",
    maxLength: 800,
  },
  {
    id: "free_comment",
    type: "text",
    question: "하고 싶은 말 (선택)",
    placeholder: "추가 의견·아이디어",
    maxLength: 1200,
  },
];

const QUESTION_BY_ID = Object.fromEntries(
  ALPHA_SURVEY_QUESTIONS.map((q) => [q.id, q])
);

/**
 * @param {Record<string, unknown>} answers
 */
export function validateAlphaSurveyAnswers(answers) {
  /** @type {Record<string, string>} */
  const errors = {};

  for (const q of ALPHA_SURVEY_QUESTIONS) {
    if (!q.required) continue;
    const raw = answers[q.id];
    if (q.type === "multiple") {
      if (!Array.isArray(raw) || raw.length === 0) {
        errors[q.id] = "한 가지 이상 선택해 주세요.";
      }
      continue;
    }
    if (q.type === "text") continue;
    if (raw == null || String(raw).trim() === "") {
      errors[q.id] = "선택해 주세요.";
    }
  }

  return errors;
}

/**
 * @param {string} questionId
 * @param {unknown} value
 */
export function formatAlphaSurveyAnswerValue(questionId, value) {
  const q = QUESTION_BY_ID[questionId];
  if (!q) return String(value ?? "");

  if (q.type === "text") {
    return String(value ?? "").trim() || "—";
  }

  if (q.type === "multiple") {
    const vals = Array.isArray(value)
      ? value
      : value != null && String(value).trim()
        ? [String(value).trim()]
        : [];
    return (
      vals
        .map((v) => q.options?.find((o) => String(o.value) === String(v))?.label)
        .filter(Boolean)
        .join(", ") || "—"
    );
  }

  const opt = q.options?.find((o) => String(o.value) === String(value));
  return opt?.label || String(value ?? "—");
}

/**
 * @param {Record<string, unknown>|null|undefined} answers
 * @returns {{ questionId: string, label: string, value: string }[]}
 */
export function formatAlphaSurveyAnswersForDisplay(answers) {
  return ALPHA_SURVEY_QUESTIONS.map((q) => ({
    questionId: q.id,
    label: q.question,
    value: formatAlphaSurveyAnswerValue(q.id, answers?.[q.id]),
  })).filter((row) => row.value !== "—" || QUESTION_BY_ID[row.questionId]?.required);
}

/**
 * @param {Record<string, unknown>|null|undefined} answers
 */
export function alphaSurveyHasAnyAnswer(answers) {
  if (!answers || typeof answers !== "object") return false;
  return ALPHA_SURVEY_QUESTIONS.some((q) => {
    const v = answers[q.id];
    if (q.type === "multiple") return Array.isArray(v) && v.length > 0;
    if (q.type === "text") return String(v ?? "").trim().length > 0;
    return v != null && String(v).trim() !== "";
  });
}

/**
 * @param {Record<string, unknown>|null|undefined} answers
 */
export function normalizeAlphaSurveyAnswers(answers) {
  const src = answers && typeof answers === "object" ? answers : {};
  /** @type {Record<string, unknown>} */
  const out = {};

  for (const q of ALPHA_SURVEY_QUESTIONS) {
    const raw = src[q.id];
    if (q.type === "multiple") {
      const list = Array.isArray(raw)
        ? raw.map((v) => String(v ?? "").trim()).filter(Boolean)
        : raw != null && String(raw).trim()
          ? [String(raw).trim()]
          : [];
      if (list.length) out[q.id] = [...new Set(list)];
      continue;
    }
    if (q.type === "text") {
      const text = String(raw ?? "").trim();
      if (text) out[q.id] = text.slice(0, q.maxLength || 2000);
      continue;
    }
    if (raw != null && String(raw).trim() !== "") {
      out[q.id] = String(raw).trim();
    }
  }

  return out;
}
