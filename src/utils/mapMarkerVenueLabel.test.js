import { describe, expect, it } from "vitest";
import {
  buildCourseVenueNameLabelForMarker,
  buildCourseVenueNameLabelForPhotoOverlay,
  buildCourseVenueNameLabelSvg,
  shouldShowCourseVenueNameLabel,
  wrapVenueLabelSvgForHtml,
} from "./mapMarkerVenueLabel.js";

describe("mapMarkerVenueLabel", () => {
  it("shows label for course pins including 2차 pulse candidates", () => {
    expect(
      shouldShowCourseVenueNameLabel({
        isCoursePin: true,
        courseMarkerPulse: false,
      })
    ).toBe(true);
    expect(
      shouldShowCourseVenueNameLabel({
        isCoursePin: true,
        courseMarkerPulse: true,
      })
    ).toBe(true);
    expect(shouldShowCourseVenueNameLabel({ isCoursePin: false })).toBe(false);
    expect(
      shouldShowCourseVenueNameLabel({
        courseMarkerPulse: true,
        name: "펄스만",
      })
    ).toBe(true);
    expect(
      shouldShowCourseVenueNameLabel({
        isListSpreadPin: true,
        name: "맛집첩",
      })
    ).toBe(true);
  });

  it("centers wide venue labels inside marker svg", () => {
    const longName = "성수동길골목포장마차";
    const { svg, totalW } = buildCourseVenueNameLabelForMarker(19, 40, {
      isCoursePin: true,
      name: longName,
    }, 38);
    expect(totalW).toBeGreaterThan(38);
    expect(svg).toContain(longName.slice(0, 14));
    const rectX = svg.match(/<rect[^>]*x="([^"]+)"/)?.[1];
    expect(Number(rectX)).toBeGreaterThanOrEqual(0);
  });

  it("renders pulse candidate venue name", () => {
    const { svg, height } = buildCourseVenueNameLabelSvg(20, 40, {
      isCoursePin: true,
      courseMarkerPulse: true,
      place_name: "골목 포장마차",
    });
    expect(height).toBeGreaterThan(0);
    expect(svg).toContain("골목 포장마차");
  });

  it("1차 상호 라벨 — 빨간 배경", () => {
    const { svg } = buildCourseVenueNameLabelSvg(20, 40, {
      isCoursePin: true,
      courseMapCaption: "1차",
      courseStepIndex: 1,
      name: "테스트 상호",
    });
    expect(svg).toContain("#dc2626");
    expect(svg).not.toContain("rgba(15,23,42,0.92)");
  });

  it("2차 상호 라벨 — 기본 배경", () => {
    const { svg } = buildCourseVenueNameLabelSvg(20, 40, {
      isCoursePin: true,
      courseMapCaption: "2차",
      courseStepIndex: 2,
      name: "2차집",
    });
    expect(svg).toContain("rgba(15,23,42,0.92)");
    expect(svg).not.toContain("#dc2626");
  });

  it("wraps venue label svg for html overlay", () => {
    const { svg, height, width, totalW } = buildCourseVenueNameLabelForPhotoOverlay(
      40,
      {
        isCoursePin: true,
        courseMarkerPulse: true,
        name: "골목 포장마차",
      }
    );
    const wrapped = wrapVenueLabelSvgForHtml({ svg, width, height, totalW });
    expect(wrapped).toContain('viewBox="0 0');
    expect(wrapped).toContain('font-size="10"');
    expect(wrapped).toContain("골목 포장마차");
  });

  it("renders venue name svg", () => {
    const { svg, height, width } = buildCourseVenueNameLabelSvg(20, 40, {
      isCoursePin: true,
      name: "테스트 상호",
    });
    expect(height).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
    expect(svg).toContain("테스트 상호");
  });
});
