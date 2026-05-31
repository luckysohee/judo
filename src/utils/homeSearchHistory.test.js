import { describe, it, expect, beforeEach } from "vitest";
import {
  recordHomeSearchHistory,
  loadHomeSearchHistory,
  removeHomeSearchHistoryEntry,
  filterHomeSearchHistoryByChip,
  clearHomeSearchHistory,
} from "./homeSearchHistory";

describe("homeSearchHistory", () => {
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
    clearHomeSearchHistory(null);
  });

  it("dedupes by normalized query and caps list", () => {
    recordHomeSearchHistory({ query: "이태원 와인바" });
    recordHomeSearchHistory({ query: "  이태원   와인바  " });
    const list = loadHomeSearchHistory(null);
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("sentence");
  });

  it("filters chips", () => {
    recordHomeSearchHistory({ query: "호계", kind: "place" });
    recordHomeSearchHistory({ query: "이태원 와인바 데이트", kind: "sentence" });
    const all = loadHomeSearchHistory(null);
    expect(filterHomeSearchHistoryByChip(all, "place")).toHaveLength(1);
    expect(filterHomeSearchHistoryByChip(all, "sentence")).toHaveLength(1);
  });

  it("removes single entry", () => {
    const [a] = recordHomeSearchHistory({ query: "강남 포차" });
    removeHomeSearchHistoryEntry(null, a.id);
    expect(loadHomeSearchHistory(null)).toHaveLength(0);
  });
});
