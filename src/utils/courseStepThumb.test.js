import { describe, expect, it, vi } from "vitest";
import {
  courseCoverInputFromPlaceRow,
  pickCourseDisplayCoverUrl,
  pickStepUploadedThumb,
  previewStepFromCoursePlaceRow,
  resolveCourseCoverFromFirstPlace,
  stepThumbKey,
} from "./courseStepThumb";
import { getKakaoPlaceBasicInfoViaProxy } from "./kakaoAPIProxy";

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

  it("courseCoverInputFromPlaceRow maps editor row", () => {
    expect(
      courseCoverInputFromPlaceRow({
        place_id: "p1",
        place_name: "바",
        place_address: "서울",
        place_lat: 37.5,
        place_lng: 127,
        kakao_place_id: "k123",
      })
    ).toMatchObject({
      place_id: "p1",
      name: "바",
      kakao_place_id: "k123",
    });
  });

  it("resolveCourseCoverFromFirstPlace uses kakao thumbnail", async () => {
    getKakaoPlaceBasicInfoViaProxy.mockResolvedValueOnce({
      thumbnail_url: "https://kakao.example/thumb.jpg",
    });
    await expect(
      resolveCourseCoverFromFirstPlace({
        place_name: "바",
        kakao_place_id: "k123",
      })
    ).resolves.toBe("https://kakao.example/thumb.jpg");
  });

  it("pickCourseDisplayCoverUrl falls back to first step upload", () => {
    expect(
      pickCourseDisplayCoverUrl({
        cover_image_url: "",
        preview_steps: [
          { step_image_url: "https://cdn.example/step.jpg" },
        ],
      })
    ).toBe("https://cdn.example/step.jpg");
  });
});

vi.mock("./kakaoAPIProxy.js", () => ({
  getKakaoPlaceBasicInfoViaProxy: vi.fn(),
}));
