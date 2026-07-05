import { describe, expect, it } from "vitest";
import {
  curatorMapsFromRows,
  curatorNicknameFromCuratorRow,
} from "./curatorCourseDiscoveryLabels.js";

describe("curatorCourseDiscoveryLabels", () => {
  it("uses curators.name as studio profile 별명", () => {
    expect(
      curatorNicknameFromCuratorRow({
        user_id: "u1",
        name: "노포킬러",
        display_name: "옛별명",
      })
    ).toBe("노포킬러");
  });

  it("builds nickname map keyed by user_id", () => {
    const { nicknameByCurator } = curatorMapsFromRows([
      { user_id: "u1", name: "성수맛집러", slug: "sulzzang" },
    ]);
    expect(nicknameByCurator.get("u1")).toBe("성수맛집러");
  });
});
