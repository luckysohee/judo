import { describe, expect, it } from "vitest";
import {
  inferSidoFromAddress,
  inferSidoFromCoords,
  placeAddressCoordsConsistent,
} from "./placeGeoConsistency.js";

const ITAEWON = { lat: 37.534, lng: 126.994 };

describe("placeGeoConsistency", () => {
  it("infers sido from address", () => {
    expect(inferSidoFromAddress("인천 연수구 센트럴로")).toBe("인천");
    expect(inferSidoFromAddress("강원특별자치도 춘천시")).toBe("강원");
    expect(inferSidoFromAddress("서울 용산구 이태원로")).toBe("서울");
    expect(inferSidoFromAddress("경기 파주시 연풍초교길81")).toBe("경기");
    expect(inferSidoFromAddress("인천 옹진군 외리")).toBe("인천");
  });

  it("infers sido from coords", () => {
    expect(inferSidoFromCoords(37.534, 126.994)).toBe("서울");
    expect(inferSidoFromCoords(37.45, 126.7)).toBe("인천");
  });

  it("drops reported bad Itaewon pins (Paju / Ongjin)", () => {
    expect(
      placeAddressCoordsConsistent({
        ...ITAEWON,
        name: "단골집",
        address: "경기 파주시 연풍초교길81",
      })
    ).toBe(false);
    expect(
      placeAddressCoordsConsistent({
        ...ITAEWON,
        name: "노가리",
        address: "인천 옹진군 외리",
      })
    ).toBe(false);
  });

  it("drops Incheon/Gangwon address on Itaewon coords", () => {
    expect(
      placeAddressCoordsConsistent({
        ...ITAEWON,
        address: "인천광역시 남동구 구월동",
      })
    ).toBe(false);
    expect(
      placeAddressCoordsConsistent({
        ...ITAEWON,
        address: "강원도 강릉시 경포로",
      })
    ).toBe(false);
  });

  it("keeps matching Seoul address on Itaewon coords", () => {
    expect(
      placeAddressCoordsConsistent({
        ...ITAEWON,
        address: "서울특별시 용산구 이태원동",
      })
    ).toBe(true);
  });

  it("keeps places without address (cannot judge)", () => {
    expect(placeAddressCoordsConsistent({ ...ITAEWON })).toBe(true);
  });
});
