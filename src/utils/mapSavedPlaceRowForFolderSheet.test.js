import { describe, expect, it } from "vitest";
import { mapSavedPlaceRowForFolderSheet } from "./mapSavedPlaceRowForFolderSheet.js";

describe("mapSavedPlaceRowForFolderSheet", () => {
  it("maps a joined saved-place row", () => {
    const out = mapSavedPlaceRowForFolderSheet({
      place_id: "pid",
      places: {
        id: "pid",
        name: "을지로 골뱅이",
        address: "서울 중구",
        image_url: "https://example.com/a.jpg",
        lat: 37.5,
        lng: 127.0,
      },
    });
    expect(out).toMatchObject({
      id: "pid",
      name: "을지로 골뱅이",
      region: "서울 중구",
      image: "https://example.com/a.jpg",
    });
  });

  it("returns null without an id", () => {
    expect(mapSavedPlaceRowForFolderSheet({})).toBeNull();
  });
});
