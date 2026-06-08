import { describe, expect, it } from "vitest";
import {
  pickTodayTastePlaces,
  scorePlaceWithTasteProfile,
  tasteProfileHasSignals,
  tasteRowFromOnboardingAnswers,
} from "./userTasteProfile.js";

describe("userTasteProfile", () => {
  it("builds row from onboarding answers", () => {
    const row = tasteRowFromOnboardingAnswers(
      {
        liquor_types: ["와인"],
        vibes: ["조용한"],
        regions: ["연남"],
        situation: "date",
        party_size: 2,
      },
      "user-1"
    );
    expect(row.liquor_types).toEqual(["와인"]);
    expect(row.onboarding_status).toBe("completed");
    expect(tasteProfileHasSignals(row)).toBe(true);
  });

  it("scores place by taste overlap", () => {
    const profile = {
      liquor_types: ["와인"],
      vibes: ["조용한"],
      regions: ["연남"],
      situations: ["date"],
      party_size: 2,
      prefer_walkable: false,
      onboarding_status: "completed",
    };
    const high = scorePlaceWithTasteProfile(
      {
        name: "연남 와인바",
        tags: ["데이트", "조용한"],
        liquor_types: ["와인"],
        address_name: "연남동",
      },
      profile
    );
    const low = scorePlaceWithTasteProfile(
      { name: "포장마차", tags: ["회식"], address_name: "부산" },
      profile
    );
    expect(high).toBeGreaterThan(low);
  });

  it("picks top taste places", () => {
    const profile = tasteRowFromOnboardingAnswers(
      { liquor_types: ["맥주"], regions: ["홍대"] },
      "u"
    );
    const picks = pickTodayTastePlaces(
      [
        { id: "1", name: "홍대 맥주집", address_name: "홍대" },
        { id: "2", name: "강남 스시", address_name: "강남" },
      ],
      profile,
      { limit: 1 }
    );
    expect(picks[0]?.id).toBe("1");
  });
});
