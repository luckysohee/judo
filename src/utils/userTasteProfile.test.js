import { describe, expect, it } from "vitest";
import {
  pickTodayTastePlaces,
  scorePlaceWithTasteProfile,
  scoreTasteProfileForSearch,
  buildTasteMatchReasonLine,
  tasteProfileHasSignals,
  tasteRowFromOnboardingAnswers,
  tasteRowToOnboardingAnswers,
  formatTasteProfileSummary,
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

  it("round-trips onboarding answers through taste row", () => {
    const row = tasteRowFromOnboardingAnswers(
      {
        liquor_types: ["맥주", "와인"],
        vibes: ["조용한"],
        regions: ["홍대"],
        situation: "friends",
        party_size: 4,
        prefer_walkable: true,
        drink_frequency: "weekly",
        drink_capacity: "moderate",
        budget_per_person: "30_50k",
        out_time: "prime",
        anju_styles: ["meal", "share_plate"],
      },
      "user-2"
    );
    const answers = tasteRowToOnboardingAnswers(row);
    expect(answers.liquor_types).toEqual(["맥주", "와인"]);
    expect(answers.prefer_walkable).toBe("yes");
    expect(answers.drink_frequency).toBe("weekly");
    expect(answers.anju_styles).toEqual(["meal", "share_plate"]);
    expect(formatTasteProfileSummary(row).length).toBeGreaterThan(5);
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

  it("caps taste boost for home search ranking", () => {
    const profile = tasteRowFromOnboardingAnswers(
      {
        liquor_types: ["와인", "칵테일"],
        vibes: ["조용한"],
        regions: ["연남"],
        situation: "date",
      },
      "u"
    );
    const place = {
      name: "연남 와인바",
      tags: ["조용한", "데이트"],
      liquor_types: ["와인"],
      address_name: "연남동",
      one_line_review: "연남 데이트용 조용한 와인바",
    };
    const res = scoreTasteProfileForSearch(profile, place, { cap: 28 });
    expect(res.raw).toBeGreaterThan(20);
    expect(res.boost).toBeLessThanOrEqual(28);
    expect(res.matched.liquor).toBe("와인");
    expect(buildTasteMatchReasonLine(res.matched)).toContain("취향에 맞아요");
  });

  it("skips region taste when query pins another region", () => {
    const profile = tasteRowFromOnboardingAnswers(
      { regions: ["연남"], liquor_types: ["와인"] },
      "u"
    );
    const withRegion = scoreTasteProfileForSearch(
      profile,
      { name: "연남 와인", address_name: "연남" },
      { queryHasExplicitRegion: false }
    );
    const skipRegion = scoreTasteProfileForSearch(
      profile,
      { name: "연남 와인", address_name: "연남" },
      { queryHasExplicitRegion: true }
    );
    expect(withRegion.boost).toBeGreaterThan(skipRegion.boost);
    expect(skipRegion.matched.region).toBeUndefined();
  });
});
