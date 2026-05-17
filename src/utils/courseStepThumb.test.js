import { describe, expect, it, vi } from "vitest";
import {
  pickStepUploadedThumb,
  previewStepFromCoursePlaceRow,
  stepThumbKey,
} from "./courseStepThumb";

describe("courseStepThumb", () => {
  it("pickStepUploadedThumb prefers step_image_url", () => {
    expect(
      pickStepUploadedThumb({
        step_image_url: "https://cdn.example/a.jpg",
      })
    ).toBe("https://cdn.example/a.jpg");
    expect(pickStepUploadedThumb({ image_url: "http://x/y.png" })).toBe(
      "http://x/y.png"
    );
    expect(pickStepUploadedThumb({ step_image_url: "not-a-url" })).toBeNull();
  });

  it("previewStepFromCoursePlaceRow maps nested place", () => {
    const step = previewStepFromCoursePlaceRow(
      {
        place_id: "p1",
        image_url: "https://cdn.example/step.jpg",
        places: {
          name: "행복빵집",
          category: "베이커리",
          lat: 37.5,
          lng: 127.0,
          kakao_place_id: "k1",
        },
      },
      0
    );
    expect(step).toMatchObject({
      order: 1,
      label: "1차",
      place_id: "p1",
      name: "행복빵집",
      step_image_url: "https://cdn.example/step.jpg",
      kakao_place_id: "k1",
    });
  });

  it("stepThumbKey uses place_id", () => {
    expect(stepThumbKey({ place_id: "abc" }, 0)).toBe("abc");
  });
});

vi.mock("./kakaoAPIProxy.js", () => ({
  getKakaoPlaceBasicInfoViaProxy: vi.fn(),
}));
