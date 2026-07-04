import { describe, expect, it } from "vitest";
import {
  alphaSurveyHasAnyAnswer,
  formatAlphaSurveyAnswerValue,
  normalizeAlphaSurveyAnswers,
  validateAlphaSurveyAnswers,
} from "../config/alphaSurvey.js";

describe("alphaSurvey", () => {
  it("validates required objective fields", () => {
    const errors = validateAlphaSurveyAnswers({});
    expect(errors.satisfaction).toBeTruthy();
    expect(errors.main_features).toBeTruthy();
    expect(errors.usage_context).toBeTruthy();
  });

  it("normalizes answers", () => {
    const out = normalizeAlphaSurveyAnswers({
      satisfaction: "4",
      main_features: ["search", "search", "course"],
      pain_point: "  느려요  ",
    });
    expect(out.satisfaction).toBe("4");
    expect(out.main_features).toEqual(["search", "course"]);
    expect(out.pain_point).toBe("느려요");
  });

  it("formats labels for admin display", () => {
    expect(formatAlphaSurveyAnswerValue("satisfaction", "5")).toContain("매우 만족");
    expect(
      alphaSurveyHasAnyAnswer({ satisfaction: "3", free_comment: "" })
    ).toBe(true);
  });

  it("coerces legacy single usage_context to multiple display", () => {
    expect(formatAlphaSurveyAnswerValue("usage_context", "friends")).toContain(
      "친구"
    );
    const out = normalizeAlphaSurveyAnswers({
      usage_context: "date",
    });
    expect(out.usage_context).toEqual(["date"]);
  });
});
