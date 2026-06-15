import { describe, expect, it } from "vitest";
import { isCourseQuery } from "./isCourseQuery.js";

describe("isCourseQuery", () => {
  it("treats explicit multi-stop / course wording as course", () => {
    expect(isCourseQuery("성수 1차 2차")).toBe(true);
    expect(isCourseQuery("을지로 코스 짜줘")).toBe(true);
    expect(isCourseQuery("걸어서 1차 2차")).toBe(true);
    expect(isCourseQuery("합정 루트 추천")).toBe(true);
  });

  it("does not treat light-drink or party phrasing as course", () => {
    expect(isCourseQuery("친구 3명이서 성수에서 가볍게 한잔")).toBe(false);
    expect(isCourseQuery("오늘 가볍게 한잔")).toBe(false);
    expect(isCourseQuery("성수에서 가볍게 한잔")).toBe(false);
  });

  it("does not treat plain map search as course", () => {
    expect(isCourseQuery("성수 노포")).toBe(false);
    expect(isCourseQuery("을지로 와인바")).toBe(false);
  });
});
