import { describe, expect, it } from "vitest";
import {
  MAP_PHOTO_CIRCLE_MARKER_MAX_LEVEL,
  resolvePlaceMarkerPhotoUrl,
  shouldUsePhotoCircleMarker,
} from "./mapPhotoCircleMarker.js";

describe("mapPhotoCircleMarker", () => {
  it("코스 스텝 썸네일 URL을 찾는다", () => {
    expect(
      resolvePlaceMarkerPhotoUrl({
        courseStepThumbUrl: "https://cdn.example/a.jpg",
      })
    ).toBe("https://cdn.example/a.jpg");
  });

  it("코스 핀은 사진이 있으면 항상 사진 마커", () => {
    expect(
      shouldUsePhotoCircleMarker(
        {
          isCoursePin: true,
          courseStepThumbUrl: "https://cdn.example/step.jpg",
        },
        { mapZoomLevel: 8 }
      )
    ).toBe(true);
  });

  it("맛집첩 펼침 핀은 줌·사진 유무와 무관하게 원형 마커", () => {
    expect(
      shouldUsePhotoCircleMarker(
        {
          isListSpreadPin: true,
          image_url: "https://cdn.example/list.jpg",
        },
        { mapZoomLevel: 8 }
      )
    ).toBe(true);
    expect(
      shouldUsePhotoCircleMarker(
        { isListSpreadPin: true, name: "금목" },
        { mapZoomLevel: 8 }
      )
    ).toBe(true);
  });

  it("큐레이터 픽은 줌 인(level<=6) 또는 선택 시에만 사진 마커", () => {
    const place = {
      curatorCount: 1,
      image_url: "https://cdn.example/place.jpg",
    };
    expect(
      shouldUsePhotoCircleMarker(place, {
        mapZoomLevel: MAP_PHOTO_CIRCLE_MARKER_MAX_LEVEL + 1,
      })
    ).toBe(false);
    expect(
      shouldUsePhotoCircleMarker(place, {
        mapZoomLevel: MAP_PHOTO_CIRCLE_MARKER_MAX_LEVEL,
      })
    ).toBe(true);
    expect(
      shouldUsePhotoCircleMarker(place, {
        isSelected: true,
        mapZoomLevel: 8,
      })
    ).toBe(true);
  });

  it("사진 URL이 없으면 사진 마커를 쓰지 않는다", () => {
    expect(
      shouldUsePhotoCircleMarker(
        { curatorCount: 2, name: "술집" },
        { mapZoomLevel: 4, isSelected: true }
      )
    ).toBe(false);
  });
});
