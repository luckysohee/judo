import { describe, expect, it } from "vitest";
import {
  attachBlogInsightToCourseHit,
  blogInsightToCourseEvidence,
  mergeCourseDiscoveryPlaces,
  planCoursePlaceSearchPhrases,
  rankCoursePlacesByDiscoveryEvidence,
} from "./coursePlaceDiscovery.js";
import { curatorNoteForCourseDraft } from "./compactPlacesForCourseDraftAssist.js";

describe("coursePlaceDiscovery", () => {
  it("blogInsight를 comment·tags 근거로 변환한다", () => {
    const { commentBits, tags } = blogInsightToCourseEvidence({
      summary: "골목 안 오래된 포차",
      atmosphere: ["빈티지"],
      menu: ["막걸리"],
      drink: ["막걸리"],
      reviewCount: 3,
    });
    expect(commentBits.some((b) => /골목/.test(b))).toBe(true);
    expect(tags).toContain("막걸리");
    expect(commentBits.some((b) => /후기 3건/.test(b))).toBe(true);
  });

  it("코스 히트에 블로그 근거를 붙인다", () => {
    const hit = attachBlogInsightToCourseHit(
      { id: "1", name: "필동포차", comment: "" },
      {
        blogInsight: {
          summary: "현지인 단골 많음",
          atmosphere: ["노포"],
          menu: [],
          drink: ["막걸리"],
          reviewCount: 2,
        },
      }
    );
    expect(hit.hasBlogEvidence).toBe(true);
    expect(hit.comment).toMatch(/현지인/);
    expect(hit.tags).toContain("노포");
  });

  it("AI·규칙으로 검색 phrase를 모은다 (노포는 bare 술집 제외)", () => {
    const phrases = planCoursePlaceSearchPhrases(
      "충무로 노포 술집 코스",
      { area: "충무로" },
      {
        kakaoKeywordHint: "충무로 노포",
        broadKakaoKeyword: "충무로 포차",
        fallbackSearchIdeas: ["필동 막걸리", "인현동 포차"],
      }
    );
    expect(phrases.some((p) => /노포|포차|막걸리/.test(p))).toBe(true);
    expect(phrases).toContain("필동 막걸리");
    expect(
      phrases.some((p) => /^충무로 술집$/i.test(p) || /충무로 술집$/.test(p))
    ).toBe(false);
  });

  it("블로그 근거 있는 후보를 앞에 둔다", () => {
    const ranked = rankCoursePlacesByDiscoveryEvidence([
      { id: "a", name: "일반", comment: "" },
      {
        id: "b",
        name: "블로그집",
        hasBlogEvidence: true,
        comment: "후기 요약",
      },
    ]);
    expect(ranked[0].id).toBe("b");
  });

  it("merge 시 블로그 근거를 기존 히트에 보강한다", () => {
    const keyFn = (p) => String(p.id);
    const merged = mergeCourseDiscoveryPlaces(
      keyFn,
      [{ id: "1", name: "A", comment: "" }],
      [
        attachBlogInsightToCourseHit(
          { id: "1", name: "A" },
          {
            blogInsight: {
              summary: "블로그 한줄",
              atmosphere: [],
              menu: ["전"],
              drink: [],
              reviewCount: 1,
            },
          }
        ),
      ]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].hasBlogEvidence).toBe(true);
    expect(merged[0].comment).toMatch(/블로그/);
  });

  it("compact용 note에 블로그 요약을 넣는다", () => {
    const note = curatorNoteForCourseDraft({
      comment: "큐레이터 메모",
      blogInsight: {
        summary: "웨이팅 있음",
        atmosphere: ["시끌"],
        menu: [],
        drink: [],
        reviewCount: 1,
      },
    });
    expect(note).toMatch(/큐레이터/);
    expect(note).toMatch(/웨이팅/);
  });
});
