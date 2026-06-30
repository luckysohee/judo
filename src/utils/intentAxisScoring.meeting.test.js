import { describe, expect, it } from "vitest";
import {
  applyIntentAxisScoresWithSignals,
  classifyCategory,
  detectIntents,
} from "./intentAxisScoring.js";
import { parseSearchQuery } from "./searchParser.js";

function scoreFor(query, place, base = 10) {
  const intent = detectIntents(query);
  const cat = classifyCategory(place);
  return applyIntentAxisScoresWithSignals(intent, cat, base);
}

describe("미팅(업무미팅) 의도", () => {
  it("detectIntents가 미팅·업무미팅·회의·비즈니스를 잡는다", () => {
    expect(detectIntents("을지로 업무 미팅 괜찮은 장소 추천").meeting).toBe(true);
    expect(detectIntents("(업무)미팅 종로 추천").meeting).toBe(true);
    expect(detectIntents("강남 비즈니스 회의 장소").meeting).toBe(true);
    // 회식은 미팅으로 오탐하지 않아야 함
    expect(detectIntents("회식 고기집").meeting).toBe(false);
  });

  it("parseSearchQuery가 미팅을 purpose(situation)로 인식한다", () => {
    const parsed = parseSearchQuery("을지로 업무미팅 괜찮은 장소 추천");
    expect(parsed.situations).toContain("미팅");
    expect(parsed.regions).toContain("을지로");
  });

  it("미팅 질의에서 한정식·다이닝이 시끌 유흥 업종보다 점수가 높다", () => {
    const q = "을지로 업무 미팅 괜찮은 장소 추천";
    const dining = scoreFor(q, {
      category_name: "음식점 > 한식 > 한정식",
      place_name: "을지로 한정식집",
    });
    const noraebang = scoreFor(q, {
      category_name: "유흥 > 노래방",
      place_name: "을지로 코인노래방",
    });
    expect(dining.score).toBeGreaterThan(noraebang.score);
    expect(dining.signals.meeting_dining).toBeGreaterThan(0);
    expect(noraebang.signals.penalty_meeting_loud).toBeLessThan(0);
  });

  it("미팅 질의에서 조용한 카페가 가산된다", () => {
    const q = "종로 미팅 장소 추천";
    const cafe = scoreFor(q, {
      category_name: "카페 > 커피전문점",
      place_name: "종로 북카페",
    });
    expect(cafe.signals.meeting_cafe).toBeGreaterThan(0);
  });
});
