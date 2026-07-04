import { describe, expect, it } from "vitest";
import {
  curatorMetaTextForTasteBlob,
  liftCuratorCatalogMeta,
} from "./curatorPlaceMetaLift.js";
import { scoreTasteProfileForSearch } from "./userTasteProfile.js";
import { tasteRowFromOnboardingAnswers } from "./userTasteProfile.js";

describe("curatorPlaceMetaLift", () => {
  it("lifts places.one_line_review and curator_places.one_line_reason", () => {
    const meta = liftCuratorCatalogMeta({
      curatorPlaces: [
        {
          one_line_reason: "연남 데이트용 조용한 와인바",
          alcohol_types: ["와인"],
          places: {
            recommended_menu: "오늘의 글라스",
            visit_situations: ["데이트"],
          },
        },
      ],
      curatorReasons: { humble: "연남 데이트용 조용한 와인바" },
    });
    expect(meta.one_line_review).toContain("연남");
    expect(meta.recommended_menu).toBe("오늘의 글라스");
    expect(meta.visit_situations).toContain("데이트");
    expect(meta.alcohol_types).toContain("와인");
  });

  it("feeds taste scoring via blob for legacy curatorReasons-only rows", () => {
    const profile = tasteRowFromOnboardingAnswers(
      { liquor_types: ["와인"], regions: ["연남"], situation: "date" },
      "u"
    );
    const place = {
      name: "카카오 POI",
      address_name: "연남동",
      curatorReasons: {
        curator: "조용한 와인바, 데이트하기 좋음",
      },
      curatorPlaces: [
        {
          one_line_reason: "조용한 와인바, 데이트하기 좋음",
          alcohol_types: ["와인"],
        },
      ],
    };
    const lifted = liftCuratorCatalogMeta(place);
    expect(lifted.one_line_review).toBeTruthy();
    const res = scoreTasteProfileForSearch(profile, {
      ...place,
      ...lifted,
    });
    expect(res.boost).toBeGreaterThan(0);
    expect(curatorMetaTextForTasteBlob(place)).toContain("데이트");
  });
});
