import { describe, it, expect } from "vitest";
import {
  HOME_SEARCH_KIND,
  detectHomeSearchExecutionKind,
} from "./searchParser.js";
import { SEARCH_KIND_EDGE_FIXTURES } from "./searchKindEdgeFixtures.js";
import {
  summarizeSearchResultQualityForTelemetry,
  deriveSearchClickPath,
} from "./searchBranchTelemetry.js";

describe("detectHomeSearchExecutionKind", () => {
  describe("keyword_search (짧은 지역+명사 조합)", () => {
    it.each([
      "을지로 와인바",
      "성수 이자카야",
      "강남 야장",
      "한남 소개팅",
      "을지로 2차",
    ])("%s", (q) => {
      expect(detectHomeSearchExecutionKind(q, null)).toBe(
        HOME_SEARCH_KIND.KEYWORD_SEARCH
      );
    });
  });

  describe("ai_parse_search (문장·조건·서술)", () => {
    it.each([
      "을지로에서 분위기 좋은 와인바",
      "성수에서 2차 가기 좋은 곳",
      "조용하게 대화할 수 있는 바",
      "소개팅 끝나고 가기 좋은 곳",
      "오늘 비오는데 실내에서 한잔할만한 곳",
    ])("%s", (q) => {
      expect(detectHomeSearchExecutionKind(q, null)).toBe(
        HOME_SEARCH_KIND.AI_PARSE_SEARCH
      );
    });
  });

  it("을지로 노포는 vibe 꼬리라 AI (키워드 명사 조합 예외)", () => {
    expect(detectHomeSearchExecutionKind("을지로 노포", null)).toBe(
      HOME_SEARCH_KIND.AI_PARSE_SEARCH
    );
  });

  it("naturalQ가 길어도 원문이 짧은 명사 조합이면 query 우선 → keyword", () => {
    const naturalQ = {
      tags: ["a", "b", "c", "d"],
      remainingText: "",
      curator: null,
      sortBySaved: false,
    };
    expect(detectHomeSearchExecutionKind("성수 와인바", naturalQ)).toBe(
      HOME_SEARCH_KIND.KEYWORD_SEARCH
    );
  });

  it("summarizeSearchResultQualityForTelemetry — 상위 aiScore 평균", () => {
    const q = summarizeSearchResultQualityForTelemetry([
      { aiScore: 10 },
      { aiScore: 20 },
      { aiScore: 30 },
    ]);
    expect(q.qualitySampleSize).toBe(3);
    expect(q.qualityAvgTopScore).toBe(20);
    expect(q.qualityTopMaxScore).toBe(30);
  });

  it("deriveSearchClickPath — 검색 소스 + 세션 일치 시만", () => {
    const snap = {
      sessionId: "s1",
      initialKind: HOME_SEARCH_KIND.KEYWORD_SEARCH,
      fallbackTriggered: true,
    };
    expect(
      deriveSearchClickPath("search_bar_submit_map", "s1", snap)
    ).toBe("keyword_fallback");
    expect(deriveSearchClickPath("recommend_list", "s1", snap)).toBe(null);
    expect(deriveSearchClickPath("search_result", "s2", snap)).toBe(null);
  });

  describe("SEARCH_KIND_EDGE_FIXTURES (expectedKind 있는 항목만)", () => {
    for (const row of SEARCH_KIND_EDGE_FIXTURES) {
      if (row.expectedKind == null) continue;
      it(`${row.id}: ${row.query}`, () => {
        expect(detectHomeSearchExecutionKind(row.query, null)).toBe(
          row.expectedKind
        );
      });
    }
  });
});
